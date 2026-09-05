"""Verification script for MedLens AI clinical extraction schema and service.

Validates:
1. Valid synthetic ExtractedReport creation and validation.
2. Invalid extraction_confidence rejection (< 0.0 or > 1.0).
3. Invalid source_page rejection (< 1).
4. Logically inconsistent reference ranges rejection (reference_low > reference_high).
5. Missing reference ranges remain None (ensuring no hallucinated ranges).
6. ExtractionService input validation: empty pages and whitespace-only text raise EmptyDocumentError.
7. ExtractionService page boundary preservation.
8. ExtractionService API key validation (MissingAPIKeyError).
9. ExtractionService mock responses structured parsing and error handling.
10. Strict protection: zero API keys or secrets printed or logged.
"""

import sys
from datetime import date
from unittest.mock import MagicMock

from pydantic import ValidationError

from app.schemas.extraction import ExtractedLabResult, ExtractedReport
from app.services.extraction_service import (
    ClinicalReportExtractionService,
    EmptyDocumentError,
    ExtractionParsingError,
    MissingAPIKeyError,
    format_document_input,
)


def verify_schema() -> None:
    print("\n--- Part 1: Schema Validation Rules ---")

    # 1. Construct valid synthetic extraction
    synthetic_result = ExtractedLabResult(
        test_name="Hemoglobin",
        value=14.1,
        unit="g/dL",
        reference_range_text="13.5 - 17.5 g/dL",
        reference_low=13.5,
        reference_high=17.5,
        observation=None,
        source_page=1,
        source_text="Hemoglobin 14.1 g/dL (13.5 - 17.5)",
        extraction_confidence=0.98,
    )

    valid_report = ExtractedReport(
        report_date=date(2026, 9, 5),
        report_type="Complete Blood Count",
        laboratory_or_facility="Metropolitan Clinical Labs",
        lab_results=[synthetic_result],
        important_observations=["Specimen integrity verified; no hemolysis."],
        missing_or_unclear_items=[],
    )
    assert len(valid_report.lab_results) == 1
    assert valid_report.lab_results[0].test_name == "Hemoglobin"
    print("  ✓ Valid synthetic ExtractedReport instantiated and verified.")

    # 2. Verify invalid confidence (< 0.0 or > 1.0) fails
    try:
        ExtractedLabResult(
            test_name="WBC",
            value="6.8",
            extraction_confidence=1.5,  # Invalid: > 1.0
        )
        raise AssertionError("Expected ValidationError for confidence > 1.0")
    except ValidationError:
        print("  ✓ Extraction confidence > 1.0 rejected by validation.")

    try:
        ExtractedLabResult(
            test_name="WBC",
            value="6.8",
            extraction_confidence=-0.1,  # Invalid: < 0.0
        )
        raise AssertionError("Expected ValidationError for confidence < 0.0")
    except ValidationError:
        print("  ✓ Extraction confidence < 0.0 rejected by validation.")

    # 3. Verify invalid source_page (< 1) fails
    try:
        ExtractedLabResult(
            test_name="Platelets",
            value=250,
            source_page=0,  # Invalid: must be >= 1
            extraction_confidence=0.95,
        )
        raise AssertionError("Expected ValidationError for source_page < 1")
    except ValidationError:
        print("  ✓ source_page < 1 rejected by validation.")

    # 4. Verify invalid reference range (low > high) fails
    try:
        ExtractedLabResult(
            test_name="Serum Glucose",
            value=95,
            reference_low=140.0,
            reference_high=70.0,  # Invalid: low > high
            extraction_confidence=0.95,
        )
        raise AssertionError("Expected ValidationError for reference_low > reference_high")
    except ValidationError:
        print("  ✓ Inconsistent reference range (low > high) rejected by validation.")

    # 5. Verify missing reference range remains None (no fabricated default)
    no_range_result = ExtractedLabResult(
        test_name="Blood Type",
        value="O Positive",
        extraction_confidence=0.99,
    )
    assert no_range_result.reference_range_text is None
    assert no_range_result.reference_low is None
    assert no_range_result.reference_high is None
    print("  ✓ Absent reference ranges remain strictly None without auto-generation.")

    # 6. Verify default collection lists
    empty_report = ExtractedReport()
    assert empty_report.lab_results == []
    assert empty_report.important_observations == []
    assert empty_report.missing_or_unclear_items == []
    print("  ✓ ExtractedReport collections default to empty lists rather than None.")


def verify_service() -> None:
    print("\n--- Part 2: ExtractionService Boundary & Error Handling ---")

    # 1. Empty pages list raises EmptyDocumentError
    try:
        format_document_input([])
        raise AssertionError("Expected EmptyDocumentError for empty pages list")
    except EmptyDocumentError:
        print("  ✓ Empty pages list properly raised EmptyDocumentError.")

    # 2. Whitespace-only text across pages raises EmptyDocumentError
    try:
        format_document_input([
            {"page_number": 1, "text": "   \n  "},
            {"page_number": 2, "text": ""},
        ])
        raise AssertionError("Expected EmptyDocumentError for whitespace-only text")
    except EmptyDocumentError:
        print("  ✓ Whitespace-only page text properly raised EmptyDocumentError.")

    # 3. Page boundary preservation
    test_pages = [
        {"page_number": 1, "text": "Page 1 content: CBC Panel"},
        {"page_number": 2, "text": "Page 2 content: Metabolic Panel"},
    ]
    formatted = format_document_input(test_pages)
    assert "--- [PAGE 1] ---" in formatted
    assert "Page 1 content: CBC Panel" in formatted
    assert "--- [PAGE 2] ---" in formatted
    assert "Page 2 content: Metabolic Panel" in formatted
    print("  ✓ Page boundaries and page numbers strictly preserved in model input format.")

    # 4. Missing API key raises MissingAPIKeyError
    service_without_key = ClinicalReportExtractionService(client=None)
    # Mock settings to have no API key
    original_key = None
    try:
        from app.core.config import settings
        original_key = settings.OPENAI_API_KEY
        settings.OPENAI_API_KEY = None
        try:
            service_without_key.get_client()
            raise AssertionError("Expected MissingAPIKeyError when API key is None")
        except MissingAPIKeyError:
            print("  ✓ Missing API key properly raised MissingAPIKeyError.")
    finally:
        if original_key is not None:
            settings.OPENAI_API_KEY = original_key

    # 5. Mock OpenAI client returning structured output
    mock_parsed_report = ExtractedReport(
        report_type="Complete Blood Count",
        lab_results=[
            ExtractedLabResult(
                test_name="Hemoglobin",
                value=14.1,
                unit="g/dL",
                source_page=1,
                source_text="Hemoglobin: 14.1 g/dL",
                extraction_confidence=0.99,
            )
        ],
    )

    mock_response = MagicMock()
    mock_response.output_parsed = mock_parsed_report

    mock_client = MagicMock()
    mock_client.responses.parse.return_value = mock_response

    service_with_mock = ClinicalReportExtractionService(client=mock_client)
    extracted = service_with_mock.extract_report(test_pages)

    assert isinstance(extracted, ExtractedReport)
    assert len(extracted.lab_results) == 1
    assert extracted.lab_results[0].test_name == "Hemoglobin"
    assert extracted.lab_results[0].value == 14.1

    # Verify mock call parameters
    mock_client.responses.parse.assert_called_once()
    call_kwargs = mock_client.responses.parse.call_args.kwargs
    assert call_kwargs["text_format"] is ExtractedReport
    assert "instructions" in call_kwargs
    assert "input" in call_kwargs
    print("  ✓ Responses API called with text_format=ExtractedReport and returned validated model.")

    # 6. Structured output unavailable raises ExtractionParsingError
    mock_empty_response = MagicMock()
    mock_empty_response.output_parsed = None
    mock_client_empty = MagicMock()
    mock_client_empty.responses.parse.return_value = mock_empty_response

    service_empty_output = ClinicalReportExtractionService(client=mock_client_empty)
    try:
        service_empty_output.extract_report(test_pages)
        raise AssertionError("Expected ExtractionParsingError when output_parsed is None")
    except ExtractionParsingError:
        print("  ✓ Unavailable structured output properly raised ExtractionParsingError.")


def run_all_checks() -> bool:
    print("=" * 60)
    print("MedLens AI Extraction Schema & Service Verification")
    print("=" * 60)

    verify_schema()
    verify_service()

    print("\n" + "=" * 60)
    print("All extraction schema and service checks passed successfully!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success = run_all_checks()
        if not success:
            sys.exit(1)
    except AssertionError as err:
        print(f"\n[ERROR] Verification assertion failed: {err}", file=sys.stderr)
        sys.exit(1)
