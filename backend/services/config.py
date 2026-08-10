"""Configuration loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root (career-compass/) or backend/
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_REPO_ROOT / "backend" / ".env")

ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")

# Claude model settings
MODEL_NAME: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
MAX_TOKENS: int = int(os.getenv("ANTHROPIC_MAX_TOKENS", "4096"))
TEMPERATURE: float = float(os.getenv("ANTHROPIC_TEMPERATURE", "0.4"))


def require_api_key() -> str:
    """Return the API key or raise a clear error if missing."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "Copy .env.example to .env and add your key."
        )
    return ANTHROPIC_API_KEY
