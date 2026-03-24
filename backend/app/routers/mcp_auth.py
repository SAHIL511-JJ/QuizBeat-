from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.services.firebase_admin_service import FirebaseAdminConfigError, verify_firebase_id_token
from app.services.mcp_auth_service import (
    McpAuthError,
    create_login_code,
    exchange_login_code,
    revoke_session,
    validate_session,
)
from app.services.rate_limit_service import RateLimitExceededError, check_rate_limit

router = APIRouter()


class LoginRequest(BaseModel):
    login_code: str


def _extract_bearer_token(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> str:
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"code": "MISSING_AUTH_HEADER", "message": "Authorization header is required."},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_AUTH_HEADER",
                "message": "Authorization header must be in the format 'Bearer <token>'.",
            },
        )

    return token.strip()


@router.post("/mcp/auth/create-login-code")
async def create_mcp_login_code(
    request: Request,
    firebase_id_token: str = Depends(_extract_bearer_token),
):
    try:
        verified_user = verify_firebase_id_token(firebase_id_token)
        user_id = verified_user.get("uid") or verified_user.get("user_id") or request.client.host or "anonymous"
        check_rate_limit("create-login-code", user_id, limit=5, window_seconds=15 * 60)
        payload = create_login_code(verified_user)
        return {"success": True, **payload}
    except FirebaseAdminConfigError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "FIREBASE_ADMIN_NOT_CONFIGURED", "message": str(exc)},
        ) from exc
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail={"code": "RATE_LIMIT_EXCEEDED", "message": str(exc)},
        ) from exc
    except RuntimeError as exc:
        message = str(exc)
        if message.startswith("Failed to verify Firebase ID token"):
            raise HTTPException(
                status_code=401,
                detail={"code": "INVALID_FIREBASE_TOKEN", "message": message},
            ) from exc
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKEND_ERROR", "message": message},
        ) from exc


@router.post("/mcp/auth/login")
async def login_to_mcp(
    payload: LoginRequest,
    request: Request,
):
    try:
        client_ip = request.client.host if request.client else "anonymous"
        check_rate_limit("mcp-login", client_ip, limit=10, window_seconds=15 * 60)
        session = exchange_login_code(payload.login_code)
        return {"success": True, **session}
    except FirebaseAdminConfigError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "FIREBASE_ADMIN_NOT_CONFIGURED", "message": str(exc)},
        ) from exc
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail={"code": "RATE_LIMIT_EXCEEDED", "message": str(exc)},
        ) from exc
    except McpAuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.error_code, "message": exc.message},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKEND_ERROR", "message": str(exc)},
        ) from exc


@router.get("/mcp/auth/whoami")
async def mcp_whoami(session_token: str = Depends(_extract_bearer_token)):
    try:
        session = validate_session(session_token, update_last_used=True)
        return {"success": True, **session}
    except FirebaseAdminConfigError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "FIREBASE_ADMIN_NOT_CONFIGURED", "message": str(exc)},
        ) from exc
    except McpAuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.error_code, "message": exc.message},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKEND_ERROR", "message": str(exc)},
        ) from exc


@router.post("/mcp/auth/logout")
async def mcp_logout(session_token: str = Depends(_extract_bearer_token)):
    try:
        result = revoke_session(session_token)
        return {"success": True, **result}
    except FirebaseAdminConfigError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "FIREBASE_ADMIN_NOT_CONFIGURED", "message": str(exc)},
        ) from exc
    except McpAuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.error_code, "message": exc.message},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKEND_ERROR", "message": str(exc)},
        ) from exc
