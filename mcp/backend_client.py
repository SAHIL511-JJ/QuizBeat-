"""
HTTP client helpers for the QuizBeat FastAPI backend.
"""

import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

# Load .env from the same directory as this file, not CWD
_THIS_DIR = Path(__file__).resolve().parent
load_dotenv(_THIS_DIR / ".env")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

# Generous timeout: document parsing + AI generation can be slow
_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


async def upload_document(file_path: str) -> dict[str, Any]:
    """
    Upload a document to POST /api/upload.
    Returns the parsed JSON response from the backend.
    """
    filename = os.path.basename(file_path)

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        with open(file_path, "rb") as f:
            files = {"file": (filename, f)}
            try:
                response = await client.post(
                    f"{BACKEND_URL}/api/upload",
                    files=files,
                )
            except httpx.ConnectError:
                raise ConnectionError(
                    f"Cannot reach backend at {BACKEND_URL}. "
                    "Is the FastAPI server running? "
                    "Start it with: cd c:\\kahoot\\backend && uvicorn app.main:app --port 8000"
                )

    if response.status_code != 200:
        raise RuntimeError(
            f"Backend upload failed (HTTP {response.status_code}): "
            f"{response.text[:500]}"
        )

    data = response.json()

    for field in ("filename", "chapters"):
        if field not in data:
            raise RuntimeError(
                f"Backend response missing required field '{field}'"
            )

    return data


async def generate_quiz(
    content: str, difficulty: str, num_questions: int
) -> dict[str, Any]:
    """
    Send content to POST /api/quiz/generate and return the response.
    """
    payload = {
        "content": content,
        "difficulty": difficulty,
        "num_questions": num_questions,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/api/quiz/generate",
                json=payload,
            )
        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot reach backend at {BACKEND_URL}. "
                "Is the FastAPI server running? "
                "Start it with: cd c:\\kahoot\\backend && uvicorn app.main:app --port 8000"
            )

    if response.status_code != 200:
        raise RuntimeError(
            f"Backend quiz generation failed (HTTP {response.status_code}): "
            f"{response.text[:500]}"
        )

    return response.json()


async def save_quiz(
    *,
    session_token: str,
    title: str,
    questions: list[dict[str, Any]],
    difficulty: str,
    source: str,
    textbook: str,
    chapters: list[str],
) -> dict[str, Any]:
    """
    Send a generated quiz to POST /api/mcp/quizzes/save and return the response.
    """
    payload = {
        "title": title,
        "questions": questions,
        "difficulty": difficulty,
        "source": source,
        "textbook": textbook,
        "chapters": chapters,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/api/mcp/quizzes/save",
                json=payload,
                headers={"Authorization": f"Bearer {session_token}"},
            )
        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot reach backend at {BACKEND_URL}. "
                "Is the FastAPI server running? "
                "Start it with: cd c:\\kahoot\\backend && uvicorn app.main:app --port 8000"
            )

    return _parse_json_response(response, "quiz save")


async def get_saved_quiz(
    *,
    session_token: str,
    saved_quiz_id: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.get(
                f"{BACKEND_URL}/api/mcp/quizzes/{saved_quiz_id}",
                headers={"Authorization": f"Bearer {session_token}"},
            )
        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot reach backend at {BACKEND_URL}. "
                "Is the FastAPI server running? "
                "Start it with: cd c:\\kahoot\\backend && uvicorn app.main:app --port 8000"
            )

    return _parse_json_response(response, "quiz fetch")


async def update_saved_quiz(
    *,
    session_token: str,
    saved_quiz_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.patch(
                f"{BACKEND_URL}/api/mcp/quizzes/{saved_quiz_id}",
                json=payload,
                headers={"Authorization": f"Bearer {session_token}"},
            )
        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot reach backend at {BACKEND_URL}. "
                "Is the FastAPI server running? "
                "Start it with: cd c:\\kahoot\\backend && uvicorn app.main:app --port 8000"
            )

    return _parse_json_response(response, "quiz update")


def _parse_json_response(response: httpx.Response, action: str) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(
            f"Backend {action} response was not valid JSON (HTTP {response.status_code})."
        ) from exc

    if response.status_code >= 400:
        detail = payload.get("detail", payload)
        if isinstance(detail, dict):
            code = detail.get("code", "BACKEND_ERROR")
            message = detail.get("message", "Unknown backend error.")
            raise RuntimeError(f"{code}: {message}")
        raise RuntimeError(str(detail))

    return payload
