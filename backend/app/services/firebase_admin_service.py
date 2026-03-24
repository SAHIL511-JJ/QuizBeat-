import json
import logging
import os
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials, firestore

logger = logging.getLogger(__name__)


class FirebaseAdminConfigError(RuntimeError):
    """Raised when Firebase Admin credentials are missing or invalid."""


_firebase_app = None


def get_firebase_app():
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    credential, project_id = _build_firebase_credential()
    options = {"projectId": project_id} if project_id else None

    try:
        _firebase_app = firebase_admin.initialize_app(credential=credential, options=options)
    except ValueError:
        # Reuse an already initialized default app.
        _firebase_app = firebase_admin.get_app()

    return _firebase_app


def verify_firebase_id_token(id_token: str) -> dict[str, Any]:
    if not id_token:
        raise FirebaseAdminConfigError("Missing Firebase ID token.")

    try:
        return auth.verify_id_token(id_token, app=get_firebase_app())
    except FirebaseAdminConfigError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Failed to verify Firebase ID token: {exc}") from exc


def get_firestore_client():
    try:
        return firestore.client(app=get_firebase_app())
    except FirebaseAdminConfigError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Failed to create Firestore client: {exc}") from exc


def _build_firebase_credential():
    credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credential_path:
        path = Path(credential_path).expanduser()
        if not path.exists():
            raise FirebaseAdminConfigError(
                f"GOOGLE_APPLICATION_CREDENTIALS points to a missing file: {path}"
            )
        return credentials.Certificate(str(path)), os.getenv("FIREBASE_PROJECT_ID")

    raw_credentials = os.getenv("FIREBASE_CREDENTIALS")
    if raw_credentials:
        try:
            info = json.loads(raw_credentials)
        except json.JSONDecodeError as exc:
            raise FirebaseAdminConfigError(
                "FIREBASE_CREDENTIALS is not valid JSON."
            ) from exc
        return credentials.Certificate(info), info.get("project_id")

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    private_key = os.getenv("FIREBASE_PRIVATE_KEY")
    if project_id and client_email and private_key:
        info = {
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": private_key.replace("\\n", "\n"),
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        return credentials.Certificate(info), project_id

    raise FirebaseAdminConfigError(
        "Firebase Admin is not configured. Set FIREBASE_CREDENTIALS, "
        "GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
    )
