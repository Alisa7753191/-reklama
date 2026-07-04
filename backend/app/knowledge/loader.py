"""Загрузка правовой базы знаний из YAML-файлов.

База знаний кэшируется в памяти при первом обращении. Файлы рассчитаны на
редактирование юристом без изменения кода.
"""
from __future__ import annotations

import functools
from pathlib import Path
from typing import Any, Dict

import yaml

_KNOWLEDGE_DIR = Path(__file__).resolve().parent


def _load_yaml(name: str) -> Dict[str, Any]:
    path = _KNOWLEDGE_DIR / name
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


@functools.lru_cache(maxsize=1)
def get_knowledge() -> "KnowledgeBase":
    return KnowledgeBase(
        laws=_load_yaml("laws.yaml"),
        liability=_load_yaml("liability.yaml"),
        practice=_load_yaml("practice.yaml"),
        categories=_load_yaml("categories.yaml"),
        rules=_load_yaml("rules.yaml"),
    )


class KnowledgeBase:
    """Обёртка над словарями базы знаний с удобными резолверами по ключам."""

    def __init__(
        self,
        laws: Dict[str, Any],
        liability: Dict[str, Any],
        practice: Dict[str, Any],
        categories: Dict[str, Any],
        rules: Dict[str, Any],
    ) -> None:
        self.laws = laws
        self.liability = liability
        self.practice = practice
        self.categories = categories
        self.rules = rules

    def law(self, key: str) -> Dict[str, Any] | None:
        return self.laws.get(key)

    def laws_for(self, keys: list[str]) -> list[Dict[str, Any]]:
        return [self.laws[k] for k in keys if k in self.laws]

    def liability_for(self, keys: list[str]) -> Dict[str, Any] | None:
        # Возвращаем первую найденную запись об ответственности.
        for k in keys:
            if k in self.liability:
                return self.liability[k]
        return None

    def practice_for(self, keys: list[str]) -> list[Dict[str, Any]]:
        items: list[Dict[str, Any]] = []
        for k in keys:
            items.extend(self.practice.get(k, []) or [])
        return items
