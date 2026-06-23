import asyncio
import json
import logging
import threading
from typing import Callable, Set

import redis

from config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, TOPIC_HISTORY_LENGTH

logger = logging.getLogger(__name__)

HISTORY_KEY_PREFIX = "mqtt:history:"
LIVE_CHANNEL = "mqtt:live"


class RedisClient:
    def __init__(self) -> None:
        self._r: redis.Redis | None = None
        self._pubsub_thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: Set[Callable] = set()
        self._lock = threading.Lock()

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
            logger.info("Connected to Redis at %s:%s", REDIS_HOST, REDIS_PORT)
        except Exception as exc:
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
    #  Pub/Sub subscription management                                     #
    # ------------------------------------------------------------------ #

    def subscribe(self, callback: Callable) -> None:
        with self._lock:
            self._subscribers.add(callback)

    def unsubscribe(self, callback: Callable) -> None:
        with self._lock:
            self._subscribers.discard(callback)

    def _pubsub_loop(self) -> None:
        """Blocking loop in a background thread — listens on mqtt:live and fans out."""
        try:
            ps = self._r.pubsub(ignore_subscribe_messages=True)
            ps.subscribe(LIVE_CHANNEL)
            logger.info("Redis Pub/Sub subscribed to channel '%s'", LIVE_CHANNEL)
            while not self._stop_event.is_set():
                msg = ps.get_message(timeout=1.0)
                if msg and msg["type"] == "message":
                    self._dispatch(msg["data"])
            ps.unsubscribe()
        except Exception as exc:
            logger.error("Redis Pub/Sub loop error: %s", exc)

    def _dispatch(self, raw: str) -> None:
        if not self._loop:
            return
        try:
            message = json.loads(raw)
        except Exception:
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
        """Store + trim per-topic history. Also publishes to mqtt:live."""
        if not self._r:
            return
        key = HISTORY_KEY_PREFIX + message["topic"]
        try:
            pipe = self._r.pipeline()
            pipe.lpush(key, json.dumps(message))
            pipe.ltrim(key, 0, TOPIC_HISTORY_LENGTH - 1)
            pipe.publish(LIVE_CHANNEL, json.dumps(message))
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
