from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.lab_result import LabResultStatus, VerificationStatus
from app.models.report import ProcessingStatus


class ReportCreate(BaseModel):
    file_name: str = Field(..., min_length=1, max_length=255, description="Filename of clinical report")
    report_date: Optional[date] = Field(None, description="Date of clinical report (YYYY-MM-DD)")
    processing_status: Optional[ProcessingStatus] = Field(
        default=ProcessingStatus.PENDING,
        description="Initial report processing status",
    )

    @field_validator("file_name", mode="before")
    @classmethod
    def validate_file_name(cls, v: str) -> str:
        if isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("file_name must not be empty or whitespace only")
            return v_stripped
        return v


class ReportStatusUpdate(BaseModel):
    processing_status: ProcessingStatus = Field(..., description="Updated processing status")


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    file_name: str
    report_date: Optional[date] = None
    uploaded_at: datetime
    processing_status: ProcessingStatus
    page_count: Optional[int] = None
    extracted_text_available: bool = False
    extraction_status: Optional[str] = None

    @field_validator("report_date", mode="before")
    @classmethod
    def coerce_date(cls, v):
        if isinstance(v, datetime):
            return v.date()
        return v


class ReportUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: int
    patient_id: int
    file_name: str
    report_date: Optional[date] = None
    processing_status: ProcessingStatus
    extraction_status: str
    page_count: int
    extracted_text_available: bool
    uploaded_at: datetime
    message: str

    @field_validator("report_date", mode="before")
    @classmethod
    def coerce_date(cls, v):
        if isinstance(v, datetime):
            return v.date()
        return v


class LabResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    report_id: Optional[int] = None
    test_name: str
    value: str
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    reference_range_text: Optional[str] = None
    status: LabResultStatus
    observation: Optional[str] = None
    test_date: Optional[date] = None
    extraction_confidence: Optional[float] = None
    verification_status: VerificationStatus
    source_page: Optional[int] = None
    source_text: Optional[str] = None
    created_at: datetime

    @field_validator("test_date", mode="before")
    @classmethod
    def coerce_date(cls, v):
        if isinstance(v, datetime):
            return v.date()
        return v


class ReportProcessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: int
    patient_id: int
    processing_status: ProcessingStatus
    extraction_status: str
    persisted_results_count: int
    provenance_passed_count: int
    provenance_flagged_count: int
    lab_results: List[LabResultResponse]
    message: str
