import json
import re
import uuid
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, status

# Storage location: backend/storage/reports/
BASE_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REPORTS_STORAGE_DIR = BASE_BACKEND_DIR / "storage" / "reports"

# Security and validation constants
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB limit
ALLOWED_MIME_TYPES = {"application/pdf", "application/x-pdf", "binary/octet-stream"}
PDF_MAGIC_BYTES = b"%PDF-"


class StorageService:
    """Handles secure file validation, disk storage, and retrieval for clinical documents."""

    def __init__(self, storage_dir: Path = REPORTS_STORAGE_DIR):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def validate_pdf_content(
        self,
        content: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> None:
        """Validate PDF size, extension, MIME type, and binary signature."""
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        if len(content) > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed limit of {max_mb} MB.",
            )

        # Check file extension if filename provided
        if filename:
            sanitized_name = Path(filename).name.lower()
            if not sanitized_name.endswith(".pdf"):
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Unsupported file format. Only PDF documents are accepted.",
                )

        # Check MIME type if provided
        if content_type and content_type.lower() not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Invalid Content-Type header. Expected application/pdf.",
            )

        # Enforce PDF magic byte signature at start of file
        if not content.startswith(PDF_MAGIC_BYTES):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="File content is not a valid PDF document (missing %PDF- header).",
            )

    def sanitize_filename(self, original_filename: str) -> str:
        """Sanitize original filename for safe display without path traversal characters."""
        base_name = Path(original_filename).name
        clean_name = re.sub(r"[^\w\.\-\s]", "_", base_name).strip()
        return clean_name or "medical_report.pdf"

    def save_pdf(self, content: bytes, original_filename: str) -> Tuple[str, Path]:
        """Save PDF using a randomized unique key; returns (storage_key, absolute_path)."""
        self.validate_pdf_content(content, filename=original_filename)

        # Generate unique storage key (uuid)
        storage_key = f"{uuid.uuid4().hex}.pdf"
        target_path = self.get_file_path(storage_key)

        # Write to storage securely
        target_path.write_bytes(content)
        return storage_key, target_path

    def save_extracted_text(self, storage_key: str, data: Dict[str, Any]) -> Path:
        """Persist structured extraction results to storage as JSON for future provenance."""
        stem = Path(storage_key).stem
        json_key = f"{stem}_extracted.json"
        json_path = self.get_file_path(json_key)
        json_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return json_path

    def get_file_path(self, storage_key: str) -> Path:
        """Resolve a storage key while strictly preventing directory traversal."""
        resolved = (self.storage_dir / storage_key).resolve()
        storage_root = self.storage_dir.resolve()
        if not str(resolved).startswith(str(storage_root)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage key path traversal attempt.",
            )
        return resolved

    def delete_report_artifacts(self, storage_key: Optional[str]) -> None:
        """Safely remove stored PDF and associated extraction JSON (used during rollback)."""
        if not storage_key:
            return
        try:
            pdf_path = self.get_file_path(storage_key)
            if pdf_path.exists():
                pdf_path.unlink()

            stem = Path(storage_key).stem
            json_path = self.get_file_path(f"{stem}_extracted.json")
            if json_path.exists():
                json_path.unlink()
        except Exception:
            # Silent ignore on cleanup to prevent masking original errors
            pass


storage_service = StorageService()
