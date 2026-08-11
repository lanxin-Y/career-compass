"""Pydantic models for Claude gap analysis and deep-dive plan outputs."""

from typing import Literal

from pydantic import BaseModel, Field


class SkillGap(BaseModel):
    skill: str
    importance: Literal["high", "medium", "low"]
    detail: str


class Suggestion(BaseModel):
    title: str
    why: str
    examples: list[str] = Field(min_length=2, max_length=3)
    estimated_time: str
    priority: Literal["high", "medium", "low"]


class AnalysisResult(BaseModel):
    """Round 1: gap analysis response."""

    match_score: int = Field(ge=0, le=100)
    matching_skills: list[str]
    skill_gaps: list[SkillGap]
    suggestions: list[Suggestion] = Field(min_length=3, max_length=5)
    keywords: list[str]


class Resource(BaseModel):
    name: str
    url: str


class PlanStep(BaseModel):
    step_number: int = Field(ge=1)
    title: str
    tasks: list[str]
    estimated_days: int = Field(ge=1, le=3)
    resources: list[Resource] = Field(default_factory=list)


class ChecklistTask(BaseModel):
    """A single checkable todo derived for the frontend task list."""

    title: str
    timeframe: str


class DetailedPlan(BaseModel):
    """Round 2: deep-dive execution plan response."""

    plan_title: str
    description: str
    total_estimated_days: int = Field(ge=1)
    steps: list[PlanStep] = Field(min_length=3, max_length=6)
    # Top-level checklist for todo UI (separate from steps[].tasks strings)
    tasks: list[ChecklistTask] = Field(min_length=4, max_length=8)
    success_criteria: str
    resume_bullet: str
