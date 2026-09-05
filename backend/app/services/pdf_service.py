from pathlib import Path
from typing import Any, Dict, List

from fastapi import HTTPException, status
import pymupdf

# Minimum non-whitespace characters threshold to consider selectable text sufficient
MIN_EXTRACTABLE_TEXT_CHARS = 30


class PDFExtractionService:
    """Extracts raw text and page-level structures from clinical PDF documents using PyMuPDF."""

    def extract_text(self, pdf_path: Path) -> Dict[str, Any]:
        """Open a PDF, extract text per page, and determine text extraction status.

        Does not attempt medical interpretation, classification, or range inference.
        """
        if not pdf_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PDF document not found in storage.",
            )

        try:
            doc = pymupdf.open(str(pdf_path))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid, damaged, or unreadable PDF file structure.",
            ) from exc

        try:
            page_count = len(doc)
            if page_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="PDF document contains zero pages.",
                )

            pages: List[Dict[str, Any]] = []
            full_text_chunks: List[str] = []
            total_clean_chars = 0

            for page_index in range(page_count):
                page = doc[page_index]
                page_text = page.get_text() or ""
                clean_page_text = page_text.strip()
                total_clean_chars += len(clean_page_text)

                pages.append({
                    "page_number": page_index + 1,
                    "text": page_text,
                })

                if clean_page_text:
                    full_text_chunks.append(clean_page_text)

            full_text = "\n\n".join(full_text_chunks)

            # Distinguish selectable digital text vs scanned/empty document
            if total_clean_chars >= MIN_EXTRACTABLE_TEXT_CHARS:
                extraction_status = "TEXT_EXTRACTED"
                extracted_text_available = True
                message = "PDF uploaded and text extracted successfully."
            else:
                extraction_status = "OCR_REQUIRED"
                extracted_text_available = False
                message = "PDF uploaded successfully. Insufficient selectable text detected; document marked for OCR processing."

            return {
                "page_count": page_count,
                "pages": pages,
                "full_text": full_text,
                "extraction_status": extraction_status,
                "extracted_text_available": extracted_text_available,
                "message": message,
            }
        finally:
            doc.close()


pdf_service = PDFExtractionService()
