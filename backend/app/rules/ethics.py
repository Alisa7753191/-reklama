"""Строгий лексический фильтр для ч. 6 ст. 5 ФЗ «О рекламе».

Список намеренно применяется только к рекламному материалу и не пытается
установить лингвистический контекст. Совпадение блокирует автоматическое
согласование до ручной проверки или удаления выражения.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class EthicsMatch:
    text: str
    start: int
    end: int
    kind: str


# Подмена похожими латинскими буквами и цифрами — частый способ обхода фильтров.
_LOOKALIKE_MAP = str.maketrans(
    {
        "a": "а", "c": "с", "e": "е", "k": "к", "m": "м",
        "o": "о", "p": "р", "t": "т", "x": "х", "y": "у",
        "0": "о", "3": "з", "4": "ч", "6": "б", "@": "а",
    }
)

# Явная нецензурная брань. Для корня на «еб/ёб» перечислены разговорные
# приставки, чтобы слово «ребёнок» и подобные нейтральные слова не совпадали.
_PROFANITY = re.compile(
    r"(?:"
    r"ху(?:й|я|е|ё|и|ю)|пизд|бля(?:$|д|т|ха)|"
    r"(?:^|за|на|по|про|вы|до|у|съ|под|пере|от)[её]б|"
    r"манд(?:а(?:$|вош)|ы$|е$|у$|ой$|ища)|залуп|долбо(?:е|ё)б|"
    r"г[ао]ндон|муд(?:ак|ил|озвон)|дроч|пид(?:ор|ар)"
    r")",
    re.IGNORECASE,
)

# Непристойная телесная и уничижительная лексика, которая в рекламном
# сообщении требует удаления либо отдельной юридической оценки контекста.
_INDECENT = re.compile(
    r"(?:"
    r"жоп|сиськ|сисеч|сисек|титьк|срак|говн|задниц|"
    r"шлюх|ублюд|мраз|чм(?:о|ош)|дебил|идиот|кретин|"
    r"урод|твар|суч(?:к|ар)|(?:^|[^а-яё])сук(?:а|и|у|ой)$|"
    r"(?:^|[^а-яё])лох(?:$|а|и|у|ом)"
    r")",
    re.IGNORECASE,
)

# Оскорбительные обозначения людей по национальности, возрасту, полу или
# социальной группе. В коде хранятся только корни: пользователю показывается
# исходный фрагмент, а не словарь запрещённых выражений.
_DISCRIMINATORY = re.compile(
    r"(?:чурк|хач(?:ик)?|жид(?:яра)?|ниг(?:ер|гер)|"
    r"узкоглаз|черножоп|старп[её]р|бабищ|жирух|инвалидик)" ,
    re.IGNORECASE,
)

_PATTERNS = (
    ("нецензурная брань", _PROFANITY),
    ("непристойное или уничижительное выражение", _INDECENT),
    ("оскорбительное выражение", _DISCRIMINATORY),
)


def _normalize(text: str) -> tuple[str, list[int]]:
    """Нормализация с картой индексов обратно к исходной строке.

    Знаки внутри слова удаляются (``ж*о*п*а``), а пробелы сохраняются. Поэтому
    соседние обычные слова не склеиваются и не создают ложные совпадения.
    """
    normalized: list[str] = []
    positions: list[int] = []
    for source_index, source_char in enumerate(text.lower()):
        decomposed = unicodedata.normalize("NFKD", source_char)
        for char in decomposed:
            if unicodedata.combining(char):
                continue
            char = char.translate(_LOOKALIKE_MAP)
            if char.isalnum() or char in "а-яё":
                normalized.append(char)
                positions.append(source_index)
            elif char.isspace():
                if not normalized or normalized[-1] != " ":
                    normalized.append(" ")
                    positions.append(source_index)
            # Пунктуация и маскирующие символы внутри слова отбрасываются.
    return "".join(normalized), positions


def _match_candidate(
    candidate: str,
    candidate_positions: list[int],
    source: str,
) -> EthicsMatch | None:
    for kind, pattern in _PATTERNS:
        match = pattern.search(candidate)
        if not match:
            continue
        start = candidate_positions[match.start()]
        end = candidate_positions[match.end() - 1] + 1
        return EthicsMatch(text=source[start:end], start=start, end=end, kind=kind)
    return None


def find_ethics_violation(text: str) -> EthicsMatch | None:
    """Первое совпадение с учётом маскировки символами и разрядкой букв."""
    normalized, positions = _normalize(text)
    tokens = list(re.finditer(r"[а-яёa-z0-9]+", normalized, re.IGNORECASE))

    for token in tokens:
        result = _match_candidate(
            token.group(0),
            positions[token.start():token.end()],
            text,
        )
        if result:
            return result

    # Дополнительно ловим разрядку по одной букве: «ж о п а».
    run: list[re.Match[str]] = []
    for token in [*tokens, None]:
        if token is not None and len(token.group(0)) == 1:
            run.append(token)
            continue
        if len(run) >= 3:
            candidate = "".join(item.group(0) for item in run)
            candidate_positions = [positions[item.start()] for item in run]
            result = _match_candidate(candidate, candidate_positions, text)
            if result:
                return result
        run = []
    return None


def redact_ethics_violations(text: str, limit: int = 50) -> tuple[str, int]:
    """Заменить найденные выражения нейтральным маркером для черновика правок."""
    result = text
    count = 0
    while count < limit:
        match = find_ethics_violation(result)
        if not match:
            break
        result = f"{result[:match.start]}[НЕЙТРАЛЬНАЯ ФОРМУЛИРОВКА]{result[match.end:]}"
        count += 1
    return result, count
