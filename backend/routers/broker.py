import logging
import os
import signal
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException

from config import MOSQUITTO_PID

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_mosquitto_pid() -> int | None:
    """Try reading the PID file first; fall back to `pidof mosquitto`."""
    pid_path = Path(MOSQUITTO_PID)
    if pid_path.exists():
        try:
            return int(pid_path.read_text().strip())
        except (OSError, ValueError):
            pass

    # Fallback: ask the OS
    try:
        result = subprocess.run(
            ["pidof", "mosquitto"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            # pidof may return multiple PIDs; take the first
            return int(result.stdout.split()[0])
    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError):
        pass

    return None


@router.post("/api/v1/broker/reload")
async def reload_broker():
    """Send SIGHUP to the Mosquitto process to reload its configuration."""
    pid = _get_mosquitto_pid()
    if pid is None:
        raise HTTPException(status_code=503, detail="Could not determine Mosquitto PID")

    try:
        os.kill(pid, signal.SIGHUP)
        logger.info("Sent SIGHUP to Mosquitto PID %s", pid)
    except ProcessLookupError:
        raise HTTPException(status_code=503, detail=f"Process {pid} not found")
    except PermissionError:
        # Try via sudo systemctl as configured in sudoers
        try:
            result = subprocess.run(
                ["sudo", "systemctl", "reload", "mosquitto"],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=503,
                    detail=(result.stderr or result.stdout or "Reload failed").strip(),
                )
        except FileNotFoundError:
            raise HTTPException(
                status_code=403,
                detail="Permission denied — configure sudoers for systemctl reload mosquitto",
            )
    return {"message": "Mosquitto reload signal sent"}
