"""Приём текстового контента: нормализация и обрезка."""
from __future__ import annotations

from ..config import settings


def ingest_text(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").strip()
    if len(text) > settings.max_text_chars:
        text = text[: settings.max_text_chars]
    return text
