"""Создание более безопасного черновика рекламы по уже найденным рискам."""
from __future__ import annotations

import re
from typing import Iterable

from .config import settings
from .models import Finding, RewriteResponse
from .rules.ethics import redact_ethics_violations
from .rules.violence import redact_violence_violations

_REPLACEMENTS = (
    (r"\bсам(?:ый|ая|ое|ые)\s+выгодн\w*\b", "с понятными условиями"),
    (r"\bлучший\b", "подходящий"),
    (r"\bлучшая\b", "подходящая"),
    (r"\bлучшее\b", "подходящее"),
    (r"\bединственн\w*\b", "доступный"),
    (r"\bномер\s*1\b|№\s*1", "один из вариантов"),
    (r"\bгарантированн(?:ый|ая|ое|ые)\s+(?:доход|результат|эффект)\w*\b", "результат при соблюдении применимых условий"),
    (r"\bбез\s+риска\b", "с условиями и ограничениями"),
    (r"\b100\s*%\s*(?:гарантия|результат)\w*\b", "результат зависит от применимых условий"),
)


def _fallback_rewrite(text: str, findings: Iterable[Finding]) -> RewriteResponse:
    rewritten, ethics_replacements = redact_ethics_violations(text.strip())
    rewritten, violence_replacements = redact_violence_violations(rewritten)
    for pattern, replacement in _REPLACEMENTS:
        rewritten = re.sub(pattern, replacement, rewritten, flags=re.IGNORECASE)

    actions: list[str] = []
    for finding in findings:
        for mitigation in finding.mitigation:
            value = mitigation.strip().rstrip(".")
            if value and value not in actions:
                actions.append(value)
    if actions:
        additions = "\n".join(f"— [ПЕРЕД ПУБЛИКАЦИЕЙ: {item}]" for item in actions[:12])
        rewritten = f"{rewritten}\n\n{additions}"

    warnings = [
        "Создан консервативный черновик по сработавшим правилам. Поля в квадратных "
        "скобках необходимо заполнить фактическими данными и повторно проверить."
    ]
    if ethics_replacements:
        warnings.append(
            f"Бранные, непристойные или оскорбительные выражения заменены: "
            f"{ethics_replacements}. Вставьте нейтральные формулировки."
        )
    if violence_replacements:
        warnings.append(
            f"Фразы о насилии над людьми заменены: {violence_replacements}. "
            f"Вставьте нейтральные формулировки."
        )
    return RewriteResponse(
        text=rewritten,
        mode="rules",
        warnings=warnings,
    )


def _claude_rewrite(text: str, findings: list[Finding], context: str) -> str | None:
    try:
        import anthropic

        findings_block = "\n".join(
            f"- {finding.title}: {'; '.join(finding.mitigation) or finding.description}"
            for finding in findings
        )
        prompt = f"""Перепиши рекламный текст как осторожный юридический черновик.

Требования:
- устрани только перечисленные риски, не меняя рекламируемый продукт;
- не придумывай ERID, лицензию, цену, сроки, исследования, реквизиты или иные факты;
- недостающие факты обозначай короткими маркерами [УКАЗАТЬ ...];
- сохрани понятный рекламный стиль;
- верни только готовый текст без пояснений и markdown.

Контекст:
{context or 'не указан'}

Риски и исправления:
{findings_block or 'формальные риски не переданы'}

Исходный текст:
{text}
"""
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=min(settings.llm_max_tokens, 4096),
            messages=[{"role": "user", "content": prompt}],
        )
        result = "".join(
            block.text for block in response.content if getattr(block, "type", "") == "text"
        ).strip()
        return result or None
    except Exception:  # noqa: BLE001
        return None


def create_safe_rewrite(
    text: str,
    findings: list[Finding],
    company_description: str = "",
    product_description: str = "",
) -> RewriteResponse:
    context = "\n".join(
        part for part in (
            f"Компания: {company_description.strip()}" if company_description.strip() else "",
            f"Продукт: {product_description.strip()}" if product_description.strip() else "",
        ) if part
    )
    if settings.llm_enabled:
        rewritten = _claude_rewrite(text, findings, context)
        if rewritten:
            rewritten, ethics_replacements = redact_ethics_violations(rewritten)
            rewritten, violence_replacements = redact_violence_violations(rewritten)
            warnings = [
                "Редакция создана ИИ по найденным рискам. Проверьте фактические "
                "сведения и запустите повторный юридический анализ."
            ]
            if ethics_replacements:
                warnings.append(
                    "Оставшиеся бранные, непристойные или оскорбительные выражения "
                    "заменены строгим фильтром."
                )
            if violence_replacements:
                warnings.append(
                    "Оставшиеся фразы о насилии над людьми заменены строгим фильтром."
                )
            return RewriteResponse(
                text=rewritten,
                mode="claude",
                warnings=warnings,
            )
    return _fallback_rewrite(text, findings)
