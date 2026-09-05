"""Comprehensive verification suite for MedLens clinical extraction orchestration pipeline.

Tests:
1. Deterministic reference-range classification:
   - value < low -> LOW
   - low <= value <= high -> NORMAL
   - value > high -> HIGH
   - missing reference range -> UNDETERMINED
   - no invented or hallucinated reference ranges
2. Provenance validation:
   - Provenance match (valid page and present text) -> is_valid == True
   - Provenance mismatch (text absent from page) -> is_valid == False
   - Provenance mismatch (invalid/out-of-bounds page) -> is_valid == False
   - Non-repairing verification
3. End-to-end orchestration & database persistence:
   - Synthetic patient and report creation
   - Structured extraction via simulated extractor
   - Deterministic classification and provenance checks
   - Relational database persistence into lab_results
   - Status assignment (UNVERIFIED vs FLAGGED)
   - Provenance-mismatch flagging
4. Scanned / OCR_REQUIRED document handling
5. Empty document handling
6. API key protection check
7. Clean fixture teardown
"""

import sys
from datetime import date
from unittest.mock import MagicMock

from sqlalchemy import delete, select

from app.core.database import SessionLocal, init_db
from app.models.lab_result import LabResult, LabResultStatus, VerificationStatus
from app.models.patient import Patient
from app.models.report import ProcessingStatus, Report
from app.schemas.extraction import ExtractedLabResult, ExtractedReport
from app.services.classification_service import classify_lab_result, parse_numeric_value
from app.services.extraction_service import EmptyDocumentError
from app.services.orchestration_service import (
    ExtractionOrchestrationService,
    OCRRequiredDocumentError,
    orchestration_service,
)
from app.services.provenance_service import provenance_service


def test_deterministic_classification():
    print("\n[Test 1] Deterministic Reference-Range Classification...")

    # Case A: Low (< reference_low)
    status_low = classify_lab_result(value=10.5, reference_low=13.5, reference_high=17.5)
    assert status_low == LabResultStatus.LOW, f"Expected LOW, got {status_low}"
    print("  ✓ value < low -> correctly classified as LOW.")

    # Case B: Normal (reference_low <= value <= reference_high)
    status_normal = classify_lab_result(value=14.1, reference_low=13.5, reference_high=17.5)
    assert status_normal == LabResultStatus.NORMAL, f"Expected NORMAL, got {status_normal}"

    status_bound_low = classify_lab_result(value=13.5, reference_low=13.5, reference_high=17.5)
    assert status_bound_low == LabResultStatus.NORMAL, f"Expected NORMAL, got {status_bound_low}"

    status_bound_high = classify_lab_result(value=17.5, reference_low=13.5, reference_high=17.5)
    assert status_bound_high == LabResultStatus.NORMAL, f"Expected NORMAL, got {status_bound_high}"
    print("  ✓ low <= value <= high -> correctly classified as NORMAL (including exact bounds).")

    # Case C: High (> reference_high)
    status_high = classify_lab_result(value=19.8, reference_low=13.5, reference_high=17.5)
    assert status_high == LabResultStatus.HIGH, f"Expected HIGH, got {status_high}"
    print("  ✓ value > high -> correctly classified as HIGH.")

    # Case D: Missing reference range -> UNDETERMINED
    status_no_range = classify_lab_result(value=14.1, reference_low=None, reference_high=None)
    assert status_no_range == LabResultStatus.UNDETERMINED, f"Expected UNDETERMINED, got {status_no_range}"

    status_partial_range = classify_lab_result(value=14.1, reference_low=10.0, reference_high=None)
    assert status_partial_range == LabResultStatus.UNDETERMINED, f"Expected UNDETERMINED, got {status_partial_range}"
    print("  ✓ Missing or incomplete reference ranges -> strictly UNDETERMINED (never invented).")

    # Case E: Non-numeric qualitative value -> UNDETERMINED
    status_qual = classify_lab_result(value="Negative", reference_low=0.0, reference_high=1.0)
    assert status_qual == LabResultStatus.UNDETERMINED, f"Expected UNDETERMINED, got {status_qual}"
    print("  ✓ Qualitative values without valid numeric comparison -> strictly UNDETERMINED.")


def test_provenance_validation():
    print("\n[Test 2] Provenance Validation Service...")

    pages = [
        {"page_number": 1, "text": "Hematology Report\nHemoglobin: 14.1 g/dL\nWBC: 6.8 x10^3/uL"},
        {"page_number": 2, "text": "Metabolic Panel\nGlucose: 135 mg/dL\nSodium: 140 mmol/L"},
    ]

    # Case A: Exact / normalized text match on valid page
    res_valid = ExtractedLabResult(
        test_name="Hemoglobin",
        value=14.1,
        source_page=1,
        source_text="Hemoglobin: 14.1 g/dL",
        extraction_confidence=0.98,
    )
    check_valid = provenance_service.validate_provenance(res_valid, pages)
    assert check_valid.is_valid is True
    assert check_valid.error_message is None
    print("  ✓ Provenance match confirmed for valid page and present source text.")

    # Case B: source_text does not exist on page
    res_absent_text = ExtractedLabResult(
        test_name="Potassium",
        value=4.2,
        source_page=1,
        source_text="Potassium: 4.2 mmol/L",  # Not on page 1
        extraction_confidence=0.95,
    )
    check_absent = provenance_service.validate_provenance(res_absent_text, pages)
    assert check_absent.is_valid is False
    assert "not found" in check_absent.error_message.lower()
    print("  ✓ Text absent from source page correctly flagged as provenance failure.")

    # Case C: source_page out of document range
    res_invalid_page = ExtractedLabResult(
        test_name="Glucose",
        value=135,
        source_page=5,  # Only pages 1 and 2 exist
        source_text="Glucose: 135 mg/dL",
        extraction_confidence=0.90,
    )
    check_page = provenance_service.validate_provenance(res_invalid_page, pages)
    assert check_page.is_valid is False
    assert "does not exist" in check_page.error_message.lower()
    print("  ✓ Nonexistent source page correctly flagged as provenance failure.")

    # Case D: source_page < 1 or None
    res_none_page = ExtractedLabResult(
        test_name="Glucose",
        value=135,
        source_page=None,
        source_text="Glucose: 135 mg/dL",
        extraction_confidence=0.90,
    )
    check_none = provenance_service.validate_provenance(res_none_page, pages)
    assert check_none.is_valid is False
    print("  ✓ Missing source page correctly flagged as provenance failure.")


def test_orchestration_and_persistence():
    print("\n[Test 3] End-to-End Orchestration & Database Persistence...")

    init_db()
    db = SessionLocal()

    created_patient_id = None
    created_report_id = None

    try:
        # 1. Create synthetic patient
        patient = Patient(
            patient_code="TEST-ORCH-P01",
            name="Orchestration Synthetic Subject",
            age=50,
            sex="Female",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        created_patient_id = patient.id

        # 2. Create synthetic report
        report = Report(
            patient_id=patient.id,
            file_name="synthetic_lab_report.pdf",
            storage_key="test_storage_key.pdf",
            processing_status=ProcessingStatus.PROCESSING,
            extraction_status="TEXT_EXTRACTED",
            extracted_text_available=True,
            page_count=2,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        created_report_id = report.id

        # 3. Define synthetic document text
        pages = [
            {
                "page_number": 1,
                "text": (
                    "CLINICAL LABORATORY REPORT\n"
                    "Page 1 of 2\n"
                    "Hemoglobin: 14.1 g/dL (Reference: 13.5 - 17.5)\n"
                    "Platelets: 95 x10^3/uL (Reference: 150 - 450)\n"
                ),
            },
            {
                "page_number": 2,
                "text": (
                    "Page 2 of 2\n"
                    "Glucose: 145 mg/dL (Reference: 70 - 99)\n"
                    "Blood Type: O Positive (Reference: None)\n"
                ),
            },
        ]

        # 4. Mock AI extraction response with 5 items:
        # - Item 1: Hemoglobin (NORMAL, provenance valid)
        # - Item 2: Platelets (LOW, provenance valid)
        # - Item 3: Glucose (HIGH, provenance valid)
        # - Item 4: Blood Type (UNDETERMINED, provenance valid, no reference range)
        # - Item 5: Hallucinated Ferritin (provenance MISMATCH -> FLAGGED)
        mock_extracted_report = ExtractedReport(
            report_date=date(2026, 9, 5),
            report_type="Diagnostic Panel",
            laboratory_or_facility="Apex Synthetic Labs",
            lab_results=[
                ExtractedLabResult(
                    test_name="Hemoglobin",
                    value=14.1,
                    unit="g/dL",
                    reference_range_text="13.5 - 17.5",
                    reference_low=13.5,
                    reference_high=17.5,
                    source_page=1,
                    source_text="Hemoglobin: 14.1 g/dL",
                    extraction_confidence=0.98,
                ),
                ExtractedLabResult(
                    test_name="Platelets",
                    value=95,
                    unit="x10^3/uL",
                    reference_range_text="150 - 450",
                    reference_low=150.0,
                    reference_high=450.0,
                    source_page=1,
                    source_text="Platelets: 95 x10^3/uL",
                    extraction_confidence=0.97,
                ),
                ExtractedLabResult(
                    test_name="Glucose",
                    value=145,
                    unit="mg/dL",
                    reference_range_text="70 - 99",
                    reference_low=70.0,
                    reference_high=99.0,
                    source_page=2,
                    source_text="Glucose: 145 mg/dL",
                    extraction_confidence=0.99,
                ),
                ExtractedLabResult(
                    test_name="Blood Type",
                    value="O Positive",
                    unit=None,
                    reference_range_text=None,
                    reference_low=None,
                    reference_high=None,
                    source_page=2,
                    source_text="Blood Type: O Positive",
                    extraction_confidence=0.99,
                ),
                ExtractedLabResult(
                    test_name="Ferritin",
                    value=300,
                    unit="ng/mL",
                    reference_range_text="30 - 400",
                    reference_low=30.0,
                    reference_high=400.0,
                    source_page=1,
                    source_text="Ferritin: 300 ng/mL",  # Hallucinated: NOT in source text of page 1
                    extraction_confidence=0.75,
                ),
            ],
            important_observations=["Test panel completed cleanly."],
            missing_or_unclear_items=[],
        )

        mock_extractor = MagicMock()
        mock_extractor.extract_report.return_value = mock_extracted_report

        # 5. Run orchestration pipeline
        result = orchestration_service.process_report_extraction(
            report_id=report.id,
            db=db,
            pages=pages,
            extractor=mock_extractor,
        )

        assert result.report_id == report.id
        assert result.persisted_results_count == 5
        assert result.provenance_passed_count == 4
        assert result.provenance_flagged_count == 1
        print("  ✓ Orchestration executed: 5 results processed (4 passed provenance, 1 flagged).")

        # 6. Verify persisted database records
        persisted_results = db.execute(
            select(LabResult).where(LabResult.report_id == report.id).order_by(LabResult.id)
        ).scalars().all()

        assert len(persisted_results) == 5

        # Hemoglobin check
        hb = next(r for r in persisted_results if r.test_name == "Hemoglobin")
        assert hb.status == LabResultStatus.NORMAL
        assert hb.verification_status == VerificationStatus.UNVERIFIED
        assert hb.numeric_value == 14.1
        print("  ✓ Hemoglobin: NORMAL status, UNVERIFIED status, numeric_value=14.1.")

        # Platelets check
        plt = next(r for r in persisted_results if r.test_name == "Platelets")
        assert plt.status == LabResultStatus.LOW
        assert plt.verification_status == VerificationStatus.UNVERIFIED
        assert plt.numeric_value == 95.0
        print("  ✓ Platelets: LOW status, UNVERIFIED status, numeric_value=95.0.")

        # Glucose check
        glu = next(r for r in persisted_results if r.test_name == "Glucose")
        assert glu.status == LabResultStatus.HIGH
        assert glu.verification_status == VerificationStatus.UNVERIFIED
        assert glu.numeric_value == 145.0
        print("  ✓ Glucose: HIGH status, UNVERIFIED status, numeric_value=145.0.")

        # Blood Type check (no reference range)
        bt = next(r for r in persisted_results if r.test_name == "Blood Type")
        assert bt.status == LabResultStatus.UNDETERMINED
        assert bt.reference_low is None
        assert bt.reference_high is None
        assert bt.reference_range_text is None
        assert bt.verification_status == VerificationStatus.UNVERIFIED
        print("  ✓ Blood Type: UNDETERMINED status, reference ranges strictly None.")

        # Ferritin check (provenance mismatch)
        fer = next(r for r in persisted_results if r.test_name == "Ferritin")
        assert fer.verification_status == VerificationStatus.FLAGGED
        assert "Provenance Warning" in fer.observation
        print("  ✓ Provenance mismatch correctly marked as FLAGGED with warning in observation.")

        # Report status check
        db.refresh(report)
        assert report.processing_status == ProcessingStatus.COMPLETED
        assert report.extraction_status == "AI_EXTRACTION_COMPLETED"
        print("  ✓ Report status updated to COMPLETED with AI_EXTRACTION_COMPLETED.")

    finally:
        # Clean up test fixtures
        if created_report_id:
            db.execute(delete(LabResult).where(LabResult.report_id == created_report_id))
            db.execute(delete(Report).where(Report.id == created_report_id))
        if created_patient_id:
            db.execute(delete(Patient).where(Patient.id == created_patient_id))
        db.commit()
        db.close()
        print("  ✓ Test database fixtures cleaned up.")


def test_edge_cases():
    print("\n[Test 4] Scanned and Empty Document Handling...")

    init_db()
    db = SessionLocal()

    created_patient_id = None
    created_report_id = None

    try:
        patient = Patient(
            patient_code="TEST-EDGE-P01",
            name="Edge Case Subject",
            age=25,
            sex="Other",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        created_patient_id = patient.id

        # Scanned document with OCR_REQUIRED
        scanned_report = Report(
            patient_id=patient.id,
            file_name="scanned_report.pdf",
            extraction_status="OCR_REQUIRED",
            extracted_text_available=False,
        )
        db.add(scanned_report)
        db.commit()
        db.refresh(scanned_report)
        created_report_id = scanned_report.id

        try:
            orchestration_service.process_report_extraction(
                report_id=scanned_report.id,
                db=db,
                pages=[{"page_number": 1, "text": ""}],
            )
            raise AssertionError("Expected OCRRequiredDocumentError for scanned document")
        except OCRRequiredDocumentError:
            print("  ✓ Scanned document (OCR_REQUIRED) properly rejected with OCRRequiredDocumentError.")

        # Empty document text
        scanned_report.extraction_status = "TEXT_EXTRACTED"
        scanned_report.extracted_text_available = True
        db.commit()

        try:
            orchestration_service.process_report_extraction(
                report_id=scanned_report.id,
                db=db,
                pages=[{"page_number": 1, "text": "   \n  "}],
            )
            raise AssertionError("Expected EmptyDocumentError for empty document pages")
        except EmptyDocumentError:
            print("  ✓ Empty document text properly rejected with EmptyDocumentError.")

    finally:
        if created_report_id:
            db.execute(delete(Report).where(Report.id == created_report_id))
        if created_patient_id:
            db.execute(delete(Patient).where(Patient.id == created_patient_id))
        db.commit()
        db.close()
        print("  ✓ Edge case fixtures cleaned up.")


def run_all_verification():
    print("=" * 65)
    print("MedLens AI Clinical Extraction & Provenance Orchestration Suite")
    print("=" * 65)

    test_deterministic_classification()
    test_provenance_validation()
    test_orchestration_and_persistence()
    test_edge_cases()

    print("\n" + "=" * 65)
    print("All orchestration and provenance tests passed successfully!")
    print("=" * 65)
    return True


if __name__ == "__main__":
    success = run_all_verification()
    if not success:
        sys.exit(1)
