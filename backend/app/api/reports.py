from datetime import date, datetime, time, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.lab_result import LabResult
from app.models.patient import Patient
from app.models.report import ProcessingStatus, Report
from app.schemas.report import (
    LabResultResponse,
    ReportCreate,
    ReportProcessResponse,
    ReportResponse,
    ReportStatusUpdate,
    ReportUploadResponse,
)
from app.services.extraction_service import (
    EmptyDocumentError,
    ExtractionError,
    ExtractionParsingError,
    MissingAPIKeyError,
)
from app.services.orchestration_service import (
    OCRRequiredDocumentError,
    OrchestrationError,
    ReportNotFoundError,
    orchestration_service,
)
from app.services.pdf_service import pdf_service
from app.services.storage_service import storage_service

router = APIRouter()


@router.post(
    "/patients/{patient_id}/reports/upload",
    response_model=ReportUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_patient_report(
    patient_id: int,
    file: UploadFile = File(..., description="Medical report PDF document"),
    report_date: Optional[date] = Form(None, description="Optional clinical report date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
) -> ReportUploadResponse:
    """Upload and validate a medical report PDF for an existing patient, and extract text."""
    # 1. Confirm patient exists
    patient = db.execute(
        select(Patient).where(Patient.id == patient_id)
    ).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found.",
        )

    # 2. Read and validate file content
    content = await file.read()
    storage_service.validate_pdf_content(
        content=content,
        filename=file.filename,
        content_type=file.content_type,
    )

    safe_filename = storage_service.sanitize_filename(file.filename or "report.pdf")

    # 3. Store PDF securely
    storage_key, target_path = storage_service.save_pdf(content, safe_filename)

    # 4. Create initial Report record in PENDING status
    report_dt = datetime.combine(report_date, time.min, tzinfo=timezone.utc) if report_date else None
    report = Report(
        patient_id=patient_id,
        file_name=safe_filename,
        storage_key=storage_key,
        report_date=report_dt,
        processing_status=ProcessingStatus.PENDING,
        extraction_status="PENDING",
        extracted_text_available=False,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # 5. Extract text from PDF
    try:
        extraction_result = pdf_service.extract_text(target_path)

        # Persist structured page-level text to storage JSON for provenance
        storage_service.save_extracted_text(storage_key, extraction_result)

        # Update database record with extraction metadata
        report.page_count = extraction_result["page_count"]
        report.extraction_status = extraction_result["extraction_status"]
        report.extracted_text_available = extraction_result["extracted_text_available"]
        report.extracted_at = datetime.now(timezone.utc)
        report.processing_status = ProcessingStatus.COMPLETED
        db.commit()
        db.refresh(report)

        return ReportUploadResponse(
            report_id=report.id,
            patient_id=report.patient_id,
            file_name=report.file_name,
            report_date=report.report_date.date() if report.report_date else None,
            processing_status=report.processing_status,
            extraction_status=report.extraction_status or "UNKNOWN",
            page_count=report.page_count or 0,
            extracted_text_available=report.extracted_text_available,
            uploaded_at=report.uploaded_at,
            message=extraction_result["message"],
        )

    except HTTPException:
        # Re-raise explicit HTTP exceptions after cleaning up artifacts and database record
        storage_service.delete_report_artifacts(storage_key)
        db.delete(report)
        db.commit()
        raise
    except Exception as exc:
        # Handle unexpected extraction failure and avoid orphan artifacts
        storage_service.delete_report_artifacts(storage_key)
        db.delete(report)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred during PDF text extraction.",
        ) from exc


@router.post(
    "/patients/{patient_id}/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_patient_report(
    patient_id: int,
    report_in: ReportCreate,
    db: Session = Depends(get_db),
) -> Report:
    """Create report metadata for an existing patient."""
    patient = db.execute(
        select(Patient).where(Patient.id == patient_id)
    ).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found.",
        )

    report_dt = None
    if report_in.report_date is not None:
        report_dt = datetime.combine(report_in.report_date, time.min, tzinfo=timezone.utc)

    report = Report(
        patient_id=patient_id,
        file_name=report_in.file_name,
        report_date=report_dt,
        processing_status=report_in.processing_status or ProcessingStatus.PENDING,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get(
    "/patients/{patient_id}/reports",
    response_model=List[ReportResponse],
)
def get_patient_reports(
    patient_id: int,
    db: Session = Depends(get_db),
) -> List[Report]:
    """Retrieve all reports belonging to a specific patient."""
    patient = db.execute(
        select(Patient).where(Patient.id == patient_id)
    ).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found.",
        )

    reports = db.execute(
        select(Report)
        .where(Report.patient_id == patient_id)
        .order_by(Report.uploaded_at.desc())
    ).scalars().all()
    return list(reports)


@router.get(
    "/reports/{report_id}",
    response_model=ReportResponse,
)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
) -> Report:
    """Retrieve an individual report by ID."""
    report = db.execute(
        select(Report).where(Report.id == report_id)
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {report_id} not found.",
        )
    return report


@router.put(
    "/reports/{report_id}/status",
    response_model=ReportResponse,
)
def update_report_status(
    report_id: int,
    status_in: ReportStatusUpdate,
    db: Session = Depends(get_db),
) -> Report:
    """Update the processing status of a report."""
    report = db.execute(
        select(Report).where(Report.id == report_id)
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {report_id} not found.",
        )

    report.processing_status = status_in.processing_status
    db.commit()
    db.refresh(report)
    return report


@router.post(
    "/reports/{report_id}/process",
    response_model=ReportProcessResponse,
    status_code=status.HTTP_200_OK,
)
def process_report(
    report_id: int,
    db: Session = Depends(get_db),
) -> ReportProcessResponse:
    """Trigger clinical extraction, provenance validation, classification, and persistence for an uploaded report."""
    # 1. Verify report exists
    report = db.execute(select(Report).where(Report.id == report_id)).scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {report_id} not found.",
        )

    # 2. Verify stored PDF file exists
    if not report.storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {report_id} has no associated storage key.",
        )
    pdf_path = storage_service.get_file_path(report.storage_key)
    if not pdf_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stored PDF document for report {report_id} not found on disk.",
        )

    # 3. Clean rejection for OCR_REQUIRED / non-extractable documents
    if report.extraction_status == "OCR_REQUIRED" or not report.extracted_text_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report {report_id} requires OCR. Cannot perform selectable text extraction on scanned/blank documents.",
        )

    # 4. Trigger orchestration pipeline
    try:
        orch_result = orchestration_service.process_report_extraction(
            report_id=report.id,
            db=db,
        )
    except ReportNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except OCRRequiredDocumentError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except EmptyDocumentError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except MissingAPIKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI extraction service is not configured (OpenAI API key missing).",
        ) from exc
    except ExtractionParsingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI clinical extraction service failed: {exc}",
        ) from exc
    except ExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI clinical extraction error: {exc}",
        ) from exc
    except OrchestrationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred during report processing.",
        ) from exc

    # 5. Fetch persisted lab results
    db.refresh(report)
    persisted_results = db.execute(
        select(LabResult)
        .where(LabResult.report_id == report.id)
        .order_by(LabResult.source_page.asc().nulls_last(), LabResult.id.asc())
    ).scalars().all()

    return ReportProcessResponse(
        report_id=report.id,
        patient_id=report.patient_id,
        processing_status=report.processing_status,
        extraction_status=report.extraction_status or "AI_EXTRACTION_COMPLETED",
        persisted_results_count=orch_result.persisted_results_count,
        provenance_passed_count=orch_result.provenance_passed_count,
        provenance_flagged_count=orch_result.provenance_flagged_count,
        lab_results=list(persisted_results),
        message=f"Report processed successfully: {orch_result.persisted_results_count} lab results extracted.",
    )


@router.get(
    "/reports/{report_id}/lab-results",
    response_model=List[LabResultResponse],
    status_code=status.HTTP_200_OK,
)
def get_report_lab_results(
    report_id: int,
    db: Session = Depends(get_db),
) -> List[LabResult]:
    """Retrieve structured clinical lab results persisted for an individual report."""
    report = db.execute(
        select(Report).where(Report.id == report_id)
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID {report_id} not found.",
        )

    results = db.execute(
        select(LabResult)
        .where(LabResult.report_id == report_id)
        .order_by(LabResult.source_page.asc().nulls_last(), LabResult.id.asc())
    ).scalars().all()

    return list(results)
