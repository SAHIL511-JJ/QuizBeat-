import re
import logging
from typing import Dict, List, Any
from PyPDF2 import PdfReader

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> Dict[str, Any]:
    """
    Extract text from a PDF file and detect chapter boundaries.
    Returns text and detected chapters.
    """
    logger.info("=" * 50)
    logger.info(f"PDF EXTRACTION STARTED: {file_path}")
    
    reader = PdfReader(file_path)
    full_text = ""
    page_texts = []
    
    logger.info(f"PDF has {len(reader.pages)} pages")
    
    # Extract text from each page
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        page_texts.append(text)
        full_text += text + "\n\n"
        logger.debug(f"Page {i+1}: extracted {len(text)} chars")
        if i == 0:
            logger.debug(f"Page 1 preview: {text[:200]}")
    
    logger.info(f"Total extracted text: {len(full_text)} chars")
    logger.info(f"Text preview: {full_text[:300]}")
    
    # Detect chapters using common patterns
    chapters = detect_chapters(full_text)
    logger.info(f"Detected {len(chapters)} chapters by pattern matching")
    
    # If no chapters detected, create one chapter per page (max 10)
    if not chapters:
        logger.info("No chapters detected, creating page-based sections")
        chapters = create_page_chapters(page_texts)
    
    logger.info(f"Final chapter count: {len(chapters)}")
    for i, ch in enumerate(chapters):
        logger.debug(f"Chapter {i+1}: '{ch['title']}' - {len(ch.get('content', ''))} chars")
    
    logger.info("=" * 50)
    
    return {
        "text": full_text.strip(),
        "chapters": chapters
    }


def detect_chapters(text: str) -> List[Dict[str, str]]:
    """
    Detect chapter boundaries in text using common heading patterns.
    """
    chapters = []
    
    # Common chapter patterns (supports : - – — as separators)
    patterns = [
        r'(?:^|\n)(Chapter\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(CHAPTER\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(Unit\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(UNIT\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(Module\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(Part\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(\d+\.\s+[A-Z][^\n]+)',  # 1. Section Title
    ]
    
    # Find all chapter headings with positions
    chapter_positions = []
    
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE):
            title = match.group(1).strip()
            position = match.start()
            chapter_positions.append({
                "title": title,
                "position": position
            })
    
    # Sort by position
    chapter_positions.sort(key=lambda x: x["position"])
    
    # Remove duplicates (chapters found by multiple patterns)
    seen_positions = set()
    unique_chapters = []
    for ch in chapter_positions:
        # Consider positions within 50 chars as duplicates
        key = ch["position"] // 50
        if key not in seen_positions:
            seen_positions.add(key)
            unique_chapters.append(ch)
    
    # Extract content between chapters
    for i, chapter in enumerate(unique_chapters):
        start = chapter["position"]
        end = unique_chapters[i + 1]["position"] if i + 1 < len(unique_chapters) else len(text)
        content = text[start:end].strip()
        
        chapters.append({
            "title": chapter["title"],
            "content": content[:5000]  # Limit content length
        })
    
    return chapters


def create_page_chapters(page_texts: List[str]) -> List[Dict[str, str]]:
    """
    Create pseudo-chapters from pages when no chapters are detected.
    """
    logger.info(f"Creating page chapters from {len(page_texts)} pages")
    chapters = []
    
    # Group pages into sections (roughly 3-5 pages each)
    pages_per_section = 3
    num_sections = min(10, (len(page_texts) + pages_per_section - 1) // pages_per_section)
    
    for i in range(num_sections):
        start_page = i * pages_per_section
        end_page = min((i + 1) * pages_per_section, len(page_texts))
        
        content = "\n\n".join(page_texts[start_page:end_page])
        
        logger.debug(f"Section {i+1}: pages {start_page+1}-{end_page}, content length: {len(content)}")
        
        chapters.append({
            "title": f"Section {i + 1} (Pages {start_page + 1}-{end_page})",
            "content": content[:5000]
        })
    
    return chapters
