"""Deterministic reference-range classification service.

Strictly deterministic rule-based evaluation:
- Never uses LLM for classification.
- Uses ONLY explicit reference_low / reference_high bounds extracted from the document source.
- Evaluates:
    value < reference_low        -> LOW
    reference_low <= value <= high -> NORMAL
    value > reference_high       -> HIGH
- If reference bounds are missing or non-numeric: status is strictly UNDETERMINED.
- Never invents, guesses, or defaults reference ranges.
"""

import re
from typing import Optional, Union

from app.models.lab_result import LabResultStatus


def parse_numeric_value(value: Union[float, int, str]) -> Optional[float]:
    """Parse a result value into a float if numeric, or return None for qualitative/non-numeric strings."""
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        cleaned = value.strip().replace(",", "")
        # Direct float conversion
        try:
            return float(cleaned)
        except ValueError:
            pass

        # Extract leading numeric portion (e.g. '14.1 g/dL' or '<0.5' -> '0.5')
        match = re.search(r"[-+]?\d*\.?\d+", cleaned)
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                pass

    return None


def classify_lab_result(
    value: Union[float, int, str],
    reference_low: Optional[float],
    reference_high: Optional[float],
) -> LabResultStatus:
    """Deterministically classify a laboratory result against extracted reference bounds.

    Rules:
    - If reference_low is None or reference_high is None -> UNDETERMINED.
    - If value cannot be parsed to numeric -> UNDETERMINED.
    - value < reference_low -> LOW.
    - reference_low <= value <= reference_high -> NORMAL.
    - value > reference_high -> HIGH.
    - Never fabricates or assumes missing reference ranges.
    """
    if reference_low is None or reference_high is None:
        return LabResultStatus.UNDETERMINED

    numeric_val = parse_numeric_value(value)
    if numeric_val is None:
        return LabResultStatus.UNDETERMINED

    if numeric_val < reference_low:
        return LabResultStatus.LOW
    elif numeric_val <= reference_high:
        return LabResultStatus.NORMAL
    else:
        return LabResultStatus.HIGH
