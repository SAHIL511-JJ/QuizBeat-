import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services.firebase_admin_service import get_firestore_client

logger = logging.getLogger(__name__)

LOGIN_CODES_COLLECTION = "mcp_login_codes"
SESSIONS_COLLECTION = "mcp_sessions"
LOGIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
LOGIN_CODE_LENGTH = 12


class McpAuthError(RuntimeError):
    status_code = 400
    error_code = "MCP_AUTH_ERROR"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidLoginCodeError(McpAuthError):
    status_code = 400
    error_code = "INVALID_CODE"


class LoginCodeNotFoundError(McpAuthError):
    status_code = 404
    error_code = "CODE_NOT_FOUND"


class LoginCodeExpiredError(McpAuthError):
    status_code = 410
    error_code = "CODE_EXPIRED"


class LoginCodeAlreadyUsedError(McpAuthError):
    status_code = 409
    error_code = "CODE_ALREADY_USED"


class InvalidSessionError(McpAuthError):
    status_code = 401
    error_code = "SESSION_INVALID"


class SessionExpiredError(McpAuthError):
    status_code = 401
    error_code = "SESSION_EXPIRED"


def create_login_code(user_info: dict[str, Any]) -> dict[str, Any]:
    cleanup_expired_auth_records()

    normalized_user = _normalize_user(user_info)
    login_code = _generate_login_code()
    now = _utcnow()
    expires_at = now + timedelta(minutes=_get_login_code_ttl_minutes())

    payload = {
        "code_hash": _hash_secret(login_code),
        "user_id": normalized_user["uid"],
        "email": normalized_user["email"],
        "display_name": normalized_user["display_name"],
        "created_at": now,
        "expires_at": expires_at,
        "used": False,
        "used_at": None,
    }

    db = get_firestore_client()
    db.collection(LOGIN_CODES_COLLECTION).add(payload)

    logger.info("Created MCP login code for user %s", normalized_user["uid"])

    return {
        "login_code": login_code,
        "expires_at": expires_at.isoformat(),
        "display_name": normalized_user["display_name"],
        "email": normalized_user["email"],
    }


def exchange_login_code(login_code: str) -> dict[str, Any]:
    normalized_code = _normalize_login_code(login_code)
    code_hash = _hash_secret(normalized_code)

    db = get_firestore_client()
    matches = list(
        db.collection(LOGIN_CODES_COLLECTION)
        .where("code_hash", "==", code_hash)
        .limit(1)
        .stream()
    )
    if not matches:
        raise LoginCodeNotFoundError("Login code not found.")

    login_doc = matches[0]
    data = login_doc.to_dict() or {}
    now = _utcnow()

    if data.get("used"):
        raise LoginCodeAlreadyUsedError("This login code has already been used.")

    expires_at = _ensure_datetime(data.get("expires_at"))
    if expires_at <= now:
        login_doc.reference.update({"used": True, "used_at": now})
        raise LoginCodeExpiredError("This login code has expired.")

    session_token = _generate_session_token()
    session_expires_at = now + timedelta(days=_get_session_ttl_days())

    session_payload = {
        "session_token_hash": _hash_secret(session_token),
        "user_id": data.get("user_id"),
        "email": data.get("email", ""),
        "display_name": data.get("display_name", ""),
        "created_at": now,
        "expires_at": session_expires_at,
        "last_used": now,
        "revoked": False,
        "revoked_at": None,
    }

    db.collection(SESSIONS_COLLECTION).add(session_payload)
    login_doc.reference.update({"used": True, "used_at": now})

    logger.info("Created MCP session for user %s", data.get("user_id"))

    return {
        "session_token": session_token,
        "uid": data.get("user_id"),
        "email": data.get("email", ""),
        "display_name": data.get("display_name", ""),
        "issued_at": now.isoformat(),
        "expires_at": session_expires_at.isoformat(),
    }


def validate_session(session_token: str, *, update_last_used: bool = False) -> dict[str, Any]:
    normalized_token = _normalize_session_token(session_token)
    db = get_firestore_client()
    matches = list(
        db.collection(SESSIONS_COLLECTION)
        .where("session_token_hash", "==", _hash_secret(normalized_token))
        .limit(1)
        .stream()
    )
    if not matches:
        raise InvalidSessionError("Session token is invalid.")

    session_doc = matches[0]
    data = session_doc.to_dict() or {}
    now = _utcnow()

    if data.get("revoked"):
        raise InvalidSessionError("Session token has been revoked.")

    expires_at = _ensure_datetime(data.get("expires_at"))
    if expires_at <= now:
        session_doc.reference.update({"revoked": True, "revoked_at": now})
        raise SessionExpiredError("Session token has expired.")

    if update_last_used:
        session_doc.reference.update({"last_used": now})

    return {
        "uid": data.get("user_id"),
        "email": data.get("email", ""),
        "display_name": data.get("display_name", ""),
        "issued_at": _ensure_datetime(data.get("created_at")).isoformat(),
        "expires_at": expires_at.isoformat(),
    }


def revoke_session(session_token: str) -> dict[str, Any]:
    normalized_token = _normalize_session_token(session_token)
    db = get_firestore_client()
    matches = list(
        db.collection(SESSIONS_COLLECTION)
        .where("session_token_hash", "==", _hash_secret(normalized_token))
        .limit(1)
        .stream()
    )
    if not matches:
        raise InvalidSessionError("Session token is invalid.")

    now = _utcnow()
    matches[0].reference.update({"revoked": True, "revoked_at": now})

    logger.info("Revoked MCP session")

    return {"message": "Logged out successfully.", "revoked_at": now.isoformat()}


def cleanup_expired_auth_records(max_delete: int = 50) -> None:
    db = get_firestore_client()
    now = _utcnow()

    _delete_expired_docs(db, LOGIN_CODES_COLLECTION, now, max_delete)
    _delete_expired_docs(db, SESSIONS_COLLECTION, now, max_delete)


def _delete_expired_docs(db, collection_name: str, now: datetime, max_delete: int) -> None:
    docs = list(
        db.collection(collection_name)
        .where("expires_at", "<=", now)
        .limit(max_delete)
        .stream()
    )
    for doc in docs:
        doc.reference.delete()


def _normalize_user(user_info: dict[str, Any]) -> dict[str, str]:
    uid = user_info.get("uid") or user_info.get("user_id")
    if not uid:
        raise McpAuthError("Verified Firebase token did not include a user ID.")

    email = user_info.get("email", "")
    display_name = user_info.get("name") or user_info.get("display_name") or email or "QuizBeat User"

    return {
        "uid": uid,
        "email": email,
        "display_name": display_name,
    }


def _normalize_login_code(login_code: str) -> str:
    normalized = (login_code or "").strip().replace("-", "").replace(" ", "").upper()
    if len(normalized) != LOGIN_CODE_LENGTH or any(ch not in LOGIN_CODE_ALPHABET for ch in normalized):
        raise InvalidLoginCodeError("Login code format is invalid.")
    return normalized


def _normalize_session_token(session_token: str) -> str:
    normalized = (session_token or "").strip()
    if len(normalized) < 32:
        raise InvalidSessionError("Session token format is invalid.")
    return normalized


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _generate_login_code() -> str:
    return "".join(secrets.choice(LOGIN_CODE_ALPHABET) for _ in range(LOGIN_CODE_LENGTH))


def _generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    raise McpAuthError("Invalid timestamp stored in MCP auth state.")


def _get_login_code_ttl_minutes() -> int:
    return _get_int_env("MCP_LOGIN_CODE_TTL_MINUTES", 10)


def _get_session_ttl_days() -> int:
    return _get_int_env("MCP_SESSION_TTL_DAYS", 7)


def _get_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default
