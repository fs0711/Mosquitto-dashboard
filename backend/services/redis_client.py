import json
import logging

import redis

from config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, TOPIC_HISTORY_LENGTH

logger = logging.getLogger(__name__)

HISTORY_KEY_PREFIX = "mqtt:history:"


class RedisClient:
    def __init__(self) -> None:
        self._r: redis.Redis | None = None

    def connect(self) -> None:
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

    def disconnect(self) -> None:
        if self._r:
            self._r.close()

    def push_message(self, message: dict) -> None:
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
            items = self._r.lrange(key, 0, -1)
            return [json.loads(item) for item in items]
        except Exception as exc:
            logger.warning("Redis get failed: %s", exc)
            return []

    def get_all_topics(self) -> list[str]:
        if not self._r:
            return []
        try:
            keys = self._r.keys(HISTORY_KEY_PREFIX + "*")
            prefix_len = len(HISTORY_KEY_PREFIX)
            return [k[prefix_len:] for k in keys]
        except Exception as exc:
            logger.warning("Redis keys failed: %s", exc)
            return []


redis_client = RedisClient()
