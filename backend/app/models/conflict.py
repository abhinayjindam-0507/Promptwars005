import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.patient import Patient


class ConflictStatus(str, enum.Enum):
    DETECTED = "DETECTED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    value_a: Mapped[str] = mapped_column(Text, nullable=False)
    source_a: Mapped[str] = mapped_column(String(255), nullable=False)
    value_b: Mapped[str] = mapped_column(Text, nullable=False)
    source_b: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ConflictStatus] = mapped_column(
        Enum(ConflictStatus, native_enum=False, length=50),
        default=ConflictStatus.DETECTED,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="conflicts")

    def __repr__(self) -> str:
        return (
            f"<Conflict(id={self.id}, patient_id={self.patient_id}, "
            f"field_name='{self.field_name}', status='{self.status}')>"
        )
