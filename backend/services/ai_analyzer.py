"""Two-round Claude API logic: gap analysis + deep-dive plan."""

from __future__ import annotations

import json
import logging
import re
from typing import TypeVar

import anthropic
from pydantic import BaseModel, ValidationError

from .config import MAX_TOKENS, MODEL_NAME, TEMPERATURE, require_api_key
from .schemas import AnalysisResult, DetailedPlan, Suggestion

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class AIAnalyzerError(Exception):
    """Raised when Claude analysis fails in a recoverable/user-facing way."""


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

GAP_ANALYSIS_SYSTEM = """\
You are an experienced career mentor for students and early-career professionals \
across any field (tech, product, design, sales, research, operations, and beyond).

Your job: compare a candidate's resume against a job description and produce \
specific, energizing growth advice — NOT generic tips (e.g. "learn SQL", \
"practice LeetCode", "network more", "improve communication").

Tone: encouraging, practical, specific — like a sharp mentor who knows THAT industry.

Industry & role inference (critical):
- Do NOT assume gaming, tech, finance, or any other industry by default.
- Infer industry, company context, and role type from the JD itself \
  (and use the resume only as candidate evidence).
- Tailor matching_skills, skill_gaps, suggestions, examples, and keywords \
  to that inferred domain. A PM JD should get PM-style projects; a design JD \
  should get design-portfolio style work; a sales JD should get sales-relevant \
  practice — never force software-engineering projects onto non-engineering roles.

Respond with ONLY valid JSON. No markdown fences, no commentary, no trailing text.

JSON schema:
{
  "match_score": <integer 0-100>,
  "matching_skills": [<strings the candidate clearly demonstrates>],
  "skill_gaps": [
    {
      "skill": <string>,
      "importance": "high" | "medium" | "low",
      "detail": <why this gap matters for THIS JD, tied to resume evidence>
    }
  ],
  "suggestions": [
    {
      "title": <project or growth path name — concrete and exciting>,
      "why": <how this bridges a real gap for this role>,
      "examples": [<2-3 concrete project/experience ideas the user can picture>],
      "estimated_time": <realistic for a student working part-time, e.g. "1-2 weeks">,
      "priority": "high" | "medium" | "low"
    }
  ],
  "keywords": [<JD terms the candidate should weave into their resume>]
}

Rules:
- match_score must reflect honest fit, not flattery.
- skill_gaps: prioritize gaps that would block or weaken an application for THIS role.
- suggestions: return 3-5 items. Each must feel like a real starting point someone \
  would be excited to pursue — portfolio projects, domain deep-dives, or targeted \
  experiences appropriate to the inferred field — never vague advice.
- Each suggestion needs 2-3 concrete examples (specific enough to start tomorrow), \
  grounded in the JD's domain (tools, artifacts, and success signals that role cares about).
- estimated_time must be realistic for part-time student schedules.
- keywords: pull from the JD language recruiters/ATS care about for that role.
"""

DEEP_DIVE_SYSTEM = """\
You are an experienced career mentor helping a student turn one growth suggestion \
into a concrete, checklist-style execution plan.

Tone: encouraging, practical, specific. Steps should be achievable in evenings/weekends.

Industry & role inference (critical):
- Infer industry and role type from the JD (do not default to gaming or software engineering).
- Choose tools, resources, tasks, success criteria, and the resume bullet that fit \
  THAT domain and the selected suggestion — e.g. Figma/case-study steps for design, \
  experiment/PRD steps for PM, pipeline/code steps for data/engineering, etc.

Respond with ONLY valid JSON. No markdown fences, no commentary, no trailing text.

JSON schema:
{
  "plan_title": <specific, motivating title>,
  "description": <2-4 sentences on what they'll build/learn and why it helps for the JD>,
  "total_estimated_days": <integer>,
  "steps": [
    {
      "step_number": <1-based int>,
      "title": <short step title>,
      "tasks": [<checklist items for this step>],
      "estimated_days": <1, 2, or 3>,
      "resources": [
        {"name": <resource name>, "url": <real useful URL>}
      ]
    }
  ],
  "success_criteria": <clear definition of "done" the user can verify>,
  "resume_bullet": <one strong, ready-to-use resume bullet in past tense with impact>
}

Rules:
- Provide 3-6 steps. Each step should be achievable in 1-3 days part-time.
- tasks should be actionable checkboxes, not vague goals.
- resources: only include real, useful links you are confident about; otherwise omit \
  or leave resources as []. Prefer domain-appropriate resources for the inferred field.
- Tailor the plan to the selected suggestion AND the original JD + resume context.
- If USER NOTES are provided: treat them as high-priority preferences/constraints. \
  Keep the suggestion's overall learning goal and skill-building intent, but adapt \
  domain, dataset, tools, or examples when the user requests changes \
  (e.g. same pipeline project idea, but game data instead of finance data). \
  Do not ignore user notes when they conflict with suggestion examples.
- resume_bullet should sound credible for a student/early-career candidate in that \
  field and reference concrete tools/outcomes from the plan.
"""


def _gap_analysis_user_prompt(jd_text: str, resume_text: str) -> str:
    return f"""\
Compare this resume against the job description and produce the gap analysis JSON.

=== JOB DESCRIPTION ===
{jd_text.strip()}

=== RESUME ===
{resume_text.strip()}
"""


def _deep_dive_user_prompt(
    suggestion: Suggestion,
    jd_text: str,
    resume_text: str,
    user_notes: str | None = None,
) -> str:
    suggestion_json = suggestion.model_dump_json(indent=2)
    notes = (user_notes or "").strip()
    notes_block = (
        f"\n=== USER NOTES (preferences / constraints — high priority) ===\n{notes}\n"
        if notes
        else "\n=== USER NOTES ===\n(none provided)\n"
    )
    return f"""\
Create a detailed step-by-step execution plan for the selected suggestion below.
Honor USER NOTES when present: keep the core growth intent of the suggestion, \
but adapt specifics (domain, dataset, tools, framing) to the user's preferences.

=== SELECTED SUGGESTION ===
{suggestion_json}
{notes_block}
=== ORIGINAL JOB DESCRIPTION ===
{jd_text.strip()}

=== RESUME ===
{resume_text.strip()}
"""


# ---------------------------------------------------------------------------
# Claude client helpers
# ---------------------------------------------------------------------------

def _get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=require_api_key())


def _extract_json_text(raw: str) -> str:
    """Pull JSON object text from a model response, tolerating markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        # ```json ... ``` or ``` ... ```
        text = re.sub(r"^```(?:json)?\s*", "", text, count=1, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text, count=1)

    # If there's leading prose, find the outermost JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise AIAnalyzerError("Claude response did not contain a JSON object.")
    return text[start : end + 1]


def _parse_model_output(raw: str, model: type[T]) -> T:
    try:
        payload = json.loads(_extract_json_text(raw))
    except json.JSONDecodeError as exc:
        raise AIAnalyzerError(f"Failed to parse Claude JSON: {exc}") from exc

    try:
        return model.model_validate(payload)
    except ValidationError as exc:
        raise AIAnalyzerError(f"Claude JSON failed schema validation: {exc}") from exc


def _call_claude(system: str, user: str) -> str:
    client = _get_client()
    try:
        message = client.messages.create(
            model=MODEL_NAME,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except anthropic.RateLimitError as exc:
        raise AIAnalyzerError(
            "Claude API rate limit hit. Wait a moment and try again."
        ) from exc
    except anthropic.AuthenticationError as exc:
        raise AIAnalyzerError(
            "Claude API authentication failed. Check ANTHROPIC_API_KEY."
        ) from exc
    except anthropic.APIStatusError as exc:
        raise AIAnalyzerError(
            f"Claude API error ({exc.status_code}): {exc.message}"
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise AIAnalyzerError(
            "Could not connect to Claude API. Check your network."
        ) from exc
    except anthropic.APIError as exc:
        raise AIAnalyzerError(f"Claude API request failed: {exc}") from exc

    parts: list[str] = []
    for block in message.content:
        if hasattr(block, "text"):
            parts.append(block.text)

    if not parts:
        raise AIAnalyzerError("Claude returned an empty response.")

    # Soft warning if truncated
    if message.stop_reason == "max_tokens":
        logger.warning("Claude response truncated (hit max_tokens=%s).", MAX_TOKENS)

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_gap(jd_text: str, resume_text: str) -> AnalysisResult:
    """
    Round 1: Compare resume vs JD and return structured gap analysis.

    Args:
        jd_text: Full job description text.
        resume_text: Extracted resume text.

    Returns:
        Validated AnalysisResult.
    """
    _require_jd_and_resume(jd_text, resume_text)

    raw = _call_claude(
        GAP_ANALYSIS_SYSTEM,
        _gap_analysis_user_prompt(jd_text, resume_text),
    )
    return _parse_model_output(raw, AnalysisResult)


def _require_jd_and_resume(jd_text: str, resume_text: str) -> None:
    if not jd_text or not jd_text.strip():
        raise ValueError("jd_text must be non-empty.")
    if not resume_text or not resume_text.strip():
        raise ValueError("resume_text must be non-empty.")


def _normalize_suggestion(suggestion: Suggestion | dict) -> Suggestion:
    if isinstance(suggestion, Suggestion):
        return suggestion
    try:
        return Suggestion.model_validate(suggestion)
    except ValidationError as exc:
        raise ValueError(f"Invalid suggestion object: {exc}") from exc


def create_deep_dive_plan(
    suggestion: Suggestion | dict,
    jd_text: str,
    resume_text: str,
    user_notes: str | None = None,
) -> DetailedPlan:
    """
    Round 2: Turn one selected Round-1 suggestion into a step-by-step plan.

    Args:
        suggestion: One Suggestion the user selected (model or dict).
        jd_text: Original job description text.
        resume_text: Original resume text.
        user_notes: Optional free-text preferences from the user, e.g.
            "Keep this project idea, but use game data instead of finance data."

    Returns:
        Validated DetailedPlan.
    """
    _require_jd_and_resume(jd_text, resume_text)
    suggestion = _normalize_suggestion(suggestion)

    raw = _call_claude(
        DEEP_DIVE_SYSTEM,
        _deep_dive_user_prompt(suggestion, jd_text, resume_text, user_notes),
    )
    return _parse_model_output(raw, DetailedPlan)


def create_deep_dive_plans(
    suggestions: list[Suggestion | dict],
    jd_text: str,
    resume_text: str,
    user_notes: str | list[str | None] | None = None,
) -> list[DetailedPlan]:
    """
    Round 2 (multi-select): build a deep-dive plan for each selected suggestion.

    Each suggestion gets its own Claude call so plans stay focused and high-quality.
    Order of returned plans matches the order of input suggestions.

    Args:
        suggestions: One or more suggestions the user selected.
        jd_text: Original job description text.
        resume_text: Original resume text.
        user_notes: Optional notes for all suggestions (one string), or a list of
            notes aligned with `suggestions` (use None for "no notes" on an item).

    Returns:
        List of DetailedPlan, one per selected suggestion.
    """
    _require_jd_and_resume(jd_text, resume_text)
    if not suggestions:
        raise ValueError("suggestions must contain at least one item.")

    if user_notes is None or isinstance(user_notes, str):
        notes_list: list[str | None] = [user_notes] * len(suggestions)
    else:
        if len(user_notes) != len(suggestions):
            raise ValueError(
                "user_notes list length must match suggestions length "
                f"({len(user_notes)} != {len(suggestions)})."
            )
        notes_list = list(user_notes)

    plans: list[DetailedPlan] = []
    for index, item in enumerate(suggestions):
        try:
            plans.append(
                create_deep_dive_plan(
                    item, jd_text, resume_text, user_notes=notes_list[index]
                )
            )
        except AIAnalyzerError as exc:
            raise AIAnalyzerError(
                f"Deep-dive failed for suggestion at index {index}: {exc}"
            ) from exc
    return plans
