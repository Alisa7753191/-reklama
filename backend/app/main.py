"""Точка входа FastAPI."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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


# Раздача собранного интерфейса тем же сервисом (единый публичный URL).
# Путь к сборке фронтенда: переменная FRONTEND_DIST (в Docker) или ../frontend/dist.
_dist = os.getenv(
    "FRONTEND_DIST",
    str(Path(__file__).resolve().parents[2] / "frontend" / "dist"),
)
if (Path(_dist) / "index.html").is_file():
    # Смонтировано ПОСЛЕ роутера /api и системных маршрутов (/docs, /openapi.json),
    # поэтому перехватывает только всё остальное и отдаёт SPA.
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
else:
    @app.get("/")
    def root() -> dict:
        return {"service": "ad-compliance-ru", "version": __version__, "docs": "/docs"}
