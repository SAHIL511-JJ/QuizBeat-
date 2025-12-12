import os
import json
import re
import logging
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Log environment check on module load
logger.info("=" * 50)
logger.info("GROQ SERVICE INITIALIZING")
api_key = os.getenv("GROQ_API_KEY")
if api_key:
    logger.info(f"GROQ_API_KEY found: {api_key[:10]}...{api_key[-4:]}")
else:
    logger.error("GROQ_API_KEY NOT FOUND IN ENVIRONMENT!")
logger.info("=" * 50)

# Initialize Groq client
client = None

def get_groq_client():
    global client
    if client is None:
        api_key = os.getenv("GROQ_API_KEY")
        logger.info(f"Creating Groq client...")
        if not api_key:
            logger.error("GROQ_API_KEY environment variable is not set!")
            raise ValueError("GROQ_API_KEY environment variable is not set")
        
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            logger.info("Groq client created successfully!")
        except Exception as e:
            logger.error(f"Failed to create Groq client: {e}")
            raise
    return client


async def generate_quiz(content: str, difficulty: str, num_questions: int) -> List[Dict[str, Any]]:
    """
    Generate quiz questions using Groq's Llama 70B model.
    """
    logger.info("generate_quiz() called")
    logger.info(f"Content length: {len(content)}, Difficulty: {difficulty}, Num: {num_questions}")
    
    try:
        groq = get_groq_client()
        logger.info("Got Groq client")
    except Exception as e:
        logger.error(f"Failed to get Groq client: {e}")
        raise
    
    difficulty_instructions = {
        "easy": "Create simple, straightforward questions that test basic understanding. Options should be clearly distinct.",
        "medium": "Create moderately challenging questions that test comprehension and application. Include some plausible distractors.",
        "hard": "Create challenging questions that test deep understanding and critical thinking. Distractors should be very plausible."
    }
    
    prompt = f"""You are an expert quiz creator. Based on the following educational content, generate exactly {num_questions} multiple choice questions.

DIFFICULTY LEVEL: {difficulty.upper()}
{difficulty_instructions[difficulty]}

CONTENT:
{content[:8000]}

INSTRUCTIONS:
1. Each question should have exactly 4 options (A, B, C, D)
2. Only ONE option should be correct
3. Questions should cover different aspects of the content
4. Questions should be clear and unambiguous
5. All options should be plausible
6. IMPORTANT: Keep options SHORT (1-4 words max). No full sentences as options.

OUTPUT FORMAT (JSON array only, no other text):
[
  {{
    "question": "Your question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }}
]

The "correct" field should be the index (0-3) of the correct answer.

Generate the quiz now:"""

    logger.info(f"Prompt created, length: {len(prompt)}")
    logger.info("Calling Groq API...")
    
    try:
        response = groq.chat.completions.create(
            model="llama-3.1-8b-instant",  # Using smaller, faster model
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4000
        )
        
        logger.info("Groq API call successful!")
        response_text = response.choices[0].message.content
        logger.info(f"Response length: {len(response_text)}")
        logger.debug(f"Response preview: {response_text[:500]}...")
        
        # Extract JSON from response
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            logger.info("JSON pattern found in response")
            questions = json.loads(json_match.group())
            logger.info(f"Parsed {len(questions)} questions from response")
            
            # Validate and clean questions
            validated_questions = []
            for i, q in enumerate(questions[:num_questions]):
                if ("question" in q and "options" in q and "correct" in q 
                    and len(q["options"]) == 4 and 0 <= q["correct"] <= 3):
                    validated_questions.append({
                        "question": q["question"],
                        "options": q["options"],
                        "correct": q["correct"]
                    })
                    logger.debug(f"Question {i+1} validated OK")
                else:
                    logger.warning(f"Question {i+1} failed validation: {q}")
            
            logger.info(f"Returning {len(validated_questions)} validated questions")
            return validated_questions
        else:
            logger.error("Could not find JSON array in response!")
            logger.error(f"Full response: {response_text}")
            raise ValueError("Could not parse quiz response from AI")
            
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise ValueError(f"Invalid JSON in AI response: {str(e)}")
    except Exception as e:
        logger.error(f"Groq API call failed: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        raise


async def generate_explanation(question: str, user_answer: str, correct_answer: str) -> str:
    """
    Generate an explanation for why an answer was wrong.
    """
    logger.info("generate_explanation() called")
    
    groq = get_groq_client()
    
    prompt = f"""You are a helpful tutor. A student answered a quiz question incorrectly. 
Please explain why their answer was wrong and why the correct answer is right.

QUESTION: {question}

STUDENT'S ANSWER: {user_answer}

CORRECT ANSWER: {correct_answer}

Provide a clear, concise explanation (2-3 sentences) that helps the student understand the concept better. Be encouraging but informative."""

    try:
        response = groq.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=300
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        logger.error(f"Explanation generation failed: {e}")
        return f"Unable to generate explanation: {str(e)}"
