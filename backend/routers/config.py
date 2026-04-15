from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import MOSQUITTO_CONF
from services.config_manager import (
    dry_run_validate,
    list_backups,
    restore_backup,
    save_with_backup,
)

router = APIRouter()


class ConfigUpdate(BaseModel):
    content: str


class ValidateRequest(BaseModel):
    content: str


@router.get("/api/v1/config")
async def get_config():
    conf_path = Path(MOSQUITTO_CONF)
    if not conf_path.exists():
        raise HTTPException(status_code=503, detail=f"Config file not found: {MOSQUITTO_CONF}")
    try:
        return {"content": conf_path.read_text(encoding="utf-8", errors="replace")}
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/api/v1/config/validate")
async def validate_config(body: ValidateRequest):
    result = dry_run_validate(body.content)
    return result


@router.put("/api/v1/config")
async def update_config(body: ConfigUpdate):
    validation = dry_run_validate(body.content)
    if not validation["valid"]:
        raise HTTPException(
            status_code=422,
            detail={"message": "Config validation failed", "output": validation["output"]},
        )
    try:
        backup_name = save_with_backup(body.content)
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"message": "Config saved", "backup": backup_name}


@router.get("/api/v1/config/backups")
async def get_backups():
    return {"backups": list_backups()}


@router.post("/api/v1/config/restore/{filename}")
async def restore_config(filename: str):
    try:
        restore_backup(filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"message": f"Restored backup: {filename}"}
