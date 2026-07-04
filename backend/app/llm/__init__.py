"""Выбор LLM-провайдера с корректной деградацией при отсутствии ключа."""
from __future__ import annotations

from ..config import settings
from .base import LLMProvider
from .stub import StubProvider


def get_provider() -> LLMProvider:
    if settings.llm_enabled:
        try:
            from .claude import ClaudeProvider

            return ClaudeProvider()
        except Exception:  # noqa: BLE001 - падение импорта/инициализации не должно ронять сервис
            return StubProvider()
    return StubProvider()
