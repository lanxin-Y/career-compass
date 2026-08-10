"""Async SQLite persistence for analyses and deep-dive plans."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import aiosqlite

DB_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DB_DIR / "career_compass.db"


async def init_db() -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id TEXT PRIMARY KEY,
                job_title TEXT,
                company TEXT,
                jd_text TEXT NOT NULL,
                resume_text TEXT NOT NULL,
                resume_filename TEXT,
                content_hash TEXT,
                result_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS deep_dives (
                id TEXT PRIMARY KEY,
                analysis_id TEXT NOT NULL,
                suggestion_key TEXT NOT NULL,
                plan_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (analysis_id) REFERENCES analyses(id)
            )
            """
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_analyses_content_hash "
            "ON analyses(content_hash)"
        )
        await db.commit()


def _row_to_analysis(row: aiosqlite.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "job_title": row["job_title"],
        "company": row["company"],
        "jd_text": row["jd_text"],
        "resume_text": row["resume_text"],
        "resume_filename": row["resume_filename"],
        "content_hash": row["content_hash"],
        "result": json.loads(row["result_json"]),
        "created_at": row["created_at"],
    }


async def find_analysis_by_hash(content_hash: str) -> dict[str, Any] | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM analyses WHERE content_hash = ? "
            "ORDER BY created_at DESC LIMIT 1",
            (content_hash,),
        ) as cursor:
            row = await cursor.fetchone()
    if row is None:
        return None
    return _row_to_analysis(row)


async def save_analysis(
    analysis_id: str,
    job_title: str | None,
    company: str | None,
    jd_text: str,
    resume_text: str,
    resume_filename: str | None,
    content_hash: str,
    result_json: str | dict[str, Any],
) -> str:
    payload = (
        result_json
        if isinstance(result_json, str)
        else json.dumps(result_json, ensure_ascii=False)
    )
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO analyses (
                id, job_title, company, jd_text, resume_text,
                resume_filename, content_hash, result_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                job_title,
                company,
                jd_text,
                resume_text,
                resume_filename,
                content_hash,
                payload,
            ),
        )
        await db.commit()
    return analysis_id


async def save_deep_dive(
    deep_dive_id: str,
    analysis_id: str,
    suggestion_key: str,
    plan_json: str | dict[str, Any],
) -> str:
    payload = (
        plan_json
        if isinstance(plan_json, str)
        else json.dumps(plan_json, ensure_ascii=False)
    )
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO deep_dives (id, analysis_id, suggestion_key, plan_json)
            VALUES (?, ?, ?, ?)
            """,
            (deep_dive_id, analysis_id, suggestion_key, payload),
        )
        await db.commit()
    return deep_dive_id


async def get_analysis(analysis_id: str) -> dict[str, Any] | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM analyses WHERE id = ?",
            (analysis_id,),
        ) as cursor:
            row = await cursor.fetchone()
    if row is None:
        return None
    return _row_to_analysis(row)


async def get_all_analyses() -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, job_title, company, created_at
            FROM analyses
            ORDER BY created_at DESC
            """
        ) as cursor:
            rows = await cursor.fetchall()
    return [
        {
            "id": row["id"],
            "job_title": row["job_title"],
            "company": row["company"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


async def get_deep_dives_for_analysis(analysis_id: str) -> list[dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, analysis_id, suggestion_key, plan_json, created_at
            FROM deep_dives
            WHERE analysis_id = ?
            ORDER BY created_at DESC
            """,
            (analysis_id,),
        ) as cursor:
            rows = await cursor.fetchall()
    return [
        {
            "id": row["id"],
            "analysis_id": row["analysis_id"],
            "suggestion_key": row["suggestion_key"],
            "plan": json.loads(row["plan_json"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]
