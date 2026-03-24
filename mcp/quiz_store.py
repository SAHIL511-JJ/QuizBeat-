"""
In-memory store for generated quizzes.
Data survives only while the MCP server process is running.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


_quizzes: dict[str, dict[str, Any]] = {}


def add_quiz(
    *,
    document_id: str,
    source_filename: str,
    difficulty: str,
    num_questions: int,
    selected_chapters: list[str],
    questions: list[dict[str, Any]],
    title: str = "",
    origin: str = "generated",
    saved_quiz_id: str | None = None,
    source: str = "ai",
) -> str:
    quiz_id = f"quiz_{uuid4().hex[:8]}"
    now = _now_iso()
    _quizzes[quiz_id] = {
        "quiz_id": quiz_id,
        "document_id": document_id,
        "source_filename": source_filename,
        "title": (title or "").strip(),
        "difficulty": difficulty,
        "num_questions": num_questions,
        "selected_chapters": selected_chapters,
        "chapters": selected_chapters,
        "questions": questions,
        "origin": origin,
        "saved_quiz_id": saved_quiz_id,
        "source": (source or "ai").strip() or "ai",
        "textbook": source_filename,
        "created_at": now,
        "updated_at": now,
    }
    return quiz_id


def get_quiz(quiz_id: str) -> dict[str, Any] | None:
    return _quizzes.get(quiz_id)


def list_quizzes() -> list[dict[str, Any]]:
    return [
        {
            "quiz_id": quiz["quiz_id"],
            "document_id": quiz["document_id"],
            "source_filename": quiz["source_filename"],
            "title": quiz.get("title", ""),
            "difficulty": quiz["difficulty"],
            "num_questions": quiz["num_questions"],
            "origin": quiz.get("origin", "generated"),
            "saved_quiz_id": quiz.get("saved_quiz_id"),
            "created_at": quiz["created_at"],
            "updated_at": quiz.get("updated_at", quiz["created_at"]),
        }
        for quiz in _quizzes.values()
    ]


def update_quiz_metadata(quiz_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    quiz = _require_quiz(quiz_id)

    if "title" in updates and updates["title"] is not None:
        quiz["title"] = str(updates["title"]).strip()
    if "difficulty" in updates and updates["difficulty"] is not None:
        quiz["difficulty"] = str(updates["difficulty"]).strip().lower()
    if "source" in updates and updates["source"] is not None:
        quiz["source"] = str(updates["source"]).strip() or "ai"
    if "textbook" in updates and updates["textbook"] is not None:
        textbook = str(updates["textbook"]).strip()
        quiz["textbook"] = textbook
        quiz["source_filename"] = textbook
    if "selected_chapters" in updates and updates["selected_chapters"] is not None:
        chapters = list(updates["selected_chapters"])
        quiz["selected_chapters"] = chapters
        quiz["chapters"] = chapters
    if "chapters" in updates and updates["chapters"] is not None:
        chapters = list(updates["chapters"])
        quiz["selected_chapters"] = chapters
        quiz["chapters"] = chapters

    _touch(quiz)
    return quiz


def apply_question_updates(quiz_id: str, question_updates: list[dict[str, Any]]) -> dict[str, Any]:
    quiz = _require_quiz(quiz_id)
    questions = quiz.get("questions") or []

    for update in question_updates or []:
        if not isinstance(update, dict):
            raise ValueError("Each question update must be an object.")
        if "index" not in update:
            raise ValueError("Question update requires an 'index'.")

        index = update["index"]
        if not isinstance(index, int):
            raise ValueError("Question update index must be an integer.")
        if index < 0 or index >= len(questions):
            raise IndexError(f"Question index out of range: {index}")

        current = questions[index]
        if "question" in update and update["question"] is not None:
            current["question"] = str(update["question"])

        if "options" in update and update["options"] is not None:
            options = list(update["options"])
            if len(options) != 4:
                raise ValueError("Question options must contain exactly 4 entries.")
            current["options"] = options

        for option_update in update.get("option_updates", []) or []:
            if not isinstance(option_update, dict):
                raise ValueError("Each option update must be an object.")
            option_index = option_update.get("option_index")
            if not isinstance(option_index, int):
                raise ValueError("option_index must be an integer.")
            if option_index < 0 or option_index >= 4:
                raise IndexError(f"Option index out of range: {option_index}")
            current["options"][option_index] = str(option_update.get("value", ""))

        if "correct" in update and update["correct"] is not None:
            current["correct"] = update["correct"]

    _touch(quiz)
    return quiz


def add_questions(quiz_id: str, questions: list[dict[str, Any]]) -> dict[str, Any]:
    quiz = _require_quiz(quiz_id)
    to_add = list(questions or [])
    quiz.setdefault("questions", []).extend(to_add)
    quiz["num_questions"] = len(quiz["questions"])
    _touch(quiz)
    return quiz


def remove_questions(quiz_id: str, indexes: list[int]) -> dict[str, Any]:
    quiz = _require_quiz(quiz_id)
    questions = quiz.get("questions") or []
    if not indexes:
        return quiz

    normalized = sorted(set(indexes), reverse=True)
    for index in normalized:
        if not isinstance(index, int):
            raise ValueError("Question removal indexes must be integers.")
        if index < 0 or index >= len(questions):
            raise IndexError(f"Question index out of range: {index}")

    remaining = len(questions) - len(normalized)
    if remaining < 1:
        raise ValueError("Quiz must contain at least one question.")

    for index in normalized:
        questions.pop(index)

    quiz["num_questions"] = len(questions)
    _touch(quiz)
    return quiz


def link_saved_quiz_id(quiz_id: str, saved_quiz_id: str) -> dict[str, Any]:
    quiz = _require_quiz(quiz_id)
    quiz["saved_quiz_id"] = saved_quiz_id
    quiz["origin"] = "saved"
    _touch(quiz)
    return quiz


def upsert_saved_quiz_cache(saved_quiz_payload: dict[str, Any]) -> str:
    quiz_data = saved_quiz_payload.get("quiz", saved_quiz_payload)
    saved_quiz_id = quiz_data.get("id") or quiz_data.get("saved_quiz_id")
    if not saved_quiz_id:
        raise ValueError("Saved quiz payload missing quiz id.")

    for quiz_id, existing in _quizzes.items():
        if existing.get("saved_quiz_id") == saved_quiz_id:
            existing.update({
                "title": (quiz_data.get("title") or "").strip(),
                "questions": list(quiz_data.get("questions") or []),
                "difficulty": quiz_data.get("difficulty", "medium"),
                "num_questions": len(quiz_data.get("questions") or []),
                "source": quiz_data.get("source", "ai"),
                "textbook": quiz_data.get("textbook", ""),
                "source_filename": quiz_data.get("textbook", ""),
                "chapters": list(quiz_data.get("chapters") or []),
                "selected_chapters": list(quiz_data.get("chapters") or []),
                "origin": "saved",
                "saved_quiz_id": saved_quiz_id,
            })
            _touch(existing)
            return quiz_id

    return add_quiz(
        document_id="saved_quiz",
        source_filename=quiz_data.get("textbook", ""),
        difficulty=quiz_data.get("difficulty", "medium"),
        num_questions=len(quiz_data.get("questions") or []),
        selected_chapters=list(quiz_data.get("chapters") or []),
        questions=list(quiz_data.get("questions") or []),
        title=(quiz_data.get("title") or "").strip(),
        origin="saved",
        saved_quiz_id=saved_quiz_id,
        source=quiz_data.get("source", "ai"),
    )


def clear() -> None:
    _quizzes.clear()


def _require_quiz(quiz_id: str) -> dict[str, Any]:
    quiz = _quizzes.get(quiz_id)
    if quiz is None:
        raise KeyError(f"Quiz ID '{quiz_id}' was not found in cache.")
    return quiz


def _touch(quiz: dict[str, Any]) -> None:
    quiz["updated_at"] = _now_iso()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
