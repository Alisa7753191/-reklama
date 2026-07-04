"""Оркестратор анализа: правила + LLM → итоговый отчёт о рисках."""
from __future__ import annotations

from typing import List

from ..config import DISCLAIMER, settings
from ..knowledge.loader import get_knowledge
from ..llm import get_provider
from ..models import (
    Finding,
    InputType,
    Report,
    ReportMeta,
    RISK_ORDER,
    RiskLevel,
)
from ..rules.engine import RulesEngine

_LEVEL_RU = {
    RiskLevel.low: "низкий",
    RiskLevel.medium: "средний",
    RiskLevel.high: "высокий",
    RiskLevel.critical: "критический",
}


def _dedupe(findings: List[Finding]) -> List[Finding]:
    """Убираем дубликаты правил и LLM по (заголовок + доказательство)."""
    seen: set[tuple[str, str]] = set()
    result: List[Finding] = []
    for f in findings:
        key = (f.title.strip().lower(), (f.evidence or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        result.append(f)
    return result


def _overall_risk(findings: List[Finding]) -> RiskLevel:
    if not findings:
        return RiskLevel.low
    return max(findings, key=lambda f: RISK_ORDER[f.risk_level]).risk_level


def _sort_key(f: Finding):
    # Сначала по уровню риска (убыв.), затем правила выше LLM (детерминированные надёжнее).
    return (-RISK_ORDER[f.risk_level], 0 if f.source == "rule" else 1)


def _summary(overall: RiskLevel, findings: List[Finding], categories: List[str]) -> str:
    kb = get_knowledge()
    n = len(findings)
    if n == 0:
        return "Явных правовых рисков не обнаружено. Тем не менее, рекомендуется финальная проверка юристом."
    counts = {lvl: 0 for lvl in RiskLevel}
    for f in findings:
        counts[f.risk_level] += 1
    cat_titles = [kb.categories.get(c, {}).get("title", c) for c in categories]
    parts = [
        f"Итоговый уровень риска: {_LEVEL_RU[overall].upper()}.",
        f"Выявлено рисков: {n}"
        + f" (критических: {counts[RiskLevel.critical]}, высоких: {counts[RiskLevel.high]},"
        + f" средних: {counts[RiskLevel.medium]}, низких: {counts[RiskLevel.low]}).",
    ]
    if cat_titles:
        parts.append("Категории с особым режимом: " + ", ".join(cat_titles) + ".")
    return " ".join(parts)


class Analyzer:
    def __init__(self) -> None:
        self.engine = RulesEngine()

    def analyze(
        self,
        text: str,
        input_type: InputType,
        extra_warnings: List[str] | None = None,
        is_internet_ad: bool = True,
    ) -> Report:
        warnings = list(extra_warnings or [])
        text = text or ""

        if not text.strip():
            warnings.append("Пустой текст для анализа — проверять нечего.")
            return Report(
                overall_risk=RiskLevel.low,
                summary="Нет контента для анализа.",
                detected_categories=[],
                findings=[],
                extracted_text=text,
                disclaimer=DISCLAIMER,
                meta=ReportMeta(
                    input_type=input_type,
                    llm_used=False,
                    llm_provider=None,
                    warnings=warnings,
                ),
            )

        # 1) Детерминированные правила.
        rule_findings, categories = self.engine.analyze(text, is_internet_ad=is_internet_ad)

        # 2) Смысловой LLM-анализ.
        provider = get_provider()
        llm_findings: List[Finding] = []
        if provider.available:
            llm_findings = provider.analyze(text, categories)
        else:
            warnings.append(
                "LLM-анализ отключён (нет ANTHROPIC_API_KEY): работает только движок правил. "
                "Смысловые риски могут быть не выявлены."
            )

        # 3) Слияние, дедуп, сортировка.
        all_findings = _dedupe(rule_findings + llm_findings)
        all_findings.sort(key=_sort_key)

        overall = _overall_risk(all_findings)

        return Report(
            overall_risk=overall,
            summary=_summary(overall, all_findings, categories),
            detected_categories=categories,
            findings=all_findings,
            extracted_text=text,
            disclaimer=DISCLAIMER,
            meta=ReportMeta(
                input_type=input_type,
                llm_used=provider.available,
                llm_provider=provider.name if provider.available else None,
                rules_findings=len(rule_findings),
                llm_findings=len(llm_findings),
                warnings=warnings,
            ),
        )
