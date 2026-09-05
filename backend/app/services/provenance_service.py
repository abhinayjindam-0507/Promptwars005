"""Provenance validation service for AI-extracted clinical records.

Strictly verifies documentary evidence:
- Confirms source_page is a valid 1-indexed page and exists in document.
- Confirms source_text is verifiably present in that page's extracted text.
- Never repairs or fabricates provenance.
- Identifies failed provenance for human verification.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.schemas.extraction import ExtractedLabResult


@dataclass
class ProvenanceCheckResult:
    """Outcome of provenance verification for an extracted lab result."""

    is_valid: bool
    source_page: Optional[int]
    source_text: Optional[str]
    error_message: Optional[str] = None


class ProvenanceValidationService:
    """Validates that extracted results trace back directly to verbatim source document pages."""

    @staticmethod
    def _normalize_text(text: str) -> str:
        """Collapse whitespace and normalize casing for robust documentary comparison."""
        return " ".join(text.split()).lower()

    def validate_provenance(
        self,
        result: ExtractedLabResult,
        pages: List[Dict[str, Any]],
    ) -> ProvenanceCheckResult:
        """Verify documentary provenance of a single extracted lab result against source pages.

        Rules:
        - source_page must be an integer >= 1.
        - source_page must exist within the provided document pages.
        - source_text must be non-empty.
        - source_text must be present within the designated source_page text.
        """
        source_page = result.source_page
        source_text = result.source_text

        # 1. Validate source_page is present and 1-indexed
        if source_page is None or not isinstance(source_page, int) or source_page < 1:
            return ProvenanceCheckResult(
                is_valid=False,
                source_page=source_page,
                source_text=source_text,
                error_message=f"Invalid source_page: {source_page}. Must be a 1-indexed positive integer.",
            )

        # 2. Build map of available pages
        pages_map = {
            page.get("page_number"): page.get("text", "") or ""
            for page in pages
            if isinstance(page, dict) and "page_number" in page
        }

        if source_page not in pages_map:
            available = sorted(pages_map.keys())
            return ProvenanceCheckResult(
                is_valid=False,
                source_page=source_page,
                source_text=source_text,
                error_message=(
                    f"source_page {source_page} does not exist in document pages. "
                    f"Available pages: {available}."
                ),
            )

        # 3. Validate source_text is present
        if not source_text or not source_text.strip():
            return ProvenanceCheckResult(
                is_valid=False,
                source_page=source_page,
                source_text=source_text,
                error_message="source_text is missing or empty.",
            )

        # 4. Check whether source_text exists in source_page
        page_text = pages_map[source_page]
        norm_source = self._normalize_text(source_text)
        norm_page = self._normalize_text(page_text)

        if norm_source not in norm_page:
            return ProvenanceCheckResult(
                is_valid=False,
                source_page=source_page,
                source_text=source_text,
                error_message=f"source_text was not found in the extracted text of page {source_page}.",
            )

        return ProvenanceCheckResult(
            is_valid=True,
            source_page=source_page,
            source_text=source_text,
            error_message=None,
        )

    def validate_all(
        self,
        lab_results: List[ExtractedLabResult],
        pages: List[Dict[str, Any]],
    ) -> List[ProvenanceCheckResult]:
        """Validate provenance for a list of extracted lab results."""
        return [self.validate_provenance(item, pages) for item in lab_results]


provenance_service = ProvenanceValidationService()
