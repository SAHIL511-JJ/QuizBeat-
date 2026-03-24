"""
QuizBeat MCP Server - V1

Exposes tools over stdio for:
  - account login/logout/status
  - document upload
  - quiz generation
  - quiz save

Launched by the IDE automatically via MCP config. No manual scripts needed.
"""

import json
import logging
import sys
from pathlib import Path

# Ensure sibling modules are importable regardless of working directory
_THIS_DIR = Path(__file__).resolve().parent
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

from mcp.server.fastmcp import FastMCP

import auth_client
import auth_store
import backend_client
import quiz_store
import session_store

# ---------------------------------------------------------------------------
# Logging - stderr only (stdout is reserved for MCP stdio protocol)
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("quizbeat-mcp")

# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------
mcp = FastMCP("QuizBeat")

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


# ---------------------------------------------------------------------------
# Tool: login
# ---------------------------------------------------------------------------
@mcp.tool()
async def login(login_code: str) -> str:
    """
    Connect this MCP session to a QuizBeat account using a one-time login code.

    Args:
        login_code: One-time code generated from the QuizBeat web app.
    """
    normalized_code = (login_code or "").strip()
    if not normalized_code:
        return _error("login_code is required.")

    try:
        result = await auth_client.login(normalized_code)
    except ConnectionError as e:
        return _error(str(e))
    except RuntimeError as e:
        return _error(str(e))
    except Exception as e:
        return _error(f"Unexpected login error: {e}")

    session = {
        "session_token": result.get("session_token"),
        "uid": result.get("uid"),
        "email": result.get("email", ""),
        "display_name": result.get("display_name", ""),
        "issued_at": result.get("issued_at"),
        "expires_at": result.get("expires_at"),
    }
    auth_store.save_session(session)

    return _success({
        "authenticated": True,
        "uid": session["uid"],
        "email": session["email"],
        "display_name": session["display_name"],
        "expires_at": session["expires_at"],
        "session_file": auth_store.get_session_file_path(),
    })


# ---------------------------------------------------------------------------
# Tool: whoami
# ---------------------------------------------------------------------------
@mcp.tool()
async def whoami(verify: bool = False) -> str:
    """
    Show which QuizBeat account is currently active for this MCP server.

    Args:
        verify: When true, confirm the stored session with the backend.
    """
    session = auth_store.load_session()
    if session is None:
        return _success({
            "authenticated": False,
            "message": "No active QuizBeat session.",
        })

    if auth_store.is_session_expired(session):
        auth_store.clear_session()
        return _success({
            "authenticated": False,
            "message": "Stored QuizBeat session has expired. Please log in again.",
        })

    if verify:
        try:
            verified = await auth_client.whoami(session["session_token"])
        except ConnectionError as e:
            return _error(str(e))
        except RuntimeError as e:
            message = str(e)
            if message.startswith("SESSION_") or message.startswith("NOT_LOGGED_IN"):
                auth_store.clear_session()
                return _success({
                    "authenticated": False,
                    "message": message,
                })
            return _error(message)
        except Exception as e:
            return _error(f"Unexpected whoami error: {e}")

        session.update({
            "uid": verified.get("uid", session.get("uid")),
            "email": verified.get("email", session.get("email", "")),
            "display_name": verified.get("display_name", session.get("display_name", "")),
            "issued_at": verified.get("issued_at", session.get("issued_at")),
            "expires_at": verified.get("expires_at", session.get("expires_at")),
        })
        auth_store.save_session(session)

    return _success({
        "authenticated": True,
        "uid": session.get("uid"),
        "email": session.get("email", ""),
        "display_name": session.get("display_name", ""),
        "expires_at": session.get("expires_at"),
        "verified": verify,
    })


# ---------------------------------------------------------------------------
# Tool: logout
# ---------------------------------------------------------------------------
@mcp.tool()
async def logout() -> str:
    """
    Log out the current QuizBeat account from this MCP server.
    """
    session = auth_store.load_session()
    if session is None:
        return _success({
            "logged_out": False,
            "message": "No active QuizBeat session.",
        })

    backend_revoked = True
    warning = None

    try:
        await auth_client.logout(session["session_token"])
    except (ConnectionError, RuntimeError) as e:
        backend_revoked = False
        warning = str(e)
    except Exception as e:
        backend_revoked = False
        warning = f"Unexpected logout error: {e}"

    auth_store.clear_session()

    payload = {
        "logged_out": True,
        "backend_revoked": backend_revoked,
        "message": "QuizBeat session cleared from MCP.",
    }
    if warning:
        payload["warning"] = warning

    return _success(payload)


# ---------------------------------------------------------------------------
# Tool: upload_document
# ---------------------------------------------------------------------------
@mcp.tool()
async def upload_document(file_path: str) -> str:
    """
    Upload a document (PDF, DOCX, or TXT) to the QuizBeat backend.

    The parsed text and chapters are stored in the current MCP session.
    Returns a document_id you can pass to generate_quiz.

    Args:
        file_path: Absolute path to the document file on disk.
    """
    logger.info(f"upload_document called with: {file_path}")

    # --- Validate file path ---
    path = Path(file_path)

    if not path.exists():
        return _error(f"File not found: {file_path}")

    if not path.is_file():
        return _error(f"Path is not a file: {file_path}")

    ext = path.suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return _error(
            f"Unsupported file type '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # --- Upload to backend ---
    try:
        data = await backend_client.upload_document(file_path)
    except ConnectionError as e:
        return _error(str(e))
    except RuntimeError as e:
        return _error(str(e))
    except Exception as e:
        return _error(f"Unexpected upload error: {e}")

    # --- Store in session ---
    full_text = data.get("text", "")
    if not full_text:
        full_text = "\n\n".join(
            ch.get("content", "") for ch in data.get("chapters", [])
        )

    chapters = data.get("chapters", [])
    total_chars = data.get("total_chars", len(full_text))

    document_id = session_store.add_document(
        filename=data.get("filename", path.name),
        text=full_text,
        chapters=chapters,
        total_chars=total_chars,
    )

    logger.info(
        f"Document stored: id={document_id}, "
        f"chars={total_chars}, chapters={len(chapters)}"
    )

    # --- Return summary ---
    return _success({
        "document_id": document_id,
        "filename": data.get("filename", path.name),
        "total_chars": total_chars,
        "chapter_count": len(chapters),
        "chapter_titles": [ch.get("title", "Untitled") for ch in chapters],
    })


# ---------------------------------------------------------------------------
# Tool: generate_quiz
# ---------------------------------------------------------------------------
@mcp.tool()
async def generate_quiz(
    document_id: str,
    difficulty: str = "medium",
    num_questions: int = 10,
    chapter_titles: list[str] | None = None,
) -> str:
    """
    Generate a quiz from a previously uploaded document.

    Args:
        document_id: The ID returned by upload_document.
        difficulty: One of 'easy', 'medium', or 'hard'. Defaults to 'medium'.
        num_questions: Number of questions to generate (1-50). Defaults to 10.
        chapter_titles: Optional list of chapter titles to quiz on. If omitted, the full document is used.
    """
    logger.info(
        f"generate_quiz called: doc={document_id}, "
        f"difficulty={difficulty}, n={num_questions}, chapters={chapter_titles}"
    )

    # --- Validate document ---
    doc = session_store.get_document(document_id)
    if doc is None:
        available = session_store.list_documents()
        if available:
            summary = "\n".join(
                f"  - {d['document_id']} - {d['filename']}"
                for d in available
            )
            return _error(
                f"Document ID '{document_id}' not found.\n"
                f"Available documents:\n{summary}"
            )
        return _error(
            f"Document ID '{document_id}' not found. "
            "No documents uploaded yet - use upload_document first."
        )

    # --- Validate difficulty ---
    valid_difficulties = ("easy", "medium", "hard")
    if difficulty not in valid_difficulties:
        return _error(
            f"Invalid difficulty '{difficulty}'. "
            f"Must be one of: {', '.join(valid_difficulties)}"
        )

    # --- Validate num_questions (1-50, mirroring backend) ---
    if not (1 <= num_questions <= 50):
        return _error(
            f"num_questions must be between 1 and 50, got {num_questions}"
        )

    # --- Build content ---
    if chapter_titles:
        chapter_map = {ch["title"]: ch["content"] for ch in doc["chapters"]}
        missing = [t for t in chapter_titles if t not in chapter_map]
        if missing:
            available_titles = list(chapter_map.keys())
            return _error(
                f"Chapter(s) not found: {missing}\n"
                f"Available chapters: {available_titles}"
            )
        content = "\n\n".join(chapter_map[t] for t in chapter_titles)
        selected = chapter_titles
    else:
        content = doc["text"]
        selected = [ch.get("title", "Untitled") for ch in doc["chapters"]]

    # --- Validate content length (>=100 chars, mirroring backend) ---
    if len(content) < 100:
        return _error(
            f"Selected content is too short ({len(content)} chars). "
            "At least 100 characters are required for quiz generation. "
            "Try selecting more chapters or uploading a longer document."
        )

    # --- Call backend ---
    try:
        result = await backend_client.generate_quiz(
            content=content,
            difficulty=difficulty,
            num_questions=num_questions,
        )
    except ConnectionError as e:
        return _error(str(e))
    except RuntimeError as e:
        return _error(str(e))
    except Exception as e:
        return _error(f"Unexpected quiz generation error: {e}")

    questions = result.get("questions", [])
    logger.info(f"Quiz generated: {len(questions)} questions")

    resolved_difficulty = result.get("difficulty", difficulty)
    default_title = _default_quiz_title(doc["filename"], resolved_difficulty)

    quiz_id = quiz_store.add_quiz(
        document_id=document_id,
        source_filename=doc["filename"],
        difficulty=resolved_difficulty,
        num_questions=len(questions),
        selected_chapters=selected,
        questions=questions,
        title=default_title,
        source="ai",
    )

    return _success({
        "quiz_id": quiz_id,
        "document_id": document_id,
        "title": default_title,
        "source_filename": doc["filename"],
        "difficulty": resolved_difficulty,
        "num_questions": len(questions),
        "selected_chapters": selected,
        "source": "ai",
        "textbook": doc["filename"],
        "questions": questions,
    })


# ---------------------------------------------------------------------------
# Tool: save_quiz
# ---------------------------------------------------------------------------
@mcp.tool()
async def save_quiz(
    quiz_id: str,
    title: str | None = None,
    source: str = "ai",
) -> str:
    """
    Save a previously generated quiz to the logged-in QuizBeat account.

    Args:
        quiz_id: The quiz ID returned by generate_quiz.
        title: Optional title override for the saved quiz.
        source: Source label to save with the quiz. Defaults to 'ai'.
    """
    session = auth_store.load_session()
    if session is None:
        return _error("NOT_LOGGED_IN: Please log in to QuizBeat first.")

    if auth_store.is_session_expired(session):
        auth_store.clear_session()
        return _error("SESSION_EXPIRED: Stored QuizBeat session has expired. Please log in again.")

    quiz = quiz_store.get_quiz(quiz_id)
    if quiz is None:
        return _error(f"QUIZ_NOT_FOUND: Quiz ID '{quiz_id}' was not found in the current MCP session.")

    questions = quiz.get("questions") or []
    if not questions:
        return _error("INVALID_QUIZ_PAYLOAD: Generated quiz has no questions to save.")

    normalized_source = (source or "ai").strip() or "ai"
    normalized_title = (title or "").strip() or (quiz.get("title", "").strip()) or _default_quiz_title(
        quiz.get("source_filename", "Quiz"),
        quiz.get("difficulty", "medium"),
    )

    try:
        result = await backend_client.save_quiz(
            session_token=session["session_token"],
            title=normalized_title,
            questions=questions,
            difficulty=quiz.get("difficulty", "medium"),
            source=normalized_source,
            textbook=quiz.get("source_filename", ""),
            chapters=quiz.get("selected_chapters", []),
        )
    except ConnectionError as e:
        return _error(str(e))
    except RuntimeError as e:
        message = str(e)
        if "SESSION_" in message or "NOT_LOGGED_IN" in message:
            auth_store.clear_session()
        return _error(message)
    except Exception as e:
        return _error(f"Unexpected quiz save error: {e}")

    saved_quiz_id = result.get("saved_quiz_id")
    if saved_quiz_id:
        quiz_store.link_saved_quiz_id(quiz_id, saved_quiz_id)
    quiz_store.update_quiz_metadata(
        quiz_id,
        {
            "title": result.get("title", normalized_title),
            "source": normalized_source,
            "textbook": quiz.get("source_filename", ""),
            "chapters": quiz.get("selected_chapters", []),
        },
    )

    return _success({
        "saved": True,
        "quiz_id": quiz_id,
        "saved_quiz_id": saved_quiz_id,
        "title": result.get("title", normalized_title),
        "num_questions": result.get("num_questions", len(questions)),
        "difficulty": result.get("difficulty", quiz.get("difficulty", "medium")),
        "creator_id": result.get("creator_id", session.get("uid")),
        "creator_name": result.get("creator_name", session.get("display_name", "")),
    })


@mcp.tool()
async def edit_quiz(
    quiz_id: str | None = None,
    saved_quiz_id: str | None = None,
    title: str | None = None,
    difficulty: str | None = None,
    source: str | None = None,
    textbook: str | None = None,
    chapters: list[str] | None = None,
    question_updates: list[dict] | None = None,
    add_questions: list[dict] | None = None,
    remove_question_indexes: list[int] | None = None,
    persist_saved_quiz: bool | None = None,
) -> str:
    """
    Edit generated or saved quiz content and metadata.
    """
    if not quiz_id and not saved_quiz_id:
        return _error("INVALID_EDIT_REQUEST: Provide at least one target: quiz_id or saved_quiz_id.")

    quiz: dict | None = None
    resolved_quiz_id = quiz_id

    if resolved_quiz_id:
        quiz = quiz_store.get_quiz(resolved_quiz_id)
        if quiz is None:
            return _error(f"QUIZ_NOT_FOUND: Quiz ID '{resolved_quiz_id}' was not found in the current MCP session.")

    requires_saved_lookup = bool(saved_quiz_id and quiz is None)
    session = None
    if requires_saved_lookup:
        session = auth_store.load_session()
        if session is None:
            return _error("NOT_LOGGED_IN: Please log in to QuizBeat first.")
        if auth_store.is_session_expired(session):
            auth_store.clear_session()
            return _error("SESSION_EXPIRED: Stored QuizBeat session has expired. Please log in again.")

        try:
            fetched = await backend_client.get_saved_quiz(
                session_token=session["session_token"],
                saved_quiz_id=saved_quiz_id,
            )
        except ConnectionError as e:
            return _error(str(e))
        except RuntimeError as e:
            message = str(e)
            if "SESSION_" in message or "NOT_LOGGED_IN" in message:
                auth_store.clear_session()
            if message.startswith("QUIZ_NOT_FOUND"):
                message = message.replace("QUIZ_NOT_FOUND", "SAVED_QUIZ_NOT_FOUND", 1)
            return _error(message)
        except Exception as e:
            return _error(f"Unexpected quiz fetch error: {e}")

        try:
            resolved_quiz_id = quiz_store.upsert_saved_quiz_cache(fetched)
            quiz = quiz_store.get_quiz(resolved_quiz_id)
        except Exception as e:
            return _error(f"INVALID_EDIT_REQUEST: Could not cache saved quiz payload: {e}")

    if quiz is None:
        return _error("QUIZ_NOT_FOUND: Unable to resolve quiz target.")

    resolved_saved_quiz_id = saved_quiz_id or quiz.get("saved_quiz_id")
    if saved_quiz_id and persist_saved_quiz is None:
        should_persist_saved = True
    elif persist_saved_quiz is True:
        should_persist_saved = True
    else:
        should_persist_saved = False

    if should_persist_saved and not resolved_saved_quiz_id:
        return _error("INVALID_EDIT_REQUEST: persist_saved_quiz=true requires a linked saved quiz id.")

    updated_fields: list[str] = []
    metadata_updates = {}
    if title is not None:
        metadata_updates["title"] = title
        updated_fields.append("title")
    if difficulty is not None:
        metadata_updates["difficulty"] = difficulty
        updated_fields.append("difficulty")
    if source is not None:
        metadata_updates["source"] = source
        updated_fields.append("source")
    if textbook is not None:
        metadata_updates["textbook"] = textbook
        updated_fields.append("textbook")
    if chapters is not None:
        metadata_updates["chapters"] = chapters
        updated_fields.append("chapters")

    try:
        if metadata_updates:
            quiz_store.update_quiz_metadata(resolved_quiz_id, metadata_updates)
        if question_updates:
            quiz_store.apply_question_updates(resolved_quiz_id, question_updates)
            updated_fields.append("question_updates")
        if add_questions:
            quiz_store.add_questions(resolved_quiz_id, add_questions)
            updated_fields.append("add_questions")
        if remove_question_indexes:
            quiz_store.remove_questions(resolved_quiz_id, remove_question_indexes)
            updated_fields.append("remove_question_indexes")
    except (KeyError, IndexError, ValueError) as e:
        return _error(f"INVALID_EDIT_REQUEST: {e}")

    quiz = quiz_store.get_quiz(resolved_quiz_id)
    try:
        validated = _validate_editable_payload({
            "title": quiz.get("title", ""),
            "questions": quiz.get("questions", []),
            "difficulty": quiz.get("difficulty", "medium"),
            "source": quiz.get("source", "ai"),
            "textbook": quiz.get("textbook", quiz.get("source_filename", "")),
            "chapters": quiz.get("chapters", quiz.get("selected_chapters", [])),
        })
    except ValueError as e:
        return _error(f"INVALID_QUIZ_PAYLOAD: {e}")

    quiz_store.update_quiz_metadata(
        resolved_quiz_id,
        {
            "title": validated["title"],
            "difficulty": validated["difficulty"],
            "source": validated["source"],
            "textbook": validated["textbook"],
            "chapters": validated["chapters"],
        },
    )
    quiz["questions"] = validated["questions"]
    quiz["num_questions"] = len(validated["questions"])

    persisted = False
    if should_persist_saved and resolved_saved_quiz_id:
        if session is None:
            session = auth_store.load_session()
            if session is None:
                return _error("NOT_LOGGED_IN: Please log in to QuizBeat first.")
            if auth_store.is_session_expired(session):
                auth_store.clear_session()
                return _error("SESSION_EXPIRED: Stored QuizBeat session has expired. Please log in again.")

        try:
            result = await backend_client.update_saved_quiz(
                session_token=session["session_token"],
                saved_quiz_id=resolved_saved_quiz_id,
                payload=validated,
            )
            persisted = True
            quiz_store.link_saved_quiz_id(resolved_quiz_id, resolved_saved_quiz_id)
            quiz_store.update_quiz_metadata(
                resolved_quiz_id,
                {
                    "title": result.get("title", validated["title"]),
                    "difficulty": result.get("difficulty", validated["difficulty"]),
                    "source": result.get("source", validated["source"]),
                    "textbook": result.get("textbook", validated["textbook"]),
                    "chapters": result.get("chapters", validated["chapters"]),
                },
            )
            quiz["questions"] = validated["questions"]
            quiz["num_questions"] = result.get("num_questions", len(validated["questions"]))
        except ConnectionError as e:
            return _error(str(e))
        except RuntimeError as e:
            message = str(e)
            if "SESSION_" in message or "NOT_LOGGED_IN" in message:
                auth_store.clear_session()
            if message.startswith("QUIZ_NOT_FOUND"):
                message = message.replace("QUIZ_NOT_FOUND", "SAVED_QUIZ_NOT_FOUND", 1)
            return _error(message)
        except Exception as e:
            return _error(f"Unexpected quiz update error: {e}")

    quiz = quiz_store.get_quiz(resolved_quiz_id)
    return _success({
        "quiz_id": resolved_quiz_id,
        "saved_quiz_id": quiz.get("saved_quiz_id"),
        "persisted": persisted,
        "title": quiz.get("title", ""),
        "difficulty": quiz.get("difficulty", "medium"),
        "num_questions": quiz.get("num_questions", len(quiz.get("questions", []))),
        "updated_fields": updated_fields,
    })


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _success(data: dict) -> str:
    """Format a successful tool response as JSON."""
    return json.dumps({"status": "success", **data}, indent=2)


def _error(message: str) -> str:
    """Format an error tool response as JSON."""
    logger.error(message)
    return json.dumps({"status": "error", "message": message}, indent=2)


def _default_quiz_title(source_filename: str, difficulty: str) -> str:
    stem = Path(source_filename).stem if source_filename else "Quiz"
    normalized_difficulty = (difficulty or "medium").strip().capitalize()
    return f"{stem} - {normalized_difficulty} quiz"


def _validate_editable_payload(payload: dict) -> dict:
    title = (payload.get("title") or "").strip()
    if not title:
        raise ValueError("Quiz title is required.")

    difficulty = (payload.get("difficulty") or "medium").strip().lower()
    if difficulty not in {"easy", "medium", "hard"}:
        raise ValueError("Difficulty must be one of: easy, medium, hard.")

    questions = payload.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError("Quiz must contain at least one question.")

    normalized_questions = []
    for index, question in enumerate(questions, start=1):
        normalized_questions.append(_validate_editable_question(question, index))

    source = (payload.get("source") or "ai").strip() or "ai"
    textbook = (payload.get("textbook") or "").strip()
    chapters = payload.get("chapters") or []
    if not isinstance(chapters, list):
        raise ValueError("Chapters must be a list.")
    normalized_chapters = []
    for chapter in chapters:
        if not isinstance(chapter, str):
            raise ValueError("Each chapter title must be a string.")
        chapter_title = chapter.strip()
        if chapter_title:
            normalized_chapters.append(chapter_title)

    return {
        "title": title,
        "questions": normalized_questions,
        "difficulty": difficulty,
        "source": source,
        "textbook": textbook,
        "chapters": normalized_chapters,
    }


def _validate_editable_question(question: dict, index: int) -> dict:
    if not isinstance(question, dict):
        raise ValueError(f"Question {index} must be an object.")

    question_text = question.get("question")
    if not isinstance(question_text, str) or not question_text.strip():
        raise ValueError(f"Question {index} must include non-empty question text.")

    options = question.get("options")
    if not isinstance(options, list) or len(options) != 4:
        raise ValueError(f"Question {index} must include exactly 4 options.")
    normalized_options = []
    for option_index, option in enumerate(options, start=1):
        if not isinstance(option, str) or not option.strip():
            raise ValueError(
                f"Question {index} option {option_index} must be a non-empty string."
            )
        normalized_options.append(option.strip())

    correct = question.get("correct")
    if not isinstance(correct, int) or not (0 <= correct <= 3):
        raise ValueError(f"Question {index} correct answer must be an integer between 0 and 3.")

    return {
        "question": question_text.strip(),
        "options": normalized_options,
        "correct": correct,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("Starting QuizBeat MCP server (stdio)...")
    mcp.run(transport="stdio")
