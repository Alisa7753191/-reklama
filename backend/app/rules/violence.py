"""Контекстный фильтр фраз о насилии над людьми для ст. 5 ч. 4 ФЗ-38."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ViolenceMatch:
    text: str
    start: int
    end: int


_PERSON = (
    r"(?:люд(?:ей|ям|ьми|и)?|человек(?:а|у|ом|е|и)?|"
    r"реб[её]н(?:ка|ку|ком|ок|ки|ками)?|дет(?:ей|ям|ьми|и)?|"
    r"мужчин(?:у|ы|е|ам)?|женщин(?:у|ы|е|ам)?|"
    r"прохож(?:его|их|ему|ие)|толп(?:у|ы|е)|"
    r"заложник(?:а|ов|у|и)?|сосед(?:а|ей|у|и)?|"
    r"конкурент(?:а|ов|у|ы)?)"
)

_VIOLENT_ACTION = (
    r"(?:убей|убивай|убить|застрели|застрелить|пристрели|пристрелить|"
    r"расстреляй|расстрелять|зарежь|зарезать|замочи|мочи|"
    r"сожги|подожги|взорви|взорвать)"
)

_PATTERNS = (
    # Звукоподражание становится рискованным именно при направлении на людей.
    re.compile(
        rf"\bпиф\s*[-–—]?\s*паф(?:\s+(?:по|в|для|против|на))?\s+{_PERSON}\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b{_VIOLENT_ACTION}\s+(?:(?:этого|этих|всех|любого|каждого)\s+)?{_PERSON}\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b(?:стреляй|стрелять|пали|палить)\s+(?:в|по)\s+{_PERSON}\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b{_VIOLENT_ACTION}\s+(?:их|его|е[её]|всех)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(?:стреляй|стрелять|пали|палить)\s+(?:в|по)\s+них\b", re.IGNORECASE),
)


def find_violence_violations(text: str, limit: int = 20) -> list[ViolenceMatch]:
    """Вернуть непересекающиеся рискованные фразы в порядке появления."""
    candidates = [
        ViolenceMatch(match.group(0), match.start(), match.end())
        for pattern in _PATTERNS
        for match in pattern.finditer(text)
    ]
    candidates.sort(key=lambda item: (item.start, -(item.end - item.start)))
    result: list[ViolenceMatch] = []
    for candidate in candidates:
        if any(candidate.start < item.end and candidate.end > item.start for item in result):
            continue
        result.append(candidate)
        if len(result) >= limit:
            break
    return result


def redact_violence_violations(text: str, limit: int = 20) -> tuple[str, int]:
    """Удалить рискованные фразы целиком из безопасного черновика."""
    matches = find_violence_violations(text, limit=limit)
    result = text
    for match in reversed(matches):
        result = f"{result[:match.start]}[НЕЙТРАЛЬНАЯ ФОРМУЛИРОВКА]{result[match.end:]}"
    return result, len(matches)
