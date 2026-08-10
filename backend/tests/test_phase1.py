"""
Phase 1 manual validation script (not pytest).

Usage (from repo root):
    python -m backend.tests.test_phase1

Requires ANTHROPIC_API_KEY in .env
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow `python backend/tests/test_phase1.py` as well as -m
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.services.ai_analyzer import (  # noqa: E402
    AIAnalyzerError,
    analyze_gap,
    create_deep_dive_plans,
)


SAMPLE_JD = """
Data Scientist, Player Insights — Riot Games (Seattle / Remote)

About the role:
We're looking for a Data Scientist to join our Player Insights team. You'll partner
with game designers and product managers to understand player behavior, improve match
quality, and inform live-ops decisions across our portfolio.

What you'll do:
- Design and analyze A/B tests and other experiments that influence gameplay and
  monetization features
- Build reproducible ETL / analytics pipelines that process large volumes of game
  telemetry (match events, session logs, economy transactions)
- Develop statistical models and machine learning approaches for matchmaking quality,
  churn prediction, and player segmentation
- Create clear dashboards and data visualizations that product and design teams use
  weekly
- Communicate findings to technical and non-technical stakeholders

What you'll bring:
- Strong Python skills (pandas, scikit-learn, SQL fluency)
- Experience with distributed data processing (Spark, BigQuery, or similar)
- Solid foundation in statistics / experimental design (hypothesis testing, power
  analysis, causal inference basics)
- Ability to turn ambiguous product questions into measurable analyses
- Bonus: familiarity with game telemetry, live-service games, or recommendation systems
- Bonus: experience with streaming data (Kafka) or orchestration tools (Airflow)

Nice to have:
- Prior internship or project work involving large-scale behavioral data
- Portfolio projects that show end-to-end ownership: data ingest → modeling → insight
"""

SAMPLE_RESUME = """
Alex Chen
Computer Science B.S. Candidate | University of Washington | Graduating June 2027
Email: alex.chen@email.com | GitHub: github.com/alexchen

EDUCATION
University of Washington — B.S. Computer Science, Minor in Statistics
GPA: 3.7/4.0 | Relevant coursework: Machine Learning, Databases, Probability & Stats

EXPERIENCE
Data Analyst Intern — Campus Analytics Lab (Jun 2025 – Present)
- Analyzed student engagement survey data (n≈8,000) using Python/pandas
- Built interactive Plotly dashboards used by advising staff for weekly review
- Ran chi-square and t-tests to evaluate the impact of a new onboarding email campaign

Research Assistant — UW HCI Group (Jan 2025 – May 2025)
- Cleaned and labeled behavioral log data from a mobile study app
- Trained a logistic regression model to predict task completion (AUC 0.81)
- Presented findings in a lab talk to 15 researchers

PROJECTS
Campus Course Recommender
- Built a content-based recommender in Python/scikit-learn for UW course catalogs
- Scraped course descriptions, engineered TF-IDF features, evaluated with precision@k

Personal Finance Tracker
- Flask web app that imports CSV bank exports and visualizes spending categories
- SQLite backend; deployed a demo on Render

SKILLS
Python, pandas, scikit-learn, SQL (PostgreSQL), Plotly, Flask, Git
Familiar: R, Tableau
"""


def _print_header(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def _pretty(obj) -> str:
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(), indent=2, ensure_ascii=False)
    return json.dumps(obj, indent=2, ensure_ascii=False)


def main() -> None:
    _print_header("Phase 1 — Round 1: Gap Analysis")
    print("Calling Claude with sample Riot Games Data Scientist JD + mock resume...\n")

    try:
        analysis = analyze_gap(SAMPLE_JD, SAMPLE_RESUME)
    except (AIAnalyzerError, RuntimeError, ValueError) as exc:
        print(f"[ERROR] Round 1 failed: {exc}")
        sys.exit(1)

    print(_pretty(analysis))
    print(f"\nMatch score: {analysis.match_score}")
    print(f"Suggestions ({len(analysis.suggestions)}):")
    for i, s in enumerate(analysis.suggestions, 1):
        print(f"  {i}. [{s.priority}] {s.title} — {s.estimated_time}")

    # Simulate: user picks first suggestion + adds their own preference notes.
    selected = analysis.suggestions[:1]
    user_notes = (
        "I like the overall project direction, but please avoid finance/banking "
        "datasets. I want to work with game match / player telemetry data instead, "
        "using free public APIs where possible."
    )
    titles = ", ".join(s.title for s in selected)
    _print_header(
        f"Phase 1 — Round 2: Deep Dive Plans\nSelected ({len(selected)}): {titles}"
    )
    print(f"User notes: {user_notes}\n")
    print("Calling Claude for a step-by-step plan per selected suggestion...\n")

    try:
        plans = create_deep_dive_plans(
            selected, SAMPLE_JD, SAMPLE_RESUME, user_notes=user_notes
        )
    except (AIAnalyzerError, RuntimeError, ValueError) as exc:
        print(f"[ERROR] Round 2 failed: {exc}")
        sys.exit(1)

    for i, plan in enumerate(plans, 1):
        _print_header(f"Plan {i}/{len(plans)}: {plan.plan_title}")
        print(_pretty(plan))
        print("\n--- Resume bullet ---")
        print(plan.resume_bullet)

    print("\nDone. Phase 1 manual validation complete.")


if __name__ == "__main__":
    main()
