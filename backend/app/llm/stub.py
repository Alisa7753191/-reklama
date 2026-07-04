"""Заглушка LLM-провайдера.

Используется, когда не задан ANTHROPIC_API_KEY. Возвращает пустой список
смысловых находок, чтобы приложение полностью работало в режиме «только правила».
"""
from __future__ import annotations

from typing import List

from ..models import Finding
from .base import LLMProvider


class StubProvider(LLMProvider):
    name = "stub"
    available = False

    def analyze(self, text: str, categories: List[str]) -> List[Finding]:
        return []
