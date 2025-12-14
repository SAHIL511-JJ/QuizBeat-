import re
import logging
from typing import Dict, List, Any
from PyPDF2 import PdfReader

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# OCR imports (optional - will fallback gracefully if not available)
try:
    from pdf2image import convert_from_path
    import pytesseract
    OCR_AVAILABLE = True
    logger.info("OCR dependencies loaded successfully")
except ImportError:
    OCR_AVAILABLE = False
    logger.warning("OCR dependencies not available - scanned PDFs won't be supported")


def ocr_extract_text(file_path: str) -> str:
    """
    Extract text from PDF using OCR (for scanned documents).
    """
    if not OCR_AVAILABLE:
        logger.error("OCR not available - pytesseract/pdf2image not installed")
        return ""
    
    logger.info("Starting OCR extraction...")
    try:
        # Poppler path for Windows (fallback if not in PATH)
        import platform
        import os
        poppler_path = None
        if platform.system() == "Windows":
            # Check common installation paths for Poppler
            possible_poppler_paths = [
                r"C:\poppler-25.12.0\Library\bin",
                r"C:\Program Files\poppler\Library\bin",
                r"C:\poppler\Library\bin",
            ]
            for path in possible_poppler_paths:
                if os.path.exists(path):
                    poppler_path = path
                    logger.info(f"Found Poppler at: {path}")
                    break
            
            # Check common installation paths for Tesseract
            possible_tesseract_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Tesseract-OCR\tesseract.exe",
            ]
            for path in possible_tesseract_paths:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    logger.info(f"Found Tesseract at: {path}")
                    break
        
        # Get page count first (load just first page to check)
        first_page = convert_from_path(file_path, first_page=1, last_page=1, poppler_path=poppler_path)
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        page_count = len(reader.pages)
        logger.info(f"PDF has {page_count} pages, starting page-by-page OCR...")
        
        full_text = ""
        # Process one page at a time to reduce memory usage
        for page_num in range(1, page_count + 1):
            images = convert_from_path(
                file_path, 
                first_page=page_num, 
                last_page=page_num, 
                poppler_path=poppler_path
            )
            if images:
                page_text = pytesseract.image_to_string(images[0])
                full_text += page_text + "\n\n"
                logger.debug(f"OCR Page {page_num}/{page_count}: extracted {len(page_text)} chars")
            # Image is garbage collected after each iteration
        
        logger.info(f"OCR completed: {len(full_text)} total chars")
        return full_text
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return ""


def extract_text_from_pdf(file_path: str) -> Dict[str, Any]:
    """
    Extract text from a PDF file and detect chapter boundaries.
    Uses PyPDF2 first, falls back to OCR for scanned documents.
    """
    logger.info("=" * 50)
    logger.info(f"PDF EXTRACTION STARTED: {file_path}")
    
    reader = PdfReader(file_path)
    full_text = ""
    page_texts = []
    
    logger.info(f"PDF has {len(reader.pages)} pages")
    
    # Extract text from each page using PyPDF2
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        page_texts.append(text)
        full_text += text + "\n\n"
        logger.debug(f"Page {i+1}: extracted {len(text)} chars")
        if i == 0:
            logger.debug(f"Page 1 preview: {text[:200]}")
    
    logger.info(f"PyPDF2 extracted: {len(full_text)} chars")
    
    # If PyPDF2 extracted very little text, try OCR
    if len(full_text.strip()) < 100:
        logger.info("PyPDF2 extracted minimal text, attempting OCR fallback...")
        ocr_text = ocr_extract_text(file_path)
        if len(ocr_text.strip()) > len(full_text.strip()):
            full_text = ocr_text
            # Re-split by page markers for chapter detection
            page_texts = [ocr_text]
            logger.info("Using OCR extracted text")
        else:
            logger.warning("OCR also failed to extract meaningful text")
    
    logger.info(f"Final text length: {len(full_text)} chars")
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
    # Supports: numeric, spelled-out (One-Twelve), Roman numerals (I-XII), subsections
    patterns = [
        # Numeric chapters: Chapter 1, CHAPTER 2
        r'(?:^|\n)(Chapter\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(CHAPTER\s+\d+[\s:–—-]+[^\n]+)',
        
        # Spelled-out chapters: Chapter One, Chapter Two, etc.
        r'(?:^|\n)(Chapter\s+(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(CHAPTER\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)[\s:–—-]+[^\n]+)',
        
        # Roman numerals: Chapter I, Chapter II, etc.
        r'(?:^|\n)(Chapter\s+(?:I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3}|XII)[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(CHAPTER\s+(?:I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3}|XII)[\s:–—-]+[^\n]+)',
        
        # Units, Modules, Parts
        r'(?:^|\n)(Unit\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(UNIT\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(Module\s+\d+[\s:–—-]+[^\n]+)',
        r'(?:^|\n)(Part\s+\d+[\s:–—-]+[^\n]+)',
        
        # Numbered sections: 1. Title
        r'(?:^|\n)(\d+\.\s+[A-Z][^\n]+)',
        
        # Subsections: 1.1 Title, 2.3 Title
        r'(?:^|\n)(\d+\.\d+\s+[A-Z][^\n]+)',
    ]
    
    # Find all chapter headings with positions
    chapter_positions = []
    
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE | re.IGNORECASE):
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
    
    # Extract content between chapters (no character limit)
    for i, chapter in enumerate(unique_chapters):
        start = chapter["position"]
        end = unique_chapters[i + 1]["position"] if i + 1 < len(unique_chapters) else len(text)
        content = text[start:end].strip()
        
        chapters.append({
            "title": chapter["title"],
            "content": content  # Full content, no limit
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
