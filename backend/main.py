"""Career Compass FastAPI application (Phase 2)."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load env from backend/ then repo root
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env")

from ai_core import (  # noqa: E402
    AIAnalyzerError,
    analyze_gap,
    generate_deep_dive,
    parse_resume_pdf,
)
from services.config import normalize_provider  # noqa: E402
from database import (  # noqa: E402
    MANUAL_ANALYSIS_ID,
    delete_deep_dive,
    find_analysis_by_hash,
    get_all_analyses,
    get_all_deep_dives,
    get_all_tasks,
    get_analysis,
    get_deep_dive,
    get_deep_dives_for_analysis,
    get_tasks_for_deep_dive,
    init_db,
    save_analysis,
    save_deep_dive,
    save_tasks,
    toggle_task,
    update_analysis_deadline,
)
from schemas import (  # noqa: E402
    AnalysisDetailResponse,
    AnalysisResponse,
    AnalysisSummary,
    DeadlineUpdateRequest,
    DeepDiveRequest,
    DeepDiveResponse,
    ManualPlanRequest,
    TaskResponse,
    ToggleTaskRequest,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Career Compass API",
    description="AI-powered career gap analysis and growth planning",
    version="0.2.0",
    lifespan=lifespan,
)

_allowed_origins = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    # SQLite CURRENT_TIMESTAMP: "YYYY-MM-DD HH:MM:SS"
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")


def _content_hash(jd_text: str, resume_text: str) -> str:
    payload = (jd_text.strip() + "\n---\n" + resume_text.strip()).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _resolve_suggestion(result: dict, suggestion_key: str) -> dict:
    suggestions = result.get("suggestions") or []
    if not isinstance(suggestions, list) or not suggestions:
        raise ValueError("Analysis has no suggestions to deep-dive.")

    key = suggestion_key.strip()
    bracket = re.fullmatch(r"suggestions\[(\d+)\]", key)
    if bracket:
        idx = int(bracket.group(1))
    elif key.isdigit():
        idx = int(key)
    else:
        for suggestion in suggestions:
            if suggestion.get("title") == key:
                return suggestion
        raise ValueError(
            f'suggestion_key "{suggestion_key}" did not match any suggestion '
            '(use "0", "suggestions[0]", or the exact suggestion title).'
        )

    if idx < 0 or idx >= len(suggestions):
        raise ValueError(
            f"suggestion_key index {idx} out of range "
            f"(0-{len(suggestions) - 1})."
        )
    return suggestions[idx]


def _analysis_response(row: dict, *, cached: bool = False) -> AnalysisResponse:
    return AnalysisResponse(
        id=row["id"],
        job_title=row.get("job_title"),
        company=row.get("company"),
        result=row["result"],
        created_at=_parse_datetime(row["created_at"]),
        deadline=row.get("deadline") or None,
        cached=cached,
    )


def _normalize_deadline(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    # Expect YYYY-MM-DD
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        raise HTTPException(
            status_code=400,
            detail='deadline must be YYYY-MM-DD (or empty to clear).',
        )
    return text


def _task_response(row: dict) -> TaskResponse:
    completed_at = row.get("completed_at")
    return TaskResponse(
        id=row["id"],
        deep_dive_id=row["deep_dive_id"],
        title=row["title"],
        timeframe=row.get("timeframe"),
        sort_order=row["sort_order"],
        is_completed=bool(row["is_completed"]),
        completed_at=_parse_datetime(completed_at) if completed_at else None,
        created_at=_parse_datetime(row["created_at"]),
    )


def _extract_checklist_tasks(plan: dict) -> list[dict]:
    """
    Prefer top-level plan['tasks'] (title/timeframe dicts).
    Fallback: flatten steps into checklist items if AI omitted top-level tasks.
    """
    raw = plan.get("tasks")
    if isinstance(raw, list) and raw:
        if isinstance(raw[0], dict) and raw[0].get("title"):
            return [
                {
                    "title": item["title"],
                    "timeframe": item.get("timeframe"),
                }
                for item in raw
                if isinstance(item, dict) and item.get("title")
            ]

    # Fallback from detailed steps
    fallback: list[dict] = []
    for step in plan.get("steps") or []:
        if not isinstance(step, dict):
            continue
        title = step.get("title") or "Untitled step"
        days = step.get("estimated_days")
        timeframe = f"{days} days" if days else None
        fallback.append({"title": title, "timeframe": timeframe})
    return fallback


async def _deep_dive_response(item: dict, tasks: list[dict] | None = None) -> DeepDiveResponse:
    if tasks is None:
        tasks = await get_tasks_for_deep_dive(item["id"])
    return DeepDiveResponse(
        id=item["id"],
        analysis_id=item["analysis_id"],
        suggestion_key=item["suggestion_key"],
        plan=item["plan"],
        created_at=_parse_datetime(item["created_at"]),
        tasks=[_task_response(t) for t in tasks],
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post(
    "/api/analyze",
    response_model=AnalysisResponse,
    responses={400: {"description": "Bad request"}, 502: {"description": "AI failure"}},
)
async def analyze(
    jd_text: str = Form(...),
    resume: UploadFile = File(...),
    job_title: str | None = Form(None),
    company: str | None = Form(None),
    provider: str = Form("claude"),
):
    if not jd_text or not jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text must be non-empty.")

    try:
        provider = normalize_provider(provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    filename = resume.filename or "resume.pdf"
    content_type = (resume.content_type or "").lower()
    if not filename.lower().endswith(".pdf") and content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Resume must be a PDF file.")

    pdf_bytes = await resume.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        try:
            resume_text = await asyncio.to_thread(parse_resume_pdf, tmp_path)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)

    # Cache is shared across providers: same JD + resume returns existing result.
    digest = _content_hash(jd_text, resume_text)
    cached = await find_analysis_by_hash(digest)
    if cached is not None:
        return _analysis_response(cached, cached=True)

    try:
        result = await asyncio.to_thread(analyze_gap, jd_text, resume_text, provider)
    except AIAnalyzerError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        # Missing API key, etc.
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    analysis_id = str(uuid.uuid4())
    await save_analysis(
        analysis_id=analysis_id,
        job_title=job_title,
        company=company,
        jd_text=jd_text,
        resume_text=resume_text,
        resume_filename=filename,
        content_hash=digest,
        result_json=result,
    )
    row = await get_analysis(analysis_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to persist analysis.")
    return _analysis_response(row, cached=False)


@app.post(
    "/api/deep-dive",
    response_model=DeepDiveResponse,
    responses={
        400: {"description": "Bad request"},
        404: {"description": "Not found"},
        502: {"description": "AI failure"},
    },
)
async def deep_dive(body: DeepDiveRequest):
    analysis = await get_analysis(body.analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    try:
        provider = normalize_provider(body.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        suggestion = _resolve_suggestion(analysis["result"], body.suggestion_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        plan = await asyncio.to_thread(
            generate_deep_dive,
            suggestion,
            analysis["jd_text"],
            analysis["resume_text"],
            body.user_notes,
            provider,
        )
    except AIAnalyzerError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    deep_dive_id = str(uuid.uuid4())
    await save_deep_dive(
        deep_dive_id=deep_dive_id,
        analysis_id=body.analysis_id,
        suggestion_key=body.suggestion_key,
        plan_json=plan,
    )
    checklist = _extract_checklist_tasks(plan)
    await save_tasks(deep_dive_id, checklist)
    tasks = await get_tasks_for_deep_dive(deep_dive_id)

    return DeepDiveResponse(
        id=deep_dive_id,
        analysis_id=body.analysis_id,
        suggestion_key=body.suggestion_key,
        plan=plan,
        created_at=datetime.now(timezone.utc),
        tasks=[_task_response(t) for t in tasks],
    )


@app.post(
    "/api/plans/manual",
    response_model=DeepDiveResponse,
    responses={400: {"description": "Bad request"}},
)
async def create_manual_plan(body: ManualPlanRequest):
    """Create a user-authored project (same storage shape as AI deep-dives)."""
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title must be non-empty.")

    checklist = [
        {"title": item.title.strip(), "timeframe": (item.timeframe or "").strip() or None}
        for item in body.tasks
        if item.title and item.title.strip()
    ]
    if not checklist:
        raise HTTPException(status_code=400, detail="Add at least one sub-task.")

    plan = {
        "plan_title": title,
        "description": (body.description or "").strip(),
        "estimated_time": (body.estimated_time or "").strip() or None,
        "total_estimated_days": 0,
        "steps": [
            {
                "step_number": i + 1,
                "title": item["title"],
                "tasks": [item["title"]],
                "estimated_days": 1,
                "resources": [],
            }
            for i, item in enumerate(checklist)
        ],
        "tasks": checklist,
        "success_criteria": "",
        "resume_bullet": "",
        "source": "manual",
    }

    deep_dive_id = str(uuid.uuid4())
    await save_deep_dive(
        deep_dive_id=deep_dive_id,
        analysis_id=MANUAL_ANALYSIS_ID,
        suggestion_key="manual",
        plan_json=plan,
    )
    await save_tasks(deep_dive_id, checklist)
    tasks = await get_tasks_for_deep_dive(deep_dive_id)
    return DeepDiveResponse(
        id=deep_dive_id,
        analysis_id=MANUAL_ANALYSIS_ID,
        suggestion_key="manual",
        plan=plan,
        created_at=datetime.now(timezone.utc),
        tasks=[_task_response(t) for t in tasks],
    )


@app.get("/api/deep-dives", response_model=list[DeepDiveResponse])
async def list_all_deep_dives():
    """All plans (AI + manual), each with checklist tasks — for Dashboard Todo."""
    dives = await get_all_deep_dives()
    return [await _deep_dive_response(item) for item in dives]


@app.get("/api/all-tasks", response_model=list[TaskResponse])
async def list_all_tasks():
    """Lightweight task list for XP / StatsBar (includes manual projects)."""
    return [_task_response(t) for t in await get_all_tasks()]


@app.patch(
    "/api/tasks/{task_id}",
    response_model=TaskResponse,
    responses={404: {"description": "Not found"}},
)
async def patch_task(task_id: str, body: ToggleTaskRequest):
    updated = await toggle_task(task_id, body.is_completed)
    if updated is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return _task_response(updated)


@app.get(
    "/api/deep-dive/{deep_dive_id}",
    response_model=DeepDiveResponse,
    responses={404: {"description": "Not found"}},
)
async def deep_dive_detail(deep_dive_id: str):
    dive = await get_deep_dive(deep_dive_id)
    if dive is None:
        raise HTTPException(status_code=404, detail="Deep-dive not found.")
    return await _deep_dive_response(dive)


@app.delete(
    "/api/deep-dive/{deep_dive_id}",
    responses={404: {"description": "Not found"}},
)
async def remove_deep_dive(deep_dive_id: str):
    deleted = await delete_deep_dive(deep_dive_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Deep-dive not found.")
    return {"ok": True, "id": deep_dive_id}


@app.get(
    "/api/deep-dive/{deep_dive_id}/tasks",
    response_model=list[TaskResponse],
    responses={404: {"description": "Not found"}},
)
async def list_deep_dive_tasks(deep_dive_id: str):
    dive = await get_deep_dive(deep_dive_id)
    if dive is None:
        raise HTTPException(status_code=404, detail="Deep-dive not found.")
    tasks = await get_tasks_for_deep_dive(deep_dive_id)
    return [_task_response(t) for t in tasks]


@app.get("/api/history", response_model=list[AnalysisSummary])
async def history():
    rows = await get_all_analyses()
    return [
        AnalysisSummary(
            id=row["id"],
            job_title=row.get("job_title"),
            company=row.get("company"),
            created_at=_parse_datetime(row["created_at"]),
            deadline=row.get("deadline") or None,
        )
        for row in rows
    ]


@app.patch(
    "/api/analysis/{analysis_id}/deadline",
    response_model=AnalysisSummary,
    responses={400: {"description": "Bad request"}, 404: {"description": "Not found"}},
)
async def patch_analysis_deadline(analysis_id: str, body: DeadlineUpdateRequest):
    deadline = _normalize_deadline(body.deadline)
    updated = await update_analysis_deadline(analysis_id, deadline)
    if updated is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return AnalysisSummary(
        id=updated["id"],
        job_title=updated.get("job_title"),
        company=updated.get("company"),
        created_at=_parse_datetime(updated["created_at"]),
        deadline=updated.get("deadline") or None,
    )


@app.get(
    "/api/analysis/{analysis_id}",
    response_model=AnalysisDetailResponse,
    responses={404: {"description": "Not found"}},
)
async def analysis_detail(analysis_id: str):
    analysis = await get_analysis(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    deep_dives = await get_deep_dives_for_analysis(analysis_id)
    dive_responses: list[DeepDiveResponse] = []
    for item in deep_dives:
        dive_responses.append(await _deep_dive_response(item))

    return AnalysisDetailResponse(
        id=analysis["id"],
        job_title=analysis.get("job_title"),
        company=analysis.get("company"),
        result=analysis["result"],
        created_at=_parse_datetime(analysis["created_at"]),
        deadline=analysis.get("deadline") or None,
        deep_dives=dive_responses,
    )
