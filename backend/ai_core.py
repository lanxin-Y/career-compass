"""
Thin adapter over Phase 1 services for the FastAPI layer.

Keeps Phase 1 logic in backend/services/; this module only renames/wraps
for the Phase 2 API (dict returns, stable function names).
"""

from __future__ import annotations

from pathlib import Path

from services.ai_analyzer import (
    AIAnalyzerError,
    analyze_gap as _analyze_gap,
    create_deep_dive_plan as _create_deep_dive_plan,
)
from services.resume_parser import extract_text_from_pdf
from services.schemas import Suggestion

# Re-export for endpoint error handling
__all__ = [
    "AIAnalyzerError",
    "analyze_gap",
    "generate_deep_dive",
    "parse_resume_pdf",
]


def parse_resume_pdf(file_path: str | Path) -> str:
    """Extract plain text from a resume PDF path."""
    return extract_text_from_pdf(file_path)


def analyze_gap(jd_text: str, resume_text: str) -> dict:
    """Round 1 — return a plain dict for JSON storage / API responses."""
    return _analyze_gap(jd_text, resume_text).model_dump()


def generate_deep_dive(
    suggestion: Suggestion | dict,
    jd_text: str,
    resume_text: str,
    user_notes: str | None = None,
) -> dict:
    """Round 2 — return a plain dict for JSON storage / API responses."""
    return _create_deep_dive_plan(
        suggestion,
        jd_text,
        resume_text,
        user_notes=user_notes,
    ).model_dump()
