"""Configuration loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root (career-compass/) or backend/
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_REPO_ROOT / "backend" / ".env")

ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")
DEEPSEEK_API_KEY: str | None = os.getenv("DEEPSEEK_API_KEY")

# Claude model settings
MODEL_NAME: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
MAX_TOKENS: int = int(os.getenv("ANTHROPIC_MAX_TOKENS", "4096"))
TEMPERATURE: float = float(os.getenv("ANTHROPIC_TEMPERATURE", "0.4"))

# DeepSeek (OpenAI-compatible API)
DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_BASE_URL: str = os.getenv(
    "DEEPSEEK_BASE_URL", "https://api.deepseek.com"
)

SUPPORTED_PROVIDERS = ("claude", "deepseek")
DEFAULT_PROVIDER: str = os.getenv("DEFAULT_LLM_PROVIDER", "claude")


def normalize_provider(provider: str | None) -> str:
    value = (provider or DEFAULT_PROVIDER).strip().lower()
    if value not in SUPPORTED_PROVIDERS:
        raise ValueError(
            f"Unsupported provider '{provider}'. "
            f"Use one of: {', '.join(SUPPORTED_PROVIDERS)}."
        )
    return value


def require_api_key() -> str:
    """Return the Anthropic API key or raise a clear error if missing."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "Copy .env.example to .env and add your key."
        )
    return ANTHROPIC_API_KEY


def require_deepseek_api_key() -> str:
    if not DEEPSEEK_API_KEY:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set. "
            "Add it to your .env to use the DeepSeek provider."
        )
    return DEEPSEEK_API_KEY
