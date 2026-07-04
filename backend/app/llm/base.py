"""Базовый интерфейс LLM-провайдера."""
from __future__ import annotations

import abc
from typing import List

from ..models import Finding


class LLMProvider(abc.ABC):
    name: str = "base"
    available: bool = False

    @abc.abstractmethod
    def analyze(self, text: str, categories: List[str]) -> List[Finding]:
        """Вернуть список находок (рисков) по тексту рекламы.

        Реализация не должна бросать исключения наружу — при ошибке
        возвращается пустой список (движок правил остаётся источником истины).
        """
        raise NotImplementedError
