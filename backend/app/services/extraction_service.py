"""AI-powered clinical report extraction service.

Uses the OpenAI Python SDK Responses API with strict structured Pydantic output.
Enforces documentary fidelity: extracts only explicitly present facts and provenance,
without diagnosing, prescribing, or inferring reference ranges.
"""

from typing import Any, Dict, List, Optional

from openai import OpenAI

from app.core.config import settings
from app.schemas.extraction import ExtractedReport


class ExtractionError(Exception):
    """Base exception for all clinical report extraction errors."""
    pass


class MissingAPIKeyError(ExtractionError):
    """Raised when the OpenAI API key is missing or not configured."""
    pass


class EmptyDocumentError(ExtractionError):
    """Raised when input pages or document text are empty or missing."""
    pass


class ExtractionParsingError(ExtractionError):
    """Raised when structured output cannot be obtained or parsed from the model."""
    pass


EXTRACTION_SYSTEM_INSTRUCTIONS = (
    "You are MedLens AI, a specialized clinical report extraction engine. "
    "Your SOLE purpose is documentary text extraction from clinical diagnostic and laboratory reports.\n\n"
    "CRITICAL EXTRACTION SAFETY CONSTRAINTS:\n"
    "1. FACTUAL FIDELITY: Extract ONLY factual data explicitly printed in the provided document text. "
    "NEVER invent, assume, interpolate, or extrapolate any values, units, dates, observations, or reference ranges.\n"
    "2. NO CLINICAL JUDGMENT: NEVER diagnose diseases, infer conditions from lab values, suggest treatments, "
    "prescribe therapies, or suggest changes to medication or dosage.\n"
    "3. NO RESULT CLASSIFICATION: Do NOT classify results as normal, abnormal, high, low, or critical. "
    "Only extract explicit laboratory comment flags if printed verbatim in the source report under 'observation'.\n"
    "4. STRICT REFERENCE RANGE HANDLING: If a reference range is NOT present in the source report for a test, "
    "leave reference_range_text, reference_low, and reference_high as null. NEVER fabricate reference ranges.\n"
    "5. PROVENANCE INTEGRITY: For every extracted lab result, populate 'source_page' with the exact 1-indexed page number "
    "where it was located, and 'source_text' with the verbatim text snippet from which the value was extracted.\n"
    "6. CONFIDENCE DEFINITION: 'extraction_confidence' (0.0 to 1.0) reflects documentary and character legibility certainty, "
    "NOT clinical certainty or medical validity.\n"
    "7. MISSING OR UNCLEAR ITEMS: If any values, test names, or sections are cropped, blurred, illegible, or ambiguous, "
    "record them in 'missing_or_unclear_items'. Do not guess."
)


def format_document_input(pages: List[Dict[str, Any]]) -> str:
    """Format page-level PDF text into structured document input preserving page boundaries."""
    if not pages or not isinstance(pages, list):
        raise EmptyDocumentError("Input pages list is empty or invalid.")

    formatted_sections: List[str] = []
    has_meaningful_text = False

    for page in pages:
        if not isinstance(page, dict):
            continue
        page_num = page.get("page_number", "Unknown")
        text = page.get("text", "") or ""
        clean_text = text.strip()
        if clean_text:
            has_meaningful_text = True
        formatted_sections.append(f"--- [PAGE {page_num}] ---\n{clean_text}\n")

    if not has_meaningful_text:
        raise EmptyDocumentError("Document text across all provided pages is empty or whitespace-only.")

    return "\n".join(formatted_sections)


class ClinicalReportExtractionService:
    """Service for extracting structured clinical data from PDF page text using OpenAI Responses API."""

    def __init__(self, client: Optional[OpenAI] = None):
        self._client = client

    def get_client(self) -> OpenAI:
        """Get or initialize the OpenAI client using the key from settings."""
        if self._client is not None:
            return self._client

        api_key = settings.openai_api_key
        if not api_key or not api_key.strip():
            raise MissingAPIKeyError(
                "OpenAI API key is missing or not configured. Set OPENAI_API_KEY in backend/.env."
            )
        return OpenAI(api_key=api_key)

    def extract_report(self, pages: List[Dict[str, Any]]) -> ExtractedReport:
        """Extract structured lab results and documentary metadata from page-level PDF text.

        Preserves page boundaries, strictly adheres to documentary facts, and returns a validated ExtractedReport.
        """
        # Validate input pages and format boundary-preserved input string
        formatted_input = format_document_input(pages)

        # Retrieve client (validates API key presence)
        client = self.get_client()
        model_name = settings.openai_model or "gpt-4o"

        try:
            response = client.responses.parse(
                model=model_name,
                instructions=EXTRACTION_SYSTEM_INSTRUCTIONS,
                input=formatted_input,
                text_format=ExtractedReport,
            )
        except Exception as exc:
            raise ExtractionParsingError(f"OpenAI Responses API call failed: {exc}") from exc

        if not response or not hasattr(response, "output_parsed") or response.output_parsed is None:
            raise ExtractionParsingError(
                "Structured extraction output is unavailable from the OpenAI Responses API response."
            )

        extracted_output = response.output_parsed

        # Ensure validation passes against ExtractedReport Pydantic model
        if not isinstance(extracted_output, ExtractedReport):
            try:
                extracted_output = ExtractedReport.model_validate(extracted_output)
            except Exception as err:
                raise ExtractionParsingError(f"Validation of structured output failed: {err}") from err

        return extracted_output


# Default module-level singleton instance
extraction_service = ClinicalReportExtractionService()
