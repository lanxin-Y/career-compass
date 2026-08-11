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
    cached: bool = False


class AnalysisSummary(BaseModel):
    id: str
    job_title: Optional[str] = None
    company: Optional[str] = None
    created_at: datetime


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
    deep_dives: list[DeepDiveResponse]


class ErrorResponse(BaseModel):
    detail: str
