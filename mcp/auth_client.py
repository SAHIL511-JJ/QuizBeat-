"""
HTTP client helpers for QuizBeat MCP authentication routes.
"""

from pathlib import Path
import os
from typing import Any

import httpx
from dotenv import load_dotenv

_THIS_DIR = Path(__file__).resolve().parent
load_dotenv(_THIS_DIR / ".env")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


async def login(login_code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/api/mcp/auth/login",
                json={"login_code": login_code},
            )
        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot reach backend at {BACKEND_URL}. "
                "Is the FastAPI server running?"
            )

    return _parse_json_response(response, "login")


async def whoami(session_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.get(
                f"{BACKEND_URL}/api/mcp/auth/whoami",
                headers={"Authorization": f"Bearer {session_token}"},
            )
        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot reach backend at {BACKEND_URL}. "
                "Is the FastAPI server running?"
            )

    return _parse_json_response(response, "whoami")


async def logout(session_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/api/mcp/auth/logout",
                headers={"Authorization": f"Bearer {session_token}"},
            )
        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot reach backend at {BACKEND_URL}. "
                "Is the FastAPI server running?"
            )

    return _parse_json_response(response, "logout")


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
