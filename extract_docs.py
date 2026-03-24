import PyPDF2
from docx import Document

# Extract PDF
with open('StockTracker - (Inventory Management System).pdf', 'rb') as pdf_file:
    reader = PyPDF2.PdfReader(pdf_file)
    pdf_text = ""
    for page in reader.pages:
        pdf_text += page.extract_text() + "\n\n"
    
    with open('stock_extracted.txt', 'w', encoding='utf-8') as f:
        f.write(pdf_text)

# Extract DOCX
doc = Document('Project Synopsis Format.docx')
docx_text = ""
for para in doc.paragraphs:
    docx_text += para.text + "\n"

with open('format_extracted.txt', 'w', encoding='utf-8') as f:
    f.write(docx_text)

print("Extraction complete!")
