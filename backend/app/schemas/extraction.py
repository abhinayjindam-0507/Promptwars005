"""Pydantic v2 schemas for AI-extracted clinical report intelligence.

Defines structured extraction models with rigorous boundary constraints.
Enforces documentary fidelity:
- Extracts only what is present in source documents.
- Never infers diagnoses, diseases, treatment recommendations, or medication changes.
- Never fabricates reference ranges, values, units, dates, or page numbers.
"""

from datetime import date, datetime
from typing import Any, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ExtractedLabResult(BaseModel):
    """Structured extraction of an individual clinical test result.

    Represents extracted documentary data only. Does not interpret clinical meaning.
    """

    model_config = ConfigDict(extra="ignore")

    test_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description=(
            "Exact clinical test or analyte name verbatim from the source report (e.g. 'Hemoglobin', 'Serum Glucose'). "
            "Never invent, truncate, or assume test names."
        ),
    )
    value: Union[float, int, str] = Field(
        ...,
        description=(
            "Reported test result value (numeric or qualitative string e.g. '14.1', 'Negative', 'Present'). "
            "Must be extracted verbatim without alteration or rounding."
        ),
    )
    unit: Optional[str] = Field(
        default=None,
        max_length=50,
        description=(
            "Measurement unit verbatim from the report (e.g. 'g/dL', 'mg/dL', 'mmol/L', '%'). "
            "Leave null if unit is not stated in the source document. Never fabricate or guess units."
        ),
    )
    reference_range_text: Optional[str] = Field(
        default=None,
        max_length=255,
        description=(
            "Exact verbatim reference range text as printed in the report (e.g. '13.5 - 17.5 g/dL', '< 100 mg/dL'). "
            "Leave null if no reference range is provided in the document. Never fabricate reference ranges."
        ),
    )
    reference_low: Optional[float] = Field(
        default=None,
        description=(
            "Extracted lower bound of normal reference range as a numeric value. "
            "Leave null if not present in document. Never infer or compute from memory."
        ),
    )
    reference_high: Optional[float] = Field(
        default=None,
        description=(
            "Extracted upper bound of normal reference range as a numeric value. "
            "Leave null if not present in document. Never infer or compute from memory."
        ),
    )
    observation: Optional[str] = Field(
        default=None,
        description=(
            "Specific laboratory observation, specimen comment, or abnormal flag stated directly in the document. "
            "Never infer disease, clinical diagnosis, prognosis, or treatment recommendations."
        ),
    )
    source_page: Optional[int] = Field(
        default=None,
        ge=1,
        description=(
            "1-indexed page number of the source document where this test result was located. "
            "Must be >= 1. Never fabricate page numbers."
        ),
    )
    source_text: Optional[str] = Field(
        default=None,
        description=(
            "Verbatim snippet of source text from which this result was extracted to maintain provenance."
        ),
    )
    extraction_confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description=(
            "Confidence score between 0.0 and 1.0 indicating documentary extraction certainty "
            "(text legibility and layout certainty), NOT clinical or medical accuracy."
        ),
    )

    @field_validator("test_name", mode="before")
    @classmethod
    def validate_test_name(cls, v: Any) -> str:
        if isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("test_name must not be empty or whitespace only.")
            return v_stripped
        if v is None:
            raise ValueError("test_name is required.")
        return str(v).strip()

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, v: Any) -> Union[float, int, str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("value must not be empty or whitespace only.")
            return v_stripped
        if v is None:
            raise ValueError("value is required.")
        return v

    @field_validator("unit", "reference_range_text", "observation", "source_text", mode="before")
    @classmethod
    def strip_optional_strings(cls, v: Any) -> Optional[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return v

    @model_validator(mode="after")
    def validate_reference_bounds(self) -> "ExtractedLabResult":
        """Ensure reference_low <= reference_high when both bounds are present."""
        if self.reference_low is not None and self.reference_high is not None:
            if self.reference_low > self.reference_high:
                raise ValueError(
                    f"reference_low ({self.reference_low}) cannot be greater than reference_high ({self.reference_high})."
                )
        return self


class ExtractedReport(BaseModel):
    """Structured extraction of an entire clinical laboratory or diagnostic report.

    Contains documentary metadata and extracted test results.
    Strictly prohibits medical diagnosis, treatment recommendations, or medication changes.
    """

    model_config = ConfigDict(extra="ignore")

    report_date: Optional[date] = Field(
        default=None,
        description=(
            "Report or specimen collection date if explicitly stated in the document (YYYY-MM-DD). "
            "Leave null if absent. Never fabricate dates."
        ),
    )
    report_type: Optional[str] = Field(
        default=None,
        max_length=255,
        description=(
            "Type or category of report stated in document (e.g. 'Complete Blood Count', 'Comprehensive Metabolic Panel')."
        ),
    )
    laboratory_or_facility: Optional[str] = Field(
        default=None,
        max_length=255,
        description=(
            "Name of performing laboratory, hospital, or diagnostic center stated in report."
        ),
    )
    lab_results: List[ExtractedLabResult] = Field(
        default_factory=list,
        description="List of all individual laboratory test results extracted verbatim from the document.",
    )
    important_observations: List[str] = Field(
        default_factory=list,
        description=(
            "Verbatim laboratory remarks, specimen notes, or pathologist comments stated in the report. "
            "Never include diagnostic inferences, treatment recommendations, or medication adjustments."
        ),
    )
    missing_or_unclear_items: List[str] = Field(
        default_factory=list,
        description=(
            "List of items, values, or sections that appear illegible, corrupted, cropped, or ambiguous."
        ),
    )

    @field_validator("lab_results", "important_observations", "missing_or_unclear_items", mode="before")
    @classmethod
    def ensure_list_defaults(cls, v: Any) -> Any:
        if v is None:
            return []
        return v

    @field_validator("report_date", mode="before")
    @classmethod
    def coerce_date(cls, v: Any) -> Any:
        if isinstance(v, datetime):
            return v.date()
        return v
