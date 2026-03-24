import logging
from typing import Any

from firebase_admin import firestore as admin_firestore

from app.services.firebase_admin_service import get_firestore_client

logger = logging.getLogger(__name__)

QUIZZES_COLLECTION = "quizzes"
ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}


class QuizPersistenceError(RuntimeError):
    status_code = 400
    error_code = "INVALID_QUIZ_PAYLOAD"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class QuizNotFoundError(QuizPersistenceError):
    status_code = 404
    error_code = "QUIZ_NOT_FOUND"


class QuizForbiddenError(QuizPersistenceError):
    status_code = 403
    error_code = "QUIZ_FORBIDDEN"


def save_quiz_for_user(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    validated = _validate_payload(payload)
    creator_name = (
        user.get("display_name")
        or user.get("email")
        or "Anonymous"
    )

    db = get_firestore_client()
    quiz_doc = {
        "title": validated["title"],
        "questions": validated["questions"],
        "difficulty": validated["difficulty"],
        "numQuestions": len(validated["questions"]),
        "source": validated["source"],
        "textbook": validated["textbook"],
        "chapters": validated["chapters"],
        "creatorId": user["uid"],
        "creatorName": creator_name,
        "createdAt": admin_firestore.SERVER_TIMESTAMP,
        "updatedAt": admin_firestore.SERVER_TIMESTAMP,
    }

    doc_ref = db.collection(QUIZZES_COLLECTION).document()
    doc_ref.set(quiz_doc)

    logger.info("Saved quiz %s for user %s", doc_ref.id, user["uid"])

    return {
        "saved_quiz_id": doc_ref.id,
        "title": quiz_doc["title"],
        "num_questions": quiz_doc["numQuestions"],
        "difficulty": quiz_doc["difficulty"],
        "creator_id": quiz_doc["creatorId"],
        "creator_name": quiz_doc["creatorName"],
        "textbook": quiz_doc["textbook"],
        "chapters": quiz_doc["chapters"],
        "source": quiz_doc["source"],
    }


def get_quiz_for_user(user: dict[str, Any], quiz_id: str) -> dict[str, Any]:
    db = get_firestore_client()
    doc_ref = db.collection(QUIZZES_COLLECTION).document(quiz_id)
    snapshot = doc_ref.get()

    if not snapshot.exists:
        raise QuizNotFoundError(f"Quiz '{quiz_id}' not found.")

    data = snapshot.to_dict() or {}
    if data.get("creatorId") != user["uid"]:
        raise QuizForbiddenError("You can only view your own quizzes.")

    return {"id": snapshot.id, **data}


def update_quiz_for_user(
    user: dict[str, Any],
    quiz_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    db = get_firestore_client()
    doc_ref = db.collection(QUIZZES_COLLECTION).document(quiz_id)
    snapshot = doc_ref.get()

    if not snapshot.exists:
        raise QuizNotFoundError(f"Quiz '{quiz_id}' not found.")

    existing = snapshot.to_dict() or {}
    if existing.get("creatorId") != user["uid"]:
        raise QuizForbiddenError("You can only edit your own quizzes.")

    merged_payload = {
        "title": payload.get("title", existing.get("title", "")),
        "questions": payload.get("questions", existing.get("questions", [])),
        "difficulty": payload.get("difficulty", existing.get("difficulty", "medium")),
        "source": payload.get("source", existing.get("source", "ai")),
        "textbook": payload.get("textbook", existing.get("textbook", "")),
        "chapters": payload.get("chapters", existing.get("chapters", [])),
    }
    validated = _validate_payload(merged_payload)

    update_dict = {
        "title": validated["title"],
        "questions": validated["questions"],
        "difficulty": validated["difficulty"],
        "source": validated["source"],
        "textbook": validated["textbook"],
        "chapters": validated["chapters"],
        "numQuestions": len(validated["questions"]),
        "updatedAt": admin_firestore.SERVER_TIMESTAMP,
    }
    doc_ref.update(update_dict)

    return {
        "saved_quiz_id": quiz_id,
        "title": validated["title"],
        "num_questions": len(validated["questions"]),
        "difficulty": validated["difficulty"],
        "source": validated["source"],
        "textbook": validated["textbook"],
        "chapters": validated["chapters"],
    }


def _validate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    title = (payload.get("title") or "").strip()
    if not title:
        raise QuizPersistenceError("Quiz title is required.")

    questions = payload.get("questions")
    if not isinstance(questions, list) or not questions:
        raise QuizPersistenceError("Quiz must contain at least one question.")

    normalized_questions = [_validate_question(question, index) for index, question in enumerate(questions, start=1)]

    difficulty = (payload.get("difficulty") or "medium").strip().lower()
    if difficulty not in ALLOWED_DIFFICULTIES:
        raise QuizPersistenceError(
            f"Difficulty must be one of: {', '.join(sorted(ALLOWED_DIFFICULTIES))}."
        )

    source = (payload.get("source") or "ai").strip() or "ai"
    textbook = (payload.get("textbook") or "").strip()
    chapters = payload.get("chapters") or []
    if not isinstance(chapters, list):
        raise QuizPersistenceError("Chapters must be a list of strings.")

    normalized_chapters = []
    for chapter in chapters:
        if not isinstance(chapter, str):
            raise QuizPersistenceError("Each chapter title must be a string.")
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


def _validate_question(question: Any, index: int) -> dict[str, Any]:
    if not isinstance(question, dict):
        raise QuizPersistenceError(f"Question {index} must be an object.")

    question_text = question.get("question")
    if not isinstance(question_text, str) or not question_text.strip():
        raise QuizPersistenceError(f"Question {index} must include non-empty question text.")

    options = question.get("options")
    if not isinstance(options, list) or len(options) != 4:
        raise QuizPersistenceError(f"Question {index} must include exactly 4 options.")

    normalized_options = []
    for option_index, option in enumerate(options, start=1):
        if not isinstance(option, str) or not option.strip():
            raise QuizPersistenceError(
                f"Question {index} option {option_index} must be a non-empty string."
            )
        normalized_options.append(option.strip())

    correct = question.get("correct")
    if not isinstance(correct, int) or not (0 <= correct <= 3):
        raise QuizPersistenceError(f"Question {index} correct answer must be an integer between 0 and 3.")

    return {
        "question": question_text.strip(),
        "options": normalized_options,
        "correct": correct,
    }
