from fastapi import APIRouter, Query
from services.redis_client import redis_client

router = APIRouter()


@router.get("/api/v1/topics/history")
async def get_topic_history(topic: str = Query(..., description="Full topic path")):
    """Return up to 30 stored messages for a topic (newest first)."""
    return redis_client.get_history(topic)


@router.get("/api/v1/topics")
async def get_known_topics():
    """Return all topics that have at least one stored message in Redis."""
    return redis_client.get_all_topics()
