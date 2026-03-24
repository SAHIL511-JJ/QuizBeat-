"""
In-memory session store for uploaded documents.
Data survives only while the MCP server process is running.
"""

from uuid import uuid4
from datetime import datetime, timezone
from typing import Any


# In-memory storage: document_id -> document data
_documents: dict[str, dict[str, Any]] = {}


def add_document(filename: str, text: str, chapters: list[dict], total_chars: int) -> str:
    """
    Store a parsed document and return its generated document_id.
    Uses a UUID-based ID like 'doc_a1b2c3d4'.
    """
    document_id = f"doc_{uuid4().hex[:8]}"
    _documents[document_id] = {
        "document_id": document_id,
        "filename": filename,
        "text": text,
        "chapters": chapters,
        "total_chars": total_chars,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    return document_id


def get_document(document_id: str) -> dict[str, Any] | None:
    """Retrieve a document by its ID, or None if not found."""
    return _documents.get(document_id)


def list_documents() -> list[dict[str, Any]]:
    """Return summary info for all stored documents."""
    return [
        {
            "document_id": doc["document_id"],
            "filename": doc["filename"],
            "total_chars": doc["total_chars"],
            "chapter_count": len(doc["chapters"]),
            "uploaded_at": doc["uploaded_at"],
        }
        for doc in _documents.values()
    ]


def clear() -> None:
    """Remove all stored documents."""
    _documents.clear()
