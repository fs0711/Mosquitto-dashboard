import re
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from config import MOSQUITTO_PASSWD

router = APIRouter()

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_\-\.@]{1,64}$")


class UserCreate(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError("Invalid username format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 1:
            raise ValueError("Password must not be empty")
        if len(v) > 256:
            raise ValueError("Password too long")
        return v


class PasswordChange(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 1:
            raise ValueError("Password must not be empty")
        if len(v) > 256:
            raise ValueError("Password too long")
        return v


def _list_usernames() -> list[str]:
    passwd_path = Path(MOSQUITTO_PASSWD)
    if not passwd_path.exists():
        return []
    lines = passwd_path.read_text(encoding="utf-8", errors="replace").splitlines()
    users = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#"):
            username = line.split(":")[0]
            if username:
                users.append(username)
    return users


def _run_passwd(args: list[str]) -> None:
    try:
        result = subprocess.run(
            ["mosquitto_passwd"] + args,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="mosquitto_passwd binary not found")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=503, detail="mosquitto_passwd timed out")

    if result.returncode != 0:
        raise HTTPException(
            status_code=400,
            detail=(result.stderr or result.stdout or "mosquitto_passwd failed").strip(),
        )


@router.get("/api/v1/users")
async def list_users():
    return {"users": _list_usernames()}


@router.post("/api/v1/users", status_code=201)
async def create_user(body: UserCreate):
    existing = _list_usernames()
    if body.username in existing:
        raise HTTPException(status_code=409, detail="User already exists")
    _run_passwd(["-b", MOSQUITTO_PASSWD, body.username, body.password])
    return {"message": f"User '{body.username}' created"}


@router.put("/api/v1/users/{username}")
async def update_user_password(username: str, body: PasswordChange):
    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="Invalid username format")
    existing = _list_usernames()
    if username not in existing:
        raise HTTPException(status_code=404, detail="User not found")
    _run_passwd(["-b", MOSQUITTO_PASSWD, username, body.password])
    return {"message": f"Password updated for '{username}'"}


@router.delete("/api/v1/users/{username}", status_code=204)
async def delete_user(username: str):
    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="Invalid username format")
    existing = _list_usernames()
    if username not in existing:
        raise HTTPException(status_code=404, detail="User not found")
    _run_passwd(["-D", MOSQUITTO_PASSWD, username])
