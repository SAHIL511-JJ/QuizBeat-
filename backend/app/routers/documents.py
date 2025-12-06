from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import tempfile
import os

from app.utils.pdf_parser import extract_text_from_pdf
from app.utils.docx_parser import extract_text_from_docx

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and parse a document (PDF, DOCX, TXT).
    Returns extracted text with detected chapters.
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
    ]
    
    file_extension = file.filename.split(".")[-1].lower()
    
    if file_extension not in ["pdf", "docx", "txt"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload PDF, DOCX, or TXT files."
        )
    
    # Read file content
    content = await file.read()
    
    # Create temp file for processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
        temp_file.write(content)
        temp_path = temp_file.name
    
    try:
        # Extract text based on file type
        if file_extension == "pdf":
            result = extract_text_from_pdf(temp_path)
        elif file_extension == "docx":
            result = extract_text_from_docx(temp_path)
        else:  # txt
            with open(temp_path, "r", encoding="utf-8") as f:
                text = f.read()
            result = {
                "text": text,
                "chapters": [{"title": "Full Document", "content": text}]
            }
        
        return {
            "filename": file.filename,
            "total_chars": len(result["text"]),
            "chapters": result["chapters"],
            "full_text": result["text"][:1000] + "..." if len(result["text"]) > 1000 else result["text"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
    
    finally:
        # Cleanup temp file
        os.unlink(temp_path)


@router.get("/textbooks/{textbook_id}/chapters")
async def get_chapters(textbook_id: str):
    """
    Get chapters for a specific textbook.
    Note: In production, this would fetch from Firebase.
    """
    # Placeholder - in real app, fetch from Firebase
    return {
        "textbook_id": textbook_id,
        "chapters": []
    }
