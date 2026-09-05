from datetime import datetime, time, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.patient import Patient
from app.models.report import ProcessingStatus, Report
from app.schemas.report import (
    ReportCreate,
    ReportResponse,
    ReportStatusUpdate,
)

router = APIRouter()


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
