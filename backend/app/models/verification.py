import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.lab_result import LabResult


class VerificationAction(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    EDITED = "EDITED"
    OVERRIDDEN = "OVERRIDDEN"
    REJECTED = "REJECTED"


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lab_result_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lab_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_value: Mapped[str] = mapped_column(String(255), nullable=False)
    verified_value: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[VerificationAction] = mapped_column(
        Enum(VerificationAction, native_enum=False, length=50),
        default=VerificationAction.CONFIRMED,
        nullable=False,
    )
    verified_by: Mapped[str] = mapped_column(String(255), nullable=False)
    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    lab_result: Mapped["LabResult"] = relationship(
        "LabResult",
        back_populates="verification_records",
    )

    def __repr__(self) -> str:
        return (
            f"<VerificationRecord(id={self.id}, lab_result_id={self.lab_result_id}, "
            f"action='{self.action}', verified_by='{self.verified_by}')>"
        )
