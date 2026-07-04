"""Морфологический помощник для русского языка.

Использует pymorphy3 для лемматизации (чтобы ловить слова в любой форме:
«лучший», «лучшая», «лучшие» → «лучший»). Если библиотека недоступна,
корректно деградирует до нормализации по нижнему регистру и простому усечению.
"""
from __future__ import annotations

import functools
import re
from typing import List, Set

_WORD_RE = re.compile(r"[а-яёa-z0-9]+", re.IGNORECASE)

try:  # pragma: no cover - зависит от окружения
    import pymorphy3

    _MORPH = pymorphy3.MorphAnalyzer()
    _HAS_MORPH = True
except Exception:  # noqa: BLE001
    _MORPH = None
    _HAS_MORPH = False


def tokenize(text: str) -> List[str]:
    return _WORD_RE.findall(text.lower())


@functools.lru_cache(maxsize=50000)
def lemma(word: str) -> str:
    if _HAS_MORPH and _MORPH is not None:
        try:
            return _MORPH.parse(word)[0].normal_form
        except Exception:  # noqa: BLE001
            return word
    return word


def lemmatize_text(text: str) -> Set[str]:
    """Множество лемм всех слов текста."""
    return {lemma(tok) for tok in tokenize(text)}


def lemmatize_term(term: str) -> str:
    """Лемма первого слова термина (для однословных ключей)."""
    toks = tokenize(term)
    return lemma(toks[0]) if toks else term.lower()


def has_morph() -> bool:
    return _HAS_MORPH
