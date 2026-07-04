"""Точка входа FastAPI."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api.routes import router
from .config import settings

app = FastAPI(
    title="Проверка рекламы на правовые риски (РФ)",
    description=(
        "MVP-сервис проверки рекламных коммуникаций на соответствие "
        "законодательству РФ (ФЗ-38 «О рекламе» и смежные нормы). "
        "Гибрид: детерминированные правила + LLM."
    ),
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
def root() -> dict:
    return {"service": "ad-compliance-ru", "version": __version__, "docs": "/docs"}
