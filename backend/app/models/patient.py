from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.report import Report
    from app.models.lab_result import LabResult
    from app.models.conflict import Conflict
    from app.models.audit_event import AuditEvent


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    symptoms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    existing_conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    allergies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    medications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    reports: Mapped[List["Report"]] = relationship(
        "Report",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    lab_results: Mapped[List["LabResult"]] = relationship(
        "LabResult",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    conflicts: Mapped[List["Conflict"]] = relationship(
        "Conflict",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    audit_events: Mapped[List["AuditEvent"]] = relationship(
        "AuditEvent",
        back_populates="patient",
    )

    def __repr__(self) -> str:
        return f"<Patient(id={self.id}, patient_code='{self.patient_code}')>"
