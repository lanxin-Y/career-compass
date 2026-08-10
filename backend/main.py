"""Career Compass FastAPI application (Phase 2)."""

from __future__ import annotations

import asyncio
import hashlib
import logging
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
from database import (  # noqa: E402
    find_analysis_by_hash,
    get_all_analyses,
    get_analysis,
    get_deep_dives_for_analysis,
    init_db,
    save_analysis,
    save_deep_dive,
)
from schemas import (  # noqa: E402
    AnalysisDetailResponse,
    AnalysisResponse,
    AnalysisSummary,
    DeepDiveRequest,
    DeepDiveResponse,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
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
        cached=cached,
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
):
    if not jd_text or not jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text must be non-empty.")

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

    digest = _content_hash(jd_text, resume_text)
    cached = await find_analysis_by_hash(digest)
    if cached is not None:
        return _analysis_response(cached, cached=True)

    try:
        result = await asyncio.to_thread(analyze_gap, jd_text, resume_text)
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
    return DeepDiveResponse(
        id=deep_dive_id,
        analysis_id=body.analysis_id,
        suggestion_key=body.suggestion_key,
        plan=plan,
        created_at=datetime.now(timezone.utc),
    )


@app.get("/api/history", response_model=list[AnalysisSummary])
async def history():
    rows = await get_all_analyses()
    return [
        AnalysisSummary(
            id=row["id"],
            job_title=row.get("job_title"),
            company=row.get("company"),
            created_at=_parse_datetime(row["created_at"]),
        )
        for row in rows
    ]


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
    return AnalysisDetailResponse(
        id=analysis["id"],
        job_title=analysis.get("job_title"),
        company=analysis.get("company"),
        result=analysis["result"],
        created_at=_parse_datetime(analysis["created_at"]),
        deep_dives=[
            DeepDiveResponse(
                id=item["id"],
                analysis_id=item["analysis_id"],
                suggestion_key=item["suggestion_key"],
                plan=item["plan"],
                created_at=_parse_datetime(item["created_at"]),
            )
            for item in deep_dives
        ],
    )
