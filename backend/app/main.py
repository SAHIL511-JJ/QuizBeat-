from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(
    title="StudyQuiz API",
    description="Backend for StudyQuiz - AI-powered quiz platform",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from app.routers import documents, quiz

app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(quiz.router, prefix="/api", tags=["Quiz"])

@app.get("/")
async def root():
    return {"message": "StudyQuiz API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
