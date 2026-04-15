import asyncio
import logging
import threading
from collections import deque
from typing import Callable, Set

import paho.mqtt.client as mqtt

from config import MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD

logger = logging.getLogger(__name__)

# Maximum messages kept in the topic ring buffer
TOPIC_BUFFER_SIZE = 500
# Maximum log lines kept in the log-via-mqtt ring buffer
LOG_BUFFER_SIZE = 200


class MqttClient:
    def __init__(self) -> None:
        self._sys_topics: dict[str, str] = {}
        self._topic_messages: deque[dict] = deque(maxlen=TOPIC_BUFFER_SIZE)
        self._mqtt_log_lines: deque[str] = deque(maxlen=LOG_BUFFER_SIZE)

        self._topic_subscribers: Set[Callable] = set()
        self._log_subscribers: Set[Callable] = set()

        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

        self._client = mqtt.Client(
            client_id="mosquitto-dashboard",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        if MQTT_USERNAME:
            self._client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._client.on_disconnect = self._on_disconnect

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        """Connect to the broker and start the network loop in a background thread."""
        self._loop = loop
        try:
            self._client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        except Exception as exc:
            logger.error("MQTT connect failed: %s", exc)
            return
        self._client.loop_start()

    def stop(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    @property
    def sys_topics(self) -> dict[str, str]:
        with self._lock:
            return dict(self._sys_topics)

    @property
    def topic_messages(self) -> list[dict]:
        with self._lock:
            return list(self._topic_messages)

    @property
    def mqtt_log_lines(self) -> list[str]:
        with self._lock:
            return list(self._mqtt_log_lines)

    def subscribe_topics(self, callback: Callable) -> None:
        self._topic_subscribers.add(callback)

    def unsubscribe_topics(self, callback: Callable) -> None:
        self._topic_subscribers.discard(callback)

    def subscribe_logs(self, callback: Callable) -> None:
        self._log_subscribers.add(callback)

    def unsubscribe_logs(self, callback: Callable) -> None:
        self._log_subscribers.discard(callback)

    # ------------------------------------------------------------------ #
    #  Paho callbacks (run in the paho network thread)                     #
    # ------------------------------------------------------------------ #

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            logger.info("Connected to Mosquitto at %s:%s", MQTT_HOST, MQTT_PORT)
            client.subscribe("$SYS/#")
            client.subscribe("#")
        else:
            logger.error("MQTT connection refused: %s", reason_code)

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        logger.warning("Disconnected from MQTT broker (rc=%s)", reason_code)

    def _on_message(self, client, userdata, msg):
        topic: str = msg.topic
        try:
            payload = msg.payload.decode("utf-8", errors="replace")
        except Exception:
            payload = repr(msg.payload)

        with self._lock:
            if topic.startswith("$SYS/"):
                self._sys_topics[topic] = payload

                if topic.startswith("$SYS/broker/log/"):
                    self._mqtt_log_lines.append(payload)
                    self._broadcast_log(payload)
            else:
                message = {
                    "topic": topic,
                    "payload": payload,
                    "qos": msg.qos,
                    "retain": msg.retain,
                }
                self._topic_messages.append(message)
                self._broadcast_topic(message)

    # ------------------------------------------------------------------ #
    #  Async broadcasts                                                    #
    # ------------------------------------------------------------------ #

    def _broadcast_topic(self, message: dict) -> None:
        if not self._loop or not self._topic_subscribers:
            return
        for cb in list(self._topic_subscribers):
            try:
                asyncio.run_coroutine_threadsafe(cb(message), self._loop)
            except Exception as exc:
                logger.debug("Topic broadcast error: %s", exc)

    def _broadcast_log(self, line: str) -> None:
        if not self._loop or not self._log_subscribers:
            return
        for cb in list(self._log_subscribers):
            try:
                asyncio.run_coroutine_threadsafe(cb(line), self._loop)
            except Exception as exc:
                logger.debug("Log broadcast error: %s", exc)


# Singleton instance
mqtt_client = MqttClient()
