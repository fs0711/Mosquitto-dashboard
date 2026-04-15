import glob
import logging
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from config import MOSQUITTO_CONF, CONFIG_MAX_BACKUPS

logger = logging.getLogger(__name__)


def _backup_dir() -> Path:
    return Path(MOSQUITTO_CONF).parent


def _backup_glob() -> str:
    return str(Path(MOSQUITTO_CONF).parent / (Path(MOSQUITTO_CONF).name + ".bak.*"))


def dry_run_validate(content: str) -> dict:
    """Write content to a temp file and run mosquitto --test-config.

    Returns:
        {"valid": bool, "output": str}
    """
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".conf", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            ["mosquitto", "-c", tmp_path, "--test-config"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        output = (result.stdout + result.stderr).strip()
        valid = result.returncode == 0
        return {"valid": valid, "output": output}
    except FileNotFoundError:
        # mosquitto binary not on PATH — skip validation rather than block
        logger.warning("mosquitto binary not found; skipping dry-run validation")
        return {"valid": True, "output": "mosquitto binary not found — validation skipped"}
    except subprocess.TimeoutExpired:
        return {"valid": False, "output": "Validation timed out"}
    except Exception as exc:
        return {"valid": False, "output": str(exc)}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def list_backups() -> list[dict]:
    """Return available backup files sorted newest first."""
    backups = []
    for path in sorted(glob.glob(_backup_glob()), reverse=True):
        filename = os.path.basename(path)
        try:
            stat = os.stat(path)
            backups.append({
                "filename": filename,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
        except OSError:
            pass
    return backups


def save_with_backup(content: str) -> str:
    """Back up the current config and write the new content.

    Returns the backup filename created.
    Raises OSError on file write failure.
    """
    conf_path = Path(MOSQUITTO_CONF)
    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = conf_path.parent / f"{conf_path.name}.bak.{timestamp}"

    # Create backup of current config (if it exists)
    if conf_path.exists():
        shutil.copy2(str(conf_path), str(backup_path))
        logger.info("Config backed up to %s", backup_path)
        _prune_old_backups()

    # Write new config
    conf_path.write_text(content, encoding="utf-8")
    logger.info("Config saved to %s", conf_path)
    return backup_path.name


def restore_backup(filename: str) -> None:
    """Restore a named backup as the active config.

    Raises FileNotFoundError if the backup does not exist.
    Raises ValueError if filename contains path traversal characters.
    """
    if "/" in filename or "\\" in filename or ".." in filename:
        raise ValueError("Invalid backup filename")

    backup_path = Path(MOSQUITTO_CONF).parent / filename
    if not backup_path.exists():
        raise FileNotFoundError(f"Backup not found: {filename}")

    backup_content = backup_path.read_text(encoding="utf-8")
    save_with_backup(backup_content)
    logger.info("Restored backup %s as active config", filename)


def _prune_old_backups() -> None:
    """Delete oldest backups, keeping only CONFIG_MAX_BACKUPS."""
    backups = sorted(glob.glob(_backup_glob()))
    while len(backups) >= CONFIG_MAX_BACKUPS:
        oldest = backups.pop(0)
        try:
            os.unlink(oldest)
            logger.info("Pruned old backup: %s", oldest)
        except OSError as exc:
            logger.warning("Could not prune backup %s: %s", oldest, exc)
