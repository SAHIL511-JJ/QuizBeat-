"""
Persistent local session storage for QuizBeat MCP authentication.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def save_session(session: dict[str, Any]) -> Path:
    path = _get_session_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(session, indent=2), encoding="utf-8")
    return path


def load_session() -> dict[str, Any] | None:
    path = _get_session_file_path()
    if not path.exists():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None


def clear_session() -> None:
    path = _get_session_file_path()
    if path.exists():
        path.unlink()


def session_exists() -> bool:
    return _get_session_file_path().exists()


def is_session_expired(session: dict[str, Any]) -> bool:
    expires_at = session.get("expires_at")
    if not expires_at:
        return True

    try:
        expiry = datetime.fromisoformat(expires_at)
    except ValueError:
        return True

    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    return expiry <= datetime.now(timezone.utc)


def get_session_file_path() -> str:
    return str(_get_session_file_path())


def _get_session_file_path() -> Path:
    override = os.getenv("QUIZBEAT_MCP_SESSION_FILE")
    if override:
        return Path(override).expanduser()

    if os.name == "nt":
        base = Path(os.getenv("APPDATA") or (Path.home() / "AppData" / "Roaming"))
    else:
        base = Path(os.getenv("XDG_CONFIG_HOME") or (Path.home() / ".config"))

    return base / "QuizBeatMCP" / "session.json"
