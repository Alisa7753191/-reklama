"""Детерминированный движок правил.

На вход — нормализованный текст рекламы. На выходе — список находок (Finding)
и список обнаруженных товарных категорий. Движок не обращается к сети и к LLM,
поэтому работает всегда, в т.ч. без API-ключа.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from ..knowledge.loader import KnowledgeBase, get_knowledge
from ..models import Finding, LegalBasis, Liability, Practice, RiskLevel
from . import morphology


def _snippet(text: str, match_start: int, match_len: int, radius: int = 40) -> str:
    start = max(0, match_start - radius)
    end = min(len(text), match_start + match_len + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


class RulesEngine:
    def __init__(self, kb: Optional[KnowledgeBase] = None) -> None:
        self.kb = kb or get_knowledge()

    # --- Построение находки из справочников ---------------------------------
    def _legal_basis(self, keys: List[str]) -> List[LegalBasis]:
        return [LegalBasis(**law) for law in self.kb.laws_for(keys)]

    def _liability(self, keys: List[str]) -> Optional[Liability]:
        data = self.kb.liability_for(keys)
        return Liability(**data) if data else None

    def _practice(self, keys: List[str]) -> List[Practice]:
        return [Practice(**p) for p in self.kb.practice_for(keys)]

    def _build_finding(
        self,
        finding_id: str,
        category: str,
        title: str,
        description: str,
        risk_level: str,
        law_refs: List[str],
        liability_refs: List[str],
        practice_refs: List[str],
        mitigation: List[str],
        evidence: Optional[str],
    ) -> Finding:
        return Finding(
            id=finding_id,
            category=category,
            title=title,
            description=description,
            evidence=evidence,
            risk_level=RiskLevel(risk_level),
            legal_basis=self._legal_basis(law_refs),
            mitigation=mitigation,
            liability=self._liability(liability_refs),
            practice=self._practice(practice_refs),
            source="rule",
            confidence=0.9,
        )

    # --- Определение категорий ---------------------------------------------
    def detect_categories(self, text: str, lemmas: set[str]) -> List[str]:
        low = text.lower()
        detected: List[str] = []
        for cat_key, cat in self.kb.categories.items():
            for kw in cat.get("keywords", []):
                if " " in kw or "-" in kw:
                    if kw.lower() in low:
                        detected.append(cat_key)
                        break
                else:
                    if morphology.lemmatize_term(kw) in lemmas or kw.lower() in low:
                        detected.append(cat_key)
                        break
        return detected

    # --- Общие правила ------------------------------------------------------
    def _run_general_rules(
        self, text: str, lemmas: set[str], is_internet_ad: bool
    ) -> List[Finding]:
        findings: List[Finding] = []
        low = text.lower()

        for rule_id, rule in self.kb.rules.items():
            rtype = rule["type"]
            evidence: Optional[str] = None
            matched = False

            if rtype == "lemma_any":
                # Пропускаем короткие/числовые леммы, чтобы не ловить стоп-цифры
                # (например, «1» из «за 1 час»). Символьные формы — через extra_phrases.
                term_lemmas = {
                    morphology.lemmatize_term(t): t
                    for t in rule.get("terms", [])
                    if len(morphology.lemmatize_term(t)) >= 3
                    and not morphology.lemmatize_term(t).isdigit()
                }
                hit = term_lemmas.keys() & lemmas
                if hit:
                    matched = True
                    evidence = ", ".join(sorted({term_lemmas[h] for h in hit}))
                if not matched:
                    for phrase in rule.get("extra_phrases", []):
                        idx = low.find(phrase.lower())
                        if idx != -1:
                            matched = True
                            evidence = _snippet(text, idx, len(phrase))
                            break

            elif rtype == "phrase_any":
                for phrase in rule.get("terms", []):
                    idx = low.find(phrase.lower())
                    if idx != -1:
                        matched = True
                        evidence = _snippet(text, idx, len(phrase))
                        break

            elif rtype == "regex_any":
                for pat in rule.get("patterns_regex", []):
                    m = re.search(pat, text, re.IGNORECASE)
                    if m:
                        matched = True
                        evidence = _snippet(text, m.start(), len(m.group(0)))
                        break

            elif rtype == "absent_all":
                # Проверки маркировки актуальны только для интернет-рекламы.
                if not is_internet_ad:
                    continue
                found_any = any(
                    re.search(pat, text, re.IGNORECASE)
                    for pat in rule.get("patterns_regex", [])
                )
                if not found_any:
                    matched = True
                    evidence = None

            if matched:
                findings.append(
                    self._build_finding(
                        finding_id=rule_id,
                        category=rule_id,
                        title=rule["title"],
                        description=rule["description"],
                        risk_level=rule["risk_level"],
                        law_refs=rule.get("law_refs", []),
                        liability_refs=rule.get("liability_refs", []),
                        practice_refs=rule.get("practice_refs", []),
                        mitigation=rule.get("mitigation", []),
                        evidence=evidence,
                    )
                )
        return findings

    # --- Правила категорий (обязательные дисклеймеры) -----------------------
    def _run_category_rules(self, text: str, categories: List[str]) -> List[Finding]:
        findings: List[Finding] = []
        low = text.lower()

        for cat_key in categories:
            cat = self.kb.categories[cat_key]
            title = cat.get("title", cat_key)

            # 1) Общая находка «особый режим категории».
            prohibitions = cat.get("prohibitions", [])
            findings.append(
                self._build_finding(
                    finding_id=f"category_{cat_key}",
                    category=cat_key,
                    title=f"Особый правовой режим: {title}",
                    description=(
                        f"Обнаружена реклама категории «{title}». Для неё действуют "
                        f"специальные ограничения. Проверьте соблюдение требований: "
                        + "; ".join(prohibitions)
                        if prohibitions
                        else f"Обнаружена реклама категории «{title}» с особым режимом."
                    ),
                    risk_level=cat.get("risk_level", "medium"),
                    law_refs=cat.get("law_refs", []),
                    liability_refs=cat.get("liability_refs", []),
                    practice_refs=cat.get("practice_refs", []),
                    mitigation=["Сверьтесь с требованиями закона к данной категории"]
                    + [f"Требование: {p}" for p in prohibitions],
                    evidence=None,
                )
            )

            # 2) Проверка обязательных дисклеймеров.
            for disc in cat.get("required_disclaimers", []):
                patterns = disc.get("patterns", [])
                present = any(p.lower() in low for p in patterns)
                if not present:
                    findings.append(
                        self._build_finding(
                            finding_id=f"disclaimer_{cat_key}_{disc['id']}",
                            category=cat_key,
                            title=f"Отсутствует обязательное предупреждение: {title}",
                            description=(
                                f"Не обнаружено обязательное предупреждение: "
                                f"{disc.get('text', '')}."
                            ),
                            risk_level=cat.get("risk_level", "medium"),
                            law_refs=cat.get("law_refs", []),
                            liability_refs=cat.get("liability_refs", []),
                            practice_refs=cat.get("practice_refs", []),
                            mitigation=[f"Добавьте: {disc.get('text', '')}"],
                            evidence=None,
                        )
                    )
        return findings

    # --- Точка входа --------------------------------------------------------
    def analyze(
        self, text: str, is_internet_ad: bool = True
    ) -> Tuple[List[Finding], List[str]]:
        lemmas = morphology.lemmatize_text(text)
        categories = self.detect_categories(text, lemmas)
        findings = self._run_general_rules(text, lemmas, is_internet_ad)
        findings += self._run_category_rules(text, categories)
        return findings, categories
