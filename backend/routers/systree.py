from fastapi import APIRouter
from services.mqtt_client import mqtt_client

router = APIRouter()


@router.get("/api/v1/systree")
async def get_systree():
    """Return all current $SYS topic values keyed by topic path."""
    return mqtt_client.sys_topics
