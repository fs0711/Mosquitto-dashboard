import asyncio
import json
import logging
import threading
from typing import Callable, Set

import redis

from config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, TOPIC_HISTORY_LENGTH

logger = logging.getLogger(__name__)

HISTORY_KEY_PREFIX = "mqtt:history:"
# Keyspace pattern: fires on every LPUSH to any mqtt:history:* key
_KEYSPACE_PATTERN = f"__keyspace@{REDIS_DB}__:{HISTORY_KEY_PREFIX}*"


class RedisClient:
    def __init__(self) -> None:
        self._r: redis.Redis | None = None
        self._pubsub_thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: Set[Callable] = set()
        self._lock = threading.Lock()
        self._last_error: str = ""

    def connect(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        self._loop = loop
        try:
            self._r = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD or None,
                db=REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            self._r.ping()
            # Enable keyspace notifications for list commands (Kl)
            self._r.config_set("notify-keyspace-events", "Kl")
            self._last_error = ""
            logger.info("Connected to Redis at %s:%s", REDIS_HOST, REDIS_PORT)
        except Exception as exc:
            self._last_error = str(exc)
            logger.error("Redis connect failed: %s", exc)
            self._r = None
            return

        self._stop_event.clear()
        self._pubsub_thread = threading.Thread(target=self._pubsub_loop, daemon=True)
        self._pubsub_thread.start()

    def disconnect(self) -> None:
        self._stop_event.set()
        if self._r:
            self._r.close()

    # ------------------------------------------------------------------ #
    #  WebSocket subscriber management                                     #
    # ------------------------------------------------------------------ #

    def subscribe(self, callback: Callable) -> None:
        with self._lock:
            self._subscribers.add(callback)

    def unsubscribe(self, callback: Callable) -> None:
        with self._lock:
            self._subscribers.discard(callback)

    # ------------------------------------------------------------------ #
    #  Keyspace notification listener (background thread)                  #
    # ------------------------------------------------------------------ #

    def _pubsub_loop(self) -> None:
        """Listens for LPUSH keyspace events on mqtt:history:* keys."""
        try:
            ps = self._r.pubsub(ignore_subscribe_messages=True)
            ps.psubscribe(_KEYSPACE_PATTERN)
            logger.info("Redis keyspace notifications active (pattern: %s)", _KEYSPACE_PATTERN)
            while not self._stop_event.is_set():
                msg = ps.get_message(timeout=1.0)
                if not msg:
                    continue
                # msg["type"] == "pmessage", msg["channel"] == "__keyspace@0__:mqtt:history:<topic>"
                if msg.get("data") != "lpush":
                    continue
                channel: str = msg.get("channel", "")
                prefix = f"__keyspace@{REDIS_DB}__:{HISTORY_KEY_PREFIX}"
                if not channel.startswith(prefix):
                    continue
                topic = channel[len(prefix):]
                self._fetch_and_dispatch(topic)
            ps.punsubscribe()
        except Exception as exc:
            logger.error("Redis keyspace loop error: %s", exc)

    def _fetch_and_dispatch(self, topic: str) -> None:
        """Read the newest message for topic from Redis and broadcast to WS clients."""
        try:
            raw = self._r.lindex(HISTORY_KEY_PREFIX + topic, 0)
            if not raw:
                return
            message = json.loads(raw)
        except Exception as exc:
            logger.warning("Redis fetch for dispatch failed: %s", exc)
            return

        if not self._loop:
            return
        with self._lock:
            callbacks = list(self._subscribers)
        for cb in callbacks:
            try:
                asyncio.run_coroutine_threadsafe(cb(message), self._loop)
            except Exception as exc:
                logger.debug("Redis broadcast error: %s", exc)

    # ------------------------------------------------------------------ #
    #  Storage helpers                                                     #
    # ------------------------------------------------------------------ #

    def push_message(self, message: dict) -> None:
        """Store + trim per-topic history (used if this backend writes to Redis)."""
        if not self._r:
            return
        key = HISTORY_KEY_PREFIX + message["topic"]
        try:
            pipe = self._r.pipeline()
            pipe.lpush(key, json.dumps(message))
            pipe.ltrim(key, 0, TOPIC_HISTORY_LENGTH - 1)
            pipe.execute()
        except Exception as exc:
            logger.warning("Redis push failed: %s", exc)

    def get_history(self, topic: str) -> list[dict]:
        if not self._r:
            return []
        key = HISTORY_KEY_PREFIX + topic
        try:
            return [json.loads(item) for item in self._r.lrange(key, 0, -1)]
        except Exception as exc:
            logger.warning("Redis get failed: %s", exc)
            return []

    def get_all_topics(self) -> list[str]:
        if not self._r:
            return []
        try:
            keys = self._r.keys(HISTORY_KEY_PREFIX + "*")
            return [k[len(HISTORY_KEY_PREFIX):] for k in keys]
        except Exception as exc:
            logger.warning("Redis keys failed: %s", exc)
            return []


redis_client = RedisClient()
