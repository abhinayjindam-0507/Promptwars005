from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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

    @field_validator("report_date", mode="before")
    @classmethod
    def coerce_date(cls, v):
        if isinstance(v, datetime):
            return v.date()
        return v
