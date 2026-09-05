from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.patient import Patient
from app.schemas.patient import (
    PatientCreate,
    PatientDetailResponse,
    PatientResponse,
    PatientUpdate,
)

router = APIRouter()


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
) -> Patient:
    """Create a new patient record."""
    existing = db.execute(
        select(Patient).where(Patient.patient_code == patient_in.patient_code)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patient with code '{patient_in.patient_code}' already exists.",
        )

    patient = Patient(
        patient_code=patient_in.patient_code,
        name=patient_in.name,
        age=patient_in.age,
        sex=patient_in.sex,
        symptoms=patient_in.symptoms,
        existing_conditions=patient_in.existing_conditions,
        allergies=patient_in.allergies,
        medications=patient_in.medications,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("", response_model=List[PatientResponse])
def get_patients(
    search: Optional[str] = Query(None, description="Search by patient code or name"),
    db: Session = Depends(get_db),
) -> List[Patient]:
    """Retrieve a list of patients with optional search by code or name."""
    query = select(Patient)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Patient.patient_code.ilike(search_pattern),
                Patient.name.ilike(search_pattern),
            )
        )
    query = query.order_by(Patient.created_at.desc())
    patients = db.execute(query).scalars().all()
    return list(patients)


@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
) -> Patient:
    """Retrieve a patient by ID including related reports."""
    patient = db.execute(
        select(Patient)
        .options(selectinload(Patient.reports))
        .where(Patient.id == patient_id)
    ).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found.",
        )
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: int,
    patient_in: PatientUpdate,
    db: Session = Depends(get_db),
) -> Patient:
    """Update editable patient information."""
    patient = db.execute(
        select(Patient).where(Patient.id == patient_id)
    ).scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found.",
        )

    update_data = patient_in.model_dump(exclude_unset=True)

    if "patient_code" in update_data and update_data["patient_code"] != patient.patient_code:
        conflict = db.execute(
            select(Patient).where(
                Patient.patient_code == update_data["patient_code"],
                Patient.id != patient_id,
            )
        ).scalar_one_or_none()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Patient with code '{update_data['patient_code']}' already exists.",
            )

    for field, value in update_data.items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient
