import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend directory itself
load_dotenv(Path(__file__).parent / ".env")

MQTT_HOST: str = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT: int = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME: str = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD: str = os.getenv("MQTT_PASSWORD", "")

MOSQUITTO_CONF: str = os.getenv("MOSQUITTO_CONF", "/etc/mosquitto/mosquitto.conf")
MOSQUITTO_PASSWD: str = os.getenv("MOSQUITTO_PASSWD", "/etc/mosquitto/passwd")
MOSQUITTO_ACL: str = os.getenv("MOSQUITTO_ACL", "/etc/mosquitto/acl")
MOSQUITTO_CERTS_DIR: str = os.getenv("MOSQUITTO_CERTS_DIR", "/etc/mosquitto/certs")
MOSQUITTO_LOG: str = os.getenv("MOSQUITTO_LOG", "/var/log/mosquitto/mosquitto.log")
MOSQUITTO_PID: str = os.getenv("MOSQUITTO_PID", "/run/mosquitto/mosquitto.pid")

CONFIG_MAX_BACKUPS: int = int(os.getenv("CONFIG_MAX_BACKUPS", "5"))

BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
