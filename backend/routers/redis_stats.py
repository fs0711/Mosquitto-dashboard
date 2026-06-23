from fastapi import APIRouter, Query
from services.redis_client import redis_client

router = APIRouter()


@router.get("/api/v1/redis/stats")
async def get_redis_stats():
    """Return key Redis INFO fields plus mqtt:history key count."""
    r = redis_client._r
    if not r:
        return {"available": False, "error": redis_client._last_error}

    try:
        info = r.info()
        topic_count = len(r.keys("mqtt:history:*"))
        return {
            "available": True,
            "version": info.get("redis_version"),
            "uptime_seconds": info.get("uptime_in_seconds"),
            "connected_clients": info.get("connected_clients"),
            "used_memory": info.get("used_memory"),
            "used_memory_human": info.get("used_memory_human"),
            "used_memory_peak_human": info.get("used_memory_peak_human"),
            "total_commands_processed": info.get("total_commands_processed"),
            "total_connections_received": info.get("total_connections_received"),
            "keyspace_hits": info.get("keyspace_hits"),
            "keyspace_misses": info.get("keyspace_misses"),
            "pubsub_channels": info.get("pubsub_channels"),
            "pubsub_numsub": r.pubsub_numsub("mqtt:live").get("mqtt:live", 0),
            "topic_keys": topic_count,
        }
    except Exception as exc:
        return {"available": False, "error": str(exc)}


@router.get("/api/v1/redis/debug")
async def redis_debug(pattern: str = Query("mqtt:history:*")):
    """List keys matching pattern and return sample data. For diagnostics only."""
    r = redis_client._r
    if not r:
        from config import REDIS_HOST, REDIS_PORT, REDIS_DB
        return {"available": False, "config": {"host": REDIS_HOST, "port": REDIS_PORT, "db": REDIS_DB}, "error": redis_client._last_error}
    try:
        keys = r.keys(pattern)
        sample = {}
        for key in keys[:5]:
            sample[key] = r.lrange(key, 0, 2)
        return {"available": True, "key_count": len(keys), "keys_sample": keys[:20], "data_sample": sample}
    except Exception as exc:
        return {"available": False, "error": str(exc)}
