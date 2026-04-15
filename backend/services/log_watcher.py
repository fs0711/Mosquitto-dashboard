import asyncio
import logging
import os
from collections import deque
from typing import Callable, Set

from config import MOSQUITTO_LOG

logger = logging.getLogger(__name__)

TAIL_BUFFER_SIZE = 500
TAIL_POLL_INTERVAL = 0.5  # seconds


class LogWatcher:
    """Tails the Mosquitto log file and broadcasts new lines to subscribers."""

    def __init__(self) -> None:
        self._buffer: deque[str] = deque(maxlen=TAIL_BUFFER_SIZE)
        self._subscribers: Set[Callable] = set()
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._tail_loop())

    def stop(self) -> None:
        if self._task:
            self._task.cancel()

    @property
    def buffered_lines(self) -> list[str]:
        return list(self._buffer)

    def subscribe(self, callback: Callable) -> None:
        self._subscribers.add(callback)

    def unsubscribe(self, callback: Callable) -> None:
        self._subscribers.discard(callback)

    async def _tail_loop(self) -> None:
        log_path = MOSQUITTO_LOG
        file_pos = 0

        # Seek to end of existing content on startup, but capture last N lines
        if os.path.exists(log_path):
            try:
                with open(log_path, "r", errors="replace") as f:
                    lines = f.readlines()
                    for line in lines[-TAIL_BUFFER_SIZE:]:
                        self._buffer.append(line.rstrip())
                    file_pos = f.tell()
            except OSError as exc:
                logger.warning("Cannot read log file %s: %s", log_path, exc)

        while True:
            await asyncio.sleep(TAIL_POLL_INTERVAL)
            if not os.path.exists(log_path):
                continue
            try:
                current_size = os.path.getsize(log_path)
                if current_size < file_pos:
                    # File was rotated/truncated
                    file_pos = 0

                with open(log_path, "r", errors="replace") as f:
                    f.seek(file_pos)
                    new_content = f.read()
                    file_pos = f.tell()

                if new_content:
                    for line in new_content.splitlines():
                        stripped = line.rstrip()
                        if stripped:
                            self._buffer.append(stripped)
                            await self._broadcast(stripped)
            except OSError as exc:
                logger.warning("Log tail error: %s", exc)

    async def _broadcast(self, line: str) -> None:
        for cb in list(self._subscribers):
            try:
                await cb(line)
            except Exception as exc:
                logger.debug("Log subscriber error: %s", exc)


# Singleton instance
log_watcher = LogWatcher()
