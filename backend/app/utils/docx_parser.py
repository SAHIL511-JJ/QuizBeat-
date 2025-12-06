from typing import Dict, List, Any
from docx import Document


def extract_text_from_docx(file_path: str) -> Dict[str, Any]:
    """
    Extract text from a Word document and detect chapters using heading styles.
    """
    doc = Document(file_path)
    full_text = ""
    chapters = []
    current_chapter = None
    current_content = []
    
    for para in doc.paragraphs:
        text = para.text.strip()
        
        if not text:
            continue
        
        # Check if this is a heading (chapter/section)
        style_name = para.style.name.lower() if para.style else ""
        
        is_heading = (
            "heading" in style_name or
            "title" in style_name or
            text.lower().startswith(("chapter ", "unit ", "module ", "part "))
        )
        
        if is_heading and len(text) < 100:  # Headings are usually short
            # Save previous chapter
            if current_chapter:
                chapters.append({
                    "title": current_chapter,
                    "content": "\n".join(current_content)[:5000]
                })
            
            current_chapter = text
            current_content = []
        else:
            current_content.append(text)
        
        full_text += text + "\n"
    
    # Save last chapter
    if current_chapter:
        chapters.append({
            "title": current_chapter,
            "content": "\n".join(current_content)[:5000]
        })
    elif current_content:
        # No chapters found, create one
        chapters.append({
            "title": "Full Document",
            "content": "\n".join(current_content)[:5000]
        })
    
    return {
        "text": full_text.strip(),
        "chapters": chapters if chapters else [{"title": "Full Document", "content": full_text[:5000]}]
    }
