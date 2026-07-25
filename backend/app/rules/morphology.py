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


# --- Определение сравнительной степени (для правила «некорректное сравнение») ---

# Слишком общие/неоднозначные сравнительные — НЕ считаем сравнением с конкурентом
# (частые дискурсивные слова: «более того», «см. выше», «больше возможностей»).
_COMPARATIVE_STOP = {
    "больше", "меньше", "более", "менее", "раньше", "позже", "дольше",
    "ближе", "дальше", "выше", "ниже", "старше", "младше",
}
# Запасной список нерегулярных сравнительных (когда морфология недоступна и в
# автономной JS-версии — там та же логика).
_COMPARATIVE_IRREGULAR = {
    "лучше", "хуже", "дешевле", "дороже", "ярче", "легче", "проще", "крепче",
    "громче", "тише", "чаще", "реже", "шире", "короче", "толще", "тоньше",
    "мягче", "слаще", "чище", "гуще", "глубже", "жёстче", "жестче",
}
# Существительные на «-ее», которые эвристика по окончанию ошибочно приняла бы
# за сравнительную степень.
_EE_NOUN_EXCEPTIONS = {
    "музее", "лицее", "юбилее", "мавзолее", "галерее", "аллее", "лотерее",
    "батарее", "эпопее", "оранжерее", "ассамблее", "орхидее", "панацее",
    "идее", "траншее", "феерее",
}


def is_comparative(word: str) -> bool:
    """Является ли слово сравнительной степенью (активнее, сильнее, лучше…)."""
    w = word.lower()
    if w in _COMPARATIVE_STOP:
        return False
    if _HAS_MORPH and _MORPH is not None:
        try:
            return any("COMP" in p.tag for p in _MORPH.parse(w))
        except Exception:  # noqa: BLE001
            pass
    # Запасной вариант без морфологии.
    if w in _COMPARATIVE_IRREGULAR:
        return True
    return len(w) >= 6 and w.endswith("ее") and w not in _EE_NOUN_EXCEPTIONS


def find_comparative(text: str) -> str | None:
    """Первое слово-сравнение в тексте (или None)."""
    for tok in tokenize(text):
        if len(tok) >= 4 and is_comparative(tok):
            return tok
    return None
