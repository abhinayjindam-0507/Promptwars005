import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.report import Report
    from app.models.verification import VerificationRecord


class LabResultStatus(str, enum.Enum):
    NORMAL = "NORMAL"
    ABNORMAL = "ABNORMAL"
    CRITICAL = "CRITICAL"
    INCONCLUSIVE = "INCONCLUSIVE"
    PENDING = "PENDING"
    LOW = "LOW"
    HIGH = "HIGH"
    UNDETERMINED = "UNDETERMINED"


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    VERIFIED = "VERIFIED"
    FLAGGED = "FLAGGED"
    REJECTED = "REJECTED"


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    test_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    numeric_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_range_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[LabResultStatus] = mapped_column(
        Enum(LabResultStatus, native_enum=False, length=50),
        default=LabResultStatus.PENDING,
        nullable=False,
    )
    observation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    test_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    extraction_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, native_enum=False, length=50),
        default=VerificationStatus.UNVERIFIED,
        nullable=False,
    )
    source_page: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="lab_results")
    report: Mapped[Optional["Report"]] = relationship("Report", back_populates="lab_results")
    verification_records: Mapped[List["VerificationRecord"]] = relationship(
        "VerificationRecord",
        back_populates="lab_result",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<LabResult(id={self.id}, test_name='{self.test_name}', "
            f"value='{self.value}', status='{self.status}')>"
        )
