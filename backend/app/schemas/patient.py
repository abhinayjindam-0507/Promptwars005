from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.report import ReportResponse


class PatientBase(BaseModel):
    patient_code: str = Field(..., min_length=1, max_length=50, description="Unique patient identifier code")
    name: str = Field(..., min_length=1, max_length=255, description="Full name of patient")
    age: int = Field(..., ge=0, le=150, description="Age in years (0-150)")
    sex: str = Field(..., min_length=1, max_length=20, description="Biological sex / gender")
    symptoms: Optional[str] = Field(None, description="Current symptoms or clinical presentation")
    existing_conditions: Optional[str] = Field(None, description="Pre-existing medical conditions")
    allergies: Optional[str] = Field(None, description="Known allergies")
    medications: Optional[str] = Field(None, description="Current medications")

    @field_validator("patient_code", "name", "sex", mode="before")
    @classmethod
    def strip_and_validate_non_empty(cls, v: str) -> str:
        if isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Value must not be empty or whitespace only")
            return v_stripped
        return v


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    patient_code: Optional[str] = Field(None, min_length=1, max_length=50, description="Unique patient identifier code")
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Full name of patient")
    age: Optional[int] = Field(None, ge=0, le=150, description="Age in years (0-150)")
    sex: Optional[str] = Field(None, min_length=1, max_length=20, description="Biological sex / gender")
    symptoms: Optional[str] = Field(None, description="Current symptoms or clinical presentation")
    existing_conditions: Optional[str] = Field(None, description="Pre-existing medical conditions")
    allergies: Optional[str] = Field(None, description="Known allergies")
    medications: Optional[str] = Field(None, description="Current medications")

    @field_validator("patient_code", "name", "sex", mode="before")
    @classmethod
    def strip_and_validate_non_empty_if_present(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Value must not be empty or whitespace only")
            return v_stripped
        return v


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_code: str
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    symptoms: Optional[str] = None
    existing_conditions: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PatientDetailResponse(PatientResponse):
    reports: List[ReportResponse] = []
