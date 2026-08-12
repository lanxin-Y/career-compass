"""Pydantic request/response models for the FastAPI layer."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class DeepDiveRequest(BaseModel):
    analysis_id: str
    suggestion_key: str = Field(
        ...,
        description='Suggestion index, e.g. "0" or "suggestions[0]", or exact title',
    )
    user_notes: Optional[str] = Field(
        default=None,
        description="Optional user preferences to steer the deep-dive plan",
    )
    provider: str = Field(
        default="claude",
        description='LLM provider: "claude" or "deepseek"',
    )


class ManualTaskInput(BaseModel):
    title: str = Field(..., min_length=1)
    timeframe: Optional[str] = Field(
        default=None,
        description='e.g. "3 days", "1 week"',
    )


class ManualPlanRequest(BaseModel):
    """User-authored project in the same shape as an AI deep-dive plan."""

    title: str = Field(..., min_length=1)
    description: str = ""
    estimated_time: Optional[str] = Field(
        default=None,
        description="Overall estimate for the whole project, e.g. '2 weeks'",
    )
    tasks: list[ManualTaskInput] = Field(min_length=1)


class ToggleTaskRequest(BaseModel):
    is_completed: bool


class TaskResponse(BaseModel):
    id: str
    deep_dive_id: str
    title: str
    timeframe: Optional[str] = None
    sort_order: int
    is_completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime


class AnalysisResponse(BaseModel):
    id: str
    job_title: Optional[str] = None
    company: Optional[str] = None
    result: dict[str, Any]
    created_at: datetime
    deadline: Optional[str] = None
    cached: bool = False


class AnalysisSummary(BaseModel):
    id: str
    job_title: Optional[str] = None
    company: Optional[str] = None
    created_at: datetime
    deadline: Optional[str] = None


class DeadlineUpdateRequest(BaseModel):
    deadline: Optional[str] = Field(
        default=None,
        description='YYYY-MM-DD, or null/empty to clear',
    )


class DeepDiveResponse(BaseModel):
    id: str
    analysis_id: str
    suggestion_key: str
    plan: dict[str, Any]
    created_at: datetime
    tasks: list[TaskResponse] = Field(default_factory=list)


class AnalysisDetailResponse(BaseModel):
    id: str
    job_title: Optional[str] = None
    company: Optional[str] = None
    result: dict[str, Any]
    created_at: datetime
    deadline: Optional[str] = None
    deep_dives: list[DeepDiveResponse]


class ErrorResponse(BaseModel):
    detail: str
