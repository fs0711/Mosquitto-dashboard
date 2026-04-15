import re
from pathlib import Path
from fastapi import APIRouter, HTTPException

from config import MOSQUITTO_CONF

router = APIRouter()

# ------------------------------------------------------------------ #
#  Minimal mosquitto.conf parser                                      #
# ------------------------------------------------------------------ #

_DEFAULT_PROTOCOLS = {"mqtt", "mqtts", "ws", "wss"}


def _parse_listeners(conf_text: str) -> list[dict]:
    """Parse listener blocks from mosquitto.conf text.

    Returns a list of listener dicts compatible with the legacy API shape.
    """
    listeners: list[dict] = []
    current: dict | None = None

    for raw_line in conf_text.splitlines():
        line = raw_line.strip()
        # skip comments and blank lines
        if not line or line.startswith("#"):
            continue

        parts = line.split(None, 2)
        if not parts:
            continue
        key = parts[0].lower()
        value = parts[1] if len(parts) > 1 else ""

        if key == "listener":
            # "listener <port> [bind_address]"
            if current is not None:
                listeners.append(current)
            current = {
                "port": None,
                "socket": None,
                "protocol": "mqtt",
                "tls": False,
                "mtls": False,
                "allow_anonymous": False,
                "cafile": None,
                "certfile": None,
                "keyfile": None,
            }
            port_match = re.match(r"(\d+)", value)
            if port_match:
                current["port"] = int(port_match.group(1))

        elif key == "socket_domain" and current is not None:
            pass  # unix domain sockets handled via port=None

        elif key == "protocol" and current is not None:
            proto = value.lower()
            if proto in _DEFAULT_PROTOCOLS:
                current["protocol"] = proto

        elif key == "cafile" and current is not None:
            current["cafile"] = value
            current["tls"] = True

        elif key == "certfile" and current is not None:
            current["certfile"] = value

        elif key == "keyfile" and current is not None:
            current["keyfile"] = value

        elif key == "require_certificate" and current is not None:
            current["mtls"] = value.lower() in ("true", "yes", "1")

        elif key == "allow_anonymous":
            val = value.lower() in ("true", "yes", "1")
            if current is not None:
                current["allow_anonymous"] = val
            else:
                # global default applies to all listeners we've seen so far
                for lst in listeners:
                    lst["allow_anonymous"] = val

    if current is not None:
        listeners.append(current)

    return listeners


@router.get("/api/v1/listeners")
async def get_listeners():
    """Parse /etc/mosquitto/mosquitto.conf and return listener metadata."""
    conf_path = Path(MOSQUITTO_CONF)
    if not conf_path.exists():
        raise HTTPException(status_code=503, detail=f"Config file not found: {MOSQUITTO_CONF}")

    try:
        conf_text = conf_path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    listeners = _parse_listeners(conf_text)
    return {"listeners": listeners}
