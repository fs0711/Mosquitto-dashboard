import os
from datetime import datetime, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from config import MOSQUITTO_CERTS_DIR

router = APIRouter()

_ALLOWED_EXTENSIONS = {".pem", ".crt", ".cer", ".key"}
_MAX_CERT_SIZE = 512 * 1024  # 512 KB


def _cert_info(path: Path) -> dict:
    info = {
        "filename": path.name,
        "size": path.stat().st_size,
        "modified": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
        "subject": None,
        "issuer": None,
        "not_valid_after": None,
        "expired": None,
    }
    # Try to parse as X.509 certificate
    try:
        with open(path, "rb") as f:
            raw = f.read()
        cert = x509.load_pem_x509_certificate(raw, default_backend())
        info["subject"] = cert.subject.rfc4514_string()
        info["issuer"] = cert.issuer.rfc4514_string()
        expiry = cert.not_valid_after_utc
        info["not_valid_after"] = expiry.isoformat()
        info["expired"] = expiry < datetime.now(tz=timezone.utc)
    except Exception:
        pass  # Key files etc. are not certificates — that is fine
    return info


@router.get("/api/v1/tls")
async def list_certs():
    certs_dir = Path(MOSQUITTO_CERTS_DIR)
    if not certs_dir.exists():
        return {"certs": []}
    certs = []
    for path in sorted(certs_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in _ALLOWED_EXTENSIONS:
            certs.append(_cert_info(path))
    return {"certs": certs}


@router.post("/api/v1/tls/upload", status_code=201)
async def upload_cert(file: UploadFile = File(...)):
    filename = Path(file.filename).name if file.filename else ""
    if not filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(_ALLOWED_EXTENSIONS)}",
        )

    # Reject filenames with path traversal characters
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    certs_dir = Path(MOSQUITTO_CERTS_DIR)
    certs_dir.mkdir(parents=True, exist_ok=True)

    dest = certs_dir / filename
    content = await file.read(_MAX_CERT_SIZE + 1)
    if len(content) > _MAX_CERT_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 512 KB)")

    try:
        dest.write_bytes(content)
        # Restrict permissions: readable only by owner and mosquitto group
        os.chmod(dest, 0o640)
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {"message": f"Uploaded {filename}", "filename": filename}


@router.delete("/api/v1/tls/{filename}", status_code=204)
async def delete_cert(filename: str):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    cert_path = Path(MOSQUITTO_CERTS_DIR) / filename
    if not cert_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        cert_path.unlink()
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
