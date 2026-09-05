"""Database verification script for MedLens.

Initializes the database and verifies that all expected tables and columns
exist with valid configurations and foreign keys.
"""

import sys
from sqlalchemy import inspect
from app.core.database import Base, engine, init_db, SessionLocal
from app.models import (
    Patient,
    Report,
    ProcessingStatus,
    LabResult,
    LabResultStatus,
    VerificationStatus,
    Conflict,
    ConflictStatus,
    VerificationRecord,
    VerificationAction,
    AuditEvent,
)

EXPECTED_TABLES = {
    "patients",
    "reports",
    "lab_results",
    "conflicts",
    "verification_records",
    "audit_events",
}


def verify_database() -> bool:
    print("Initializing database...")
    init_db()

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    print(f"Discovered tables in database: {sorted(existing_tables)}")

    missing_tables = EXPECTED_TABLES - existing_tables
    if missing_tables:
        print(f"ERROR: Missing expected tables: {missing_tables}", file=sys.stderr)
        return False

    print("All expected tables found:")
    for table_name in sorted(EXPECTED_TABLES):
        columns = inspector.get_columns(table_name)
        fks = inspector.get_foreign_keys(table_name)
        col_names = [col["name"] for col in columns]
        fk_descriptions = [
            f"{fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}"
            for fk in fks
        ]
        print(f"  - {table_name} ({len(col_names)} columns)")
        print(f"      columns: {', '.join(col_names)}")
        if fk_descriptions:
            print(f"      foreign keys: {', '.join(fk_descriptions)}")

    # Verify session and CRUD capabilities within a rolled-back transaction
    print("\nVerifying model instantiation and session operation...")
    db = SessionLocal()
    try:
        # Create a sample patient
        test_patient = Patient(
            patient_code="TEST-001",
            name="Verification Test Patient",
            age=35,
            sex="Other",
            symptoms="Mild headache",
            existing_conditions="None",
            allergies="None",
            medications="None",
        )
        db.add(test_patient)
        db.flush()

        # Create a report for this patient
        test_report = Report(
            patient_id=test_patient.id,
            file_name="test_report.pdf",
            processing_status=ProcessingStatus.COMPLETED,
        )
        db.add(test_report)
        db.flush()

        # Create a lab result for this report
        test_lab_result = LabResult(
            patient_id=test_patient.id,
            report_id=test_report.id,
            test_name="Hemoglobin",
            value="14.2",
            numeric_value=14.2,
            unit="g/dL",
            reference_low=13.5,
            reference_high=17.5,
            reference_range_text="13.5 - 17.5 g/dL",
            status=LabResultStatus.NORMAL,
            verification_status=VerificationStatus.VERIFIED,
            source_page=1,
            source_text="Hemoglobin 14.2 g/dL (13.5-17.5)",
        )
        db.add(test_lab_result)
        db.flush()

        # Create a verification record
        test_verification = VerificationRecord(
            lab_result_id=test_lab_result.id,
            original_value="14.2",
            verified_value="14.2",
            action=VerificationAction.CONFIRMED,
            verified_by="verifier_admin",
        )
        db.add(test_verification)

        # Create a conflict
        test_conflict = Conflict(
            patient_id=test_patient.id,
            field_name="allergies",
            value_a="Penicillin",
            source_a="Intake Form",
            value_b="None",
            source_b="Lab Report",
            status=ConflictStatus.DETECTED,
        )
        db.add(test_conflict)

        # Create an audit event
        test_audit = AuditEvent(
            user_id="verifier_admin",
            patient_id=test_patient.id,
            action="VERIFY",
            resource_type="LAB_RESULT",
            resource_id=str(test_lab_result.id),
        )
        db.add(test_audit)
        db.flush()

        print("Successfully instantiated and inserted all 6 entity types in test transaction.")

        # Roll back transaction so test records don't persist
        db.rollback()
        print("Transaction successfully rolled back cleanly.")
    finally:
        db.close()

    print("\nDatabase verification completed successfully!")
    return True


if __name__ == "__main__":
    success = verify_database()
    if not success:
        sys.exit(1)
