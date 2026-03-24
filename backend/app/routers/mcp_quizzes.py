from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.firebase_admin_service import FirebaseAdminConfigError
from app.services.mcp_auth_service import McpAuthError, validate_session
from app.services.quiz_persistence_service import (
    QuizPersistenceError,
    get_quiz_for_user,
    save_quiz_for_user,
    update_quiz_for_user,
)

router = APIRouter()


class SaveQuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct: int


class SaveQuizRequest(BaseModel):
    title: str
    questions: list[SaveQuizQuestion]
    difficulty: str = "medium"
    source: str = "ai"
    textbook: str = ""
    chapters: list[str] = Field(default_factory=list)


class UpdateQuizRequest(BaseModel):
    title: str | None = None
    questions: list[SaveQuizQuestion] | None = None
    difficulty: str | None = None
    source: str | None = None
    textbook: str | None = None
    chapters: list[str] | None = None


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


@router.post("/mcp/quizzes/save")
async def save_mcp_quiz(
    payload: SaveQuizRequest,
    session_token: str = Depends(_extract_bearer_token),
):
    try:
        user = validate_session(session_token, update_last_used=True)
        result = save_quiz_for_user(user, payload.model_dump())
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
    except QuizPersistenceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.error_code, "message": exc.message},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKEND_ERROR", "message": str(exc)},
        ) from exc


@router.get("/mcp/quizzes/{quiz_id}")
async def get_mcp_quiz(
    quiz_id: str,
    session_token: str = Depends(_extract_bearer_token),
):
    try:
        user = validate_session(session_token, update_last_used=True)
        quiz = get_quiz_for_user(user, quiz_id)
        return {"success": True, "quiz": quiz}
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
    except QuizPersistenceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.error_code, "message": exc.message},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKEND_ERROR", "message": str(exc)},
        ) from exc


@router.patch("/mcp/quizzes/{quiz_id}")
async def update_mcp_quiz(
    quiz_id: str,
    payload: UpdateQuizRequest,
    session_token: str = Depends(_extract_bearer_token),
):
    try:
        user = validate_session(session_token, update_last_used=True)
        result = update_quiz_for_user(
            user,
            quiz_id,
            payload.model_dump(exclude_none=True),
        )
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
    except QuizPersistenceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.error_code, "message": exc.message},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "BACKEND_ERROR", "message": str(exc)},
        ) from exc
