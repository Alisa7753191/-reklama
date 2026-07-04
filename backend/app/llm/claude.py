"""LLM-провайдер на базе Anthropic Claude (смысловой анализ рекламы)."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from ..config import settings
from ..models import Finding, LegalBasis, Liability, RiskLevel
from .base import LLMProvider
from .prompt import SYSTEM_PROMPT, build_user_prompt

_VALID_LEVELS = {e.value for e in RiskLevel}


def _extract_json_array(raw: str) -> List[Dict[str, Any]]:
    raw = raw.strip()
    # Снимаем возможную markdown-обёртку ```json ... ```
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", raw, re.DOTALL)
    if fence:
        raw = fence.group(1).strip()
    # Берём фрагмент от первой '[' до последней ']' — на случай лишнего текста.
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1 and end > start:
        raw = raw[start : end + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


class ClaudeProvider(LLMProvider):
    name = "claude"
    available = True

    def __init__(self) -> None:
        import anthropic  # импорт здесь, чтобы отсутствие пакета не ломало сервис

        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model

    def analyze(self, text: str, categories: List[str]) -> List[Finding]:
        try:
            resp = self._client.messages.create(
                model=self._model,
                max_tokens=settings.llm_max_tokens,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": build_user_prompt(text, categories)}],
            )
            raw = "".join(
                block.text for block in resp.content if getattr(block, "type", "") == "text"
            )
        except Exception:  # noqa: BLE001 - сетевые/API ошибки не должны ронять анализ
            return []

        items = _extract_json_array(raw)
        return [f for f in (self._to_finding(i, idx) for idx, i in enumerate(items)) if f]

    @staticmethod
    def _to_finding(item: Dict[str, Any], idx: int) -> Finding | None:
        if not isinstance(item, dict) or not item.get("title"):
            return None

        level = str(item.get("risk_level", "medium")).lower()
        if level not in _VALID_LEVELS:
            level = "medium"

        legal_basis: List[LegalBasis] = []
        for lb in item.get("legal_basis", []) or []:
            if isinstance(lb, dict) and (lb.get("article") or lb.get("law")):
                legal_basis.append(
                    LegalBasis(
                        law=str(lb.get("law", "ФЗ «О рекламе» № 38-ФЗ")),
                        article=str(lb.get("article", "")),
                        title=str(lb.get("title", item.get("title", ""))),
                        summary=str(lb.get("summary", "")),
                        url=lb.get("url"),
                    )
                )

        liability = None
        lia = item.get("liability")
        if isinstance(lia, dict) and lia.get("koap_article"):
            liability = Liability(
                koap_article=str(lia.get("koap_article")),
                fine_citizens=lia.get("fine_citizens"),
                fine_officials=lia.get("fine_officials"),
                fine_legal=lia.get("fine_legal"),
                note=lia.get("note"),
            )

        mitigation = [str(m) for m in (item.get("mitigation") or []) if m]

        confidence = item.get("confidence")
        try:
            confidence = float(confidence) if confidence is not None else None
        except (TypeError, ValueError):
            confidence = None

        return Finding(
            id=f"llm_{idx}",
            category="llm_semantic",
            title=str(item.get("title")),
            description=str(item.get("description", "")),
            evidence=item.get("evidence") or None,
            risk_level=RiskLevel(level),
            legal_basis=legal_basis,
            mitigation=mitigation,
            liability=liability,
            practice=[],
            source="llm",
            confidence=confidence,
        )
