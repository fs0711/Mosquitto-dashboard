import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import BACKEND_HOST, BACKEND_PORT
from services.mqtt_client import mqtt_client
from services.log_watcher import log_watcher
from routers import systree, listeners, websocket, users, acl, config, tls, broker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    mqtt_client.start(loop)
    log_watcher.start()
    logger.info("Mosquitto Dashboard backend started")
    yield
    mqtt_client.stop()
    log_watcher.stop()
    logger.info("Mosquitto Dashboard backend stopped")


app = FastAPI(
    title="Mosquitto Dashboard API",
    version="2.0.0",
    lifespan=lifespan,
)

# Allow Vite dev server during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(systree.router)
app.include_router(listeners.router)
app.include_router(websocket.router)
app.include_router(users.router)
app.include_router(acl.router)
app.include_router(config.router)
app.include_router(tls.router)
app.include_router(broker.router)

# Serve compiled React SPA from ../frontend/dist if it exists
_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=BACKEND_HOST, port=BACKEND_PORT, reload=True)
