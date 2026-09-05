from pydantic import ValidationError

from app.schemas.extraction import ExtractedLabResult, ExtractedReport


def check_valid_extraction():
    result = ExtractedLabResult(
        test_name="Hemoglobin",
        value=14.1,
        unit="g/dL",
        reference_range_text="13.5 - 17.5 g/dL",
        reference_low=13.5,
        reference_high=17.5,
        observation=None,
        source_page=1,
        source_text="Hemoglobin 14.1 g/dL 13.5 - 17.5",
        extraction_confidence=0.98,
    )

    report = ExtractedReport(
        report_date="2026-09-05",
        report_type="Complete Blood Count",
        laboratory_or_facility="Synthetic Demo Laboratory",
        lab_results=[result],
        important_observations=[],
        missing_or_unclear_items=[],
    )

    assert report.lab_results[0].test_name == "Hemoglobin"
    assert report.lab_results[0].reference_low == 13.5
    assert report.lab_results[0].reference_high == 17.5
    print("✓ Valid synthetic extraction accepted")


def check_invalid_confidence():
    try:
        ExtractedLabResult(
            test_name="Glucose",
            value=92,
            unit="mg/dL",
            extraction_confidence=1.5,
        )
    except ValidationError:
        print("✓ Invalid confidence rejected")
        return

    raise AssertionError("Invalid confidence was accepted")


def check_invalid_source_page():
    try:
        ExtractedLabResult(
            test_name="Glucose",
            value=92,
            extraction_confidence=0.9,
            source_page=0,
        )
    except ValidationError:
        print("✓ Invalid source page rejected")
        return

    raise AssertionError("Invalid source page was accepted")


def check_invalid_reference_range():
    try:
        ExtractedLabResult(
            test_name="Glucose",
            value=92,
            reference_low=100,
            reference_high=70,
            extraction_confidence=0.9,
        )
    except ValidationError:
        print("✓ Invalid reference range rejected")
        return

    raise AssertionError("Invalid reference range was accepted")


def check_missing_reference_range():
    result = ExtractedLabResult(
        test_name="Glucose",
        value=92,
        unit="mg/dL",
        extraction_confidence=0.9,
    )

    assert result.reference_range_text is None
    assert result.reference_low is None
    assert result.reference_high is None
    print("✓ Missing reference range remains None")


def main():
    print("=" * 60)
    print("MedLens Extraction Schema Verification")
    print("=" * 60)

    check_valid_extraction()
    check_invalid_confidence()
    check_invalid_source_page()
    check_invalid_reference_range()
    check_missing_reference_range()

    print()
    print("All extraction schema checks passed.")
    print("=" * 60)


if __name__ == "__main__":
    main()
