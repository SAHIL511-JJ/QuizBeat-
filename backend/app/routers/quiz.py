from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

from app.services.groq_service import generate_quiz, generate_explanation

router = APIRouter()


class QuizRequest(BaseModel):
    content: str
    difficulty: str = "medium"  # easy, medium, hard
    num_questions: int = 10
    chapters: Optional[List[str]] = None


class ExplanationRequest(BaseModel):
    question: str
    user_answer: str
    correct_answer: str


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct: int  # Index of correct option (0-3)


class QuizResponse(BaseModel):
    questions: List[QuizQuestion]
    difficulty: str
    num_questions: int


@router.post("/quiz/generate", response_model=QuizResponse)
async def create_quiz(request: QuizRequest):
    """
    Generate a quiz based on the provided content using AI.
    """
    logger.info("=" * 50)
    logger.info("QUIZ GENERATION REQUEST RECEIVED")
    logger.info(f"Content length: {len(request.content)} chars")
    logger.info(f"Difficulty: {request.difficulty}")
    logger.info(f"Num questions: {request.num_questions}")
    logger.info(f"Content preview: {request.content[:200]}...")
    logger.info("=" * 50)
    
    # Validation
    if not request.content or len(request.content) < 100:
        logger.error(f"VALIDATION FAILED: Content too short ({len(request.content)} chars)")
        raise HTTPException(
            status_code=400,
            detail="Content must be at least 100 characters long."
        )
    
    if request.num_questions < 1 or request.num_questions > 50:
        logger.error(f"VALIDATION FAILED: Invalid num_questions ({request.num_questions})")
        raise HTTPException(
            status_code=400,
            detail="Number of questions must be between 1 and 50."
        )
    
    if request.difficulty not in ["easy", "medium", "hard"]:
        logger.error(f"VALIDATION FAILED: Invalid difficulty ({request.difficulty})")
        raise HTTPException(
            status_code=400,
            detail="Difficulty must be 'easy', 'medium', or 'hard'."
        )
    
    logger.info("Validation passed. Calling generate_quiz...")
    
    try:
        questions = await generate_quiz(
            content=request.content,
            difficulty=request.difficulty,
            num_questions=request.num_questions
        )
        
        logger.info(f"SUCCESS! Generated {len(questions)} questions")
        logger.debug(f"Questions: {questions}")
        
        return QuizResponse(
            questions=questions,
            difficulty=request.difficulty,
            num_questions=len(questions)
        )
        
    except Exception as e:
        logger.error(f"QUIZ GENERATION FAILED!")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        import traceback
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating quiz: {str(e)}"
        )


@router.post("/quiz/explain")
async def explain_answer(request: ExplanationRequest):
    """
    Generate an explanation for why an answer was wrong.
    """
    logger.info("EXPLANATION REQUEST RECEIVED")
    logger.info(f"Question: {request.question}")
    
    try:
        explanation = await generate_explanation(
            question=request.question,
            user_answer=request.user_answer,
            correct_answer=request.correct_answer
        )
        
        logger.info(f"Explanation generated successfully")
        
        return {
            "question": request.question,
            "user_answer": request.user_answer,
            "correct_answer": request.correct_answer,
            "explanation": explanation
        }
        
    except Exception as e:
        logger.error(f"EXPLANATION FAILED: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating explanation: {str(e)}"
        )
