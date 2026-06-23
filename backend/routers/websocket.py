import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.mqtt_client import mqtt_client
from services.log_watcher import log_watcher
from services.redis_client import redis_client

router = APIRouter()
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
#  /ws/topics — Redis snapshot + live Pub/Sub feed                    #
# ------------------------------------------------------------------ #

@router.websocket("/ws/topics")
async def ws_topics(websocket: WebSocket):
    await websocket.accept()
    logger.info("Topics WS client connected")

    # Send stored history for all known topics as initial snapshot
    for topic in redis_client.get_all_topics():
        for msg in reversed(redis_client.get_history(topic)):
            try:
                await websocket.send_text(json.dumps({"type": "message", "data": msg}))
            except Exception:
                return

    async def on_message(message: dict):
        try:
            await websocket.send_text(json.dumps({"type": "message", "data": message}))
        except Exception:
            redis_client.unsubscribe(on_message)

    redis_client.subscribe(on_message)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        redis_client.unsubscribe(on_message)
        logger.info("Topics WS client disconnected")


# ------------------------------------------------------------------ #
#  /ws/logs — file tail + $SYS/broker/log/# lines                    #
# ------------------------------------------------------------------ #

@router.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket):
    await websocket.accept()
    logger.info("Logs WS client connected")

    # Send buffered file-tail lines
    for line in log_watcher.buffered_lines:
        try:
            await websocket.send_text(json.dumps({"type": "log", "data": line, "source": "file"}))
        except Exception:
            return

    # Also send buffered $SYS/broker/log lines from MQTT
    for line in mqtt_client.mqtt_log_lines:
        try:
            await websocket.send_text(json.dumps({"type": "log", "data": line, "source": "mqtt"}))
        except Exception:
            return

    async def on_file_log(line: str):
        try:
            await websocket.send_text(json.dumps({"type": "log", "data": line, "source": "file"}))
        except Exception:
            log_watcher.unsubscribe(on_file_log)

    async def on_mqtt_log(line: str):
        try:
            await websocket.send_text(json.dumps({"type": "log", "data": line, "source": "mqtt"}))
        except Exception:
            mqtt_client.unsubscribe_logs(on_mqtt_log)

    log_watcher.subscribe(on_file_log)
    mqtt_client.subscribe_logs(on_mqtt_log)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        log_watcher.unsubscribe(on_file_log)
        mqtt_client.unsubscribe_logs(on_mqtt_log)
        logger.info("Logs WS client disconnected")
