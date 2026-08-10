"""Extract plain text from resume PDF files."""

from __future__ import annotations

import re
from pathlib import Path

import pdfplumber


def extract_text_from_pdf(pdf_path: str | Path) -> str:
    """
    Extract readable plain text from a multi-page resume PDF.

    Args:
        pdf_path: Path to a PDF file on disk.

    Returns:
        Cleaned plain text with readable structure preserved.

    Raises:
        FileNotFoundError: If the path does not exist.
        ValueError: If the file is not a PDF or yields no extractable text.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a .pdf file, got: {path.suffix}")

    page_texts: list[str] = []
    with pdfplumber.open(path) as pdf:
        if not pdf.pages:
            raise ValueError(f"PDF has no pages: {path}")
        for page in pdf.pages:
            raw = page.extract_text() or ""
            cleaned = _clean_page_text(raw)
            if cleaned:
                page_texts.append(cleaned)

    if not page_texts:
        raise ValueError(
            f"No extractable text found in PDF (may be image-only): {path}"
        )

    return "\n\n".join(page_texts).strip()


def _clean_page_text(text: str) -> str:
    """Strip excessive whitespace while keeping line structure readable."""
    if not text:
        return ""

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse runs of spaces/tabs within a line (keep intentional newlines)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]

    # Drop empty lines at edges; collapse 3+ blank lines to one blank line
    collapsed: list[str] = []
    blank_run = 0
    for line in lines:
        if not line:
            blank_run += 1
            if blank_run <= 1:
                collapsed.append("")
            continue
        blank_run = 0
        collapsed.append(line)

    return "\n".join(collapsed).strip()
