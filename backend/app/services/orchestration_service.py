"""Orchestration service for AI clinical extraction, provenance validation, and persistence.

Coordinates the pipeline:
1. Validates document text and OCR eligibility.
2. Extracts structured clinical entities via AI extraction service.
3. Enforces deterministic rule-based reference range classification.
4. Validates documentary provenance (source_page and source_text).
5. Persists verified lab results to the database with transaction integrity.
"""

import json
from dataclasses import dataclass
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.lab_result import LabResult, VerificationStatus
from app.models.report import ProcessingStatus, Report
from app.schemas.extraction import ExtractedReport
from app.services.classification_service import classify_lab_result, parse_numeric_value
from app.services.extraction_service import (
    ClinicalReportExtractionService,
    EmptyDocumentError,
    extraction_service,
)
from app.services.provenance_service import provenance_service
from app.services.storage_service import storage_service


class OrchestrationError(Exception):
    """Base exception for extraction orchestration failures."""
    pass


class ReportNotFoundError(OrchestrationError):
    """Raised when the specified report record does not exist."""
    pass


class OCRRequiredDocumentError(OrchestrationError):
    """Raised when document lacks selectable digital text and requires OCR."""
    pass


@dataclass
class OrchestrationResult:
    """Summary of the orchestration pipeline execution."""

    report_id: int
    extracted_report: ExtractedReport
    persisted_results_count: int
    provenance_passed_count: int
    provenance_flagged_count: int


class ExtractionOrchestrationService:
    """Orchestrates PDF text extraction, AI structured parsing, provenance checks, and DB persistence."""

    def process_report_extraction(
        self,
        report_id: int,
        db: Session,
        pages: Optional[List[Dict[str, Any]]] = None,
        extractor: Optional[ClinicalReportExtractionService] = None,
    ) -> OrchestrationResult:
        """Run the complete extraction, verification, classification, and persistence pipeline."""
        # 1. Fetch Report record
        report = db.execute(select(Report).where(Report.id == report_id)).scalar_one_or_none()
        if not report:
            raise ReportNotFoundError(f"Report with ID {report_id} not found in database.")

        # 2. Check OCR / scanned document condition
        if report.extraction_status == "OCR_REQUIRED" or not report.extracted_text_available:
            raise OCRRequiredDocumentError(
                f"Report {report_id} requires OCR. Cannot perform selectable text extraction."
            )

        # 3. Load pages if not explicitly provided
        if pages is None:
            if not report.storage_key:
                raise OrchestrationError(f"Report {report_id} has no storage key.")

            stem = Path(report.storage_key).stem
            json_path = storage_service.get_file_path(f"{stem}_extracted.json")
            if not json_path.exists():
                raise OrchestrationError(f"Extracted JSON artifacts for report {report_id} not found on disk.")

            try:
                stored_content = json.loads(json_path.read_text(encoding="utf-8"))
                pages = stored_content.get("pages", [])
            except Exception as err:
                raise OrchestrationError(f"Failed to read extracted JSON from disk: {err}") from err

        if not pages or not any((p.get("text") or "").strip() for p in pages if isinstance(p, dict)):
            raise EmptyDocumentError(f"Report {report_id} contains no text across its pages.")

        # 4. AI Structured Extraction
        active_extractor = extractor or extraction_service
        extracted_report = active_extractor.extract_report(pages)

        # 5. Provenance Validation, Deterministic Classification & Database Persistence
        provenance_passed = 0
        provenance_flagged = 0

        try:
            # Clean up prior extracted results for idempotency if re-running
            db.execute(delete(LabResult).where(LabResult.report_id == report.id))

            for item in extracted_report.lab_results:
                # Provenance verification against raw document pages
                prov_result = provenance_service.validate_provenance(item, pages)

                if prov_result.is_valid:
                    provenance_passed += 1
                    verif_status = VerificationStatus.UNVERIFIED
                    obs = item.observation
                else:
                    provenance_flagged += 1
                    verif_status = VerificationStatus.FLAGGED
                    warning = f"[Provenance Warning: {prov_result.error_message}]"
                    obs = f"{item.observation} {warning}".strip() if item.observation else warning

                # Deterministic classification strictly based on source reference range
                classified_status = classify_lab_result(
                    value=item.value,
                    reference_low=item.reference_low,
                    reference_high=item.reference_high,
                )

                lab_result_row = LabResult(
                    patient_id=report.patient_id,
                    report_id=report.id,
                    test_name=item.test_name,
                    value=str(item.value),
                    numeric_value=parse_numeric_value(item.value),
                    unit=item.unit,
                    reference_low=item.reference_low,
                    reference_high=item.reference_high,
                    reference_range_text=item.reference_range_text,
                    status=classified_status,
                    observation=obs,
                    test_date=report.report_date,
                    extraction_confidence=item.extraction_confidence,
                    verification_status=verif_status,
                    source_page=item.source_page,
                    source_text=item.source_text,
                )
                db.add(lab_result_row)

            # Update report metadata
            report.processing_status = ProcessingStatus.COMPLETED
            report.extraction_status = "AI_EXTRACTION_COMPLETED"
            if extracted_report.report_date and not report.report_date:
                report.report_date = datetime.combine(
                    extracted_report.report_date,
                    time.min,
                    tzinfo=timezone.utc,
                )

            db.commit()
            db.refresh(report)

        except Exception as exc:
            db.rollback()
            raise OrchestrationError(f"Database persistence failed during extraction orchestration: {exc}") from exc

        return OrchestrationResult(
            report_id=report.id,
            extracted_report=extracted_report,
            persisted_results_count=len(extracted_report.lab_results),
            provenance_passed_count=provenance_passed,
            provenance_flagged_count=provenance_flagged,
        )


orchestration_service = ExtractionOrchestrationService()
