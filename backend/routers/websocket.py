import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.mqtt_client import mqtt_client
from services.log_watcher import log_watcher

router = APIRouter()
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
#  /ws/topics — live MQTT topic messages                              #
# ------------------------------------------------------------------ #

@router.websocket("/ws/topics")
async def ws_topics(websocket: WebSocket):
    await websocket.accept()
    logger.info("Topics WS client connected")

    # Send buffered snapshot first
    snapshot = mqtt_client.topic_messages
    for msg in snapshot:
        try:
            await websocket.send_text(json.dumps({"type": "message", "data": msg}))
        except Exception:
            return

    async def on_message(message: dict):
        try:
            await websocket.send_text(json.dumps({"type": "message", "data": message}))
        except Exception:
            mqtt_client.unsubscribe_topics(on_message)

    mqtt_client.subscribe_topics(on_message)
    try:
        while True:
            # Keep connection alive; client may send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        mqtt_client.unsubscribe_topics(on_message)
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
