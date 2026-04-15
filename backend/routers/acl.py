from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import MOSQUITTO_ACL

router = APIRouter()


class AclUpdate(BaseModel):
    content: str


@router.get("/api/v1/acl")
async def get_acl():
    acl_path = Path(MOSQUITTO_ACL)
    if not acl_path.exists():
        return {"content": ""}
    try:
        return {"content": acl_path.read_text(encoding="utf-8", errors="replace")}
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.put("/api/v1/acl")
async def update_acl(body: AclUpdate):
    acl_path = Path(MOSQUITTO_ACL)
    try:
        acl_path.write_text(body.content, encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"message": "ACL file saved"}
