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


def _find_phrase(low: str, phrase: str) -> int:
    """Индекс вхождения фразы. Для числовых фраз («0 ₽», «0 рублей») требуем, чтобы
    перед совпадением не стояла цифра, иначе «0 ₽» ложно матчится в «100 000 ₽»."""
    p = phrase.lower()
    numeric = p[:1].isdigit()
    start = 0
    while True:
        idx = low.find(p, start)
        if idx == -1:
            return -1
        if numeric and idx > 0 and low[idx - 1].isdigit():
            start = idx + 1
            continue
        return idx


def _conditional_trigger(rule: dict, low: str) -> Optional[str]:
    """Сработавший триггер условного правила (для evidence) или None.
    Срабатывает, если найдена любая фраза из trigger_patterns ЛИБО в КАЖДОЙ группе
    trigger_groups есть хотя бы одно совпадение. Группы ловят со-встречаемость
    («купи» … «онлайн») с любыми словами между — жёсткие фразы этого не умеют.

    exclude_patterns подавляют триггер (напр. явный офлайн «в магазине»), но только
    если нет ни одного exclude_unless_patterns (явный признак дистанционности —
    «на сайте», «доставка»), чтобы смешанные «купи на сайте или в магазине» флагались."""
    excl = rule.get("exclude_patterns", [])
    if excl and any(e.lower() in low for e in excl):
        unless = rule.get("exclude_unless_patterns", [])
        if not any(u.lower() in low for u in unless):
            return None
    for t in rule.get("trigger_patterns", []):
        if t.lower() in low:
            return t
    groups = rule.get("trigger_groups", [])
    if groups:
        last: Optional[str] = None
        for g in groups:
            hit = next((p for p in g if p.lower() in low), None)
            if hit is None:
                return None
            last = hit
        return last
    return None


def _group_hit(patterns: list, low: str, text: str) -> bool:
    """Совпадение внутри группы (ИЛИ). Элемент с префиксом 're:' — регулярное выражение."""
    for p in patterns:
        if isinstance(p, str) and p.startswith("re:"):
            if re.search(p[3:], text, re.IGNORECASE):
                return True
        elif p.lower() in low:
            return True
    return False


def _required_satisfied(rule: dict, low: str, text: str) -> bool:
    """Требования выполнены? Если задан required_groups — нужно совпадение в КАЖДОЙ
    группе (И между группами). Иначе — достаточно любого из required_patterns."""
    groups = rule.get("required_groups")
    if groups:
        return all(_group_hit(g, low, text) for g in groups)
    return any(r.lower() in low for r in rule.get("required_patterns", []))


def _label(item: dict, fallback_text: str) -> str:
    """Короткая метка требования для заголовка находки (уникальна в рамках
    категории, чтобы разные требования не схлопывались дедупликацией)."""
    lbl = item.get("label")
    if lbl:
        return lbl
    t = (fallback_text or "").strip()
    return t if len(t) <= 70 else t[:69].rstrip() + "…"


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
            found = False
            for kw in cat.get("keywords", []):
                if " " in kw or "-" in kw:
                    # Многословные/составные ключи — по подстроке.
                    if kw.lower() in low:
                        found = True
                        break
                else:
                    # Однословные ключи — только по лемме (целым словом), без подстроки,
                    # чтобы «ром» не срабатывал в «Ромашка», «промо»; «бар» — в «товар».
                    if morphology.lemmatize_term(kw) in lemmas:
                        found = True
                        break
            # Опциональные подстроки (opt-in для категории): ловят слово внутри слитных
            # маркетинговых форм — напр. «вклад» в «Супервклад», «депозит» в «Мегадепозит».
            # Матчим по словам и исключаем ложные формы (напр. «вкладка», «вкладыш»),
            # чтобы подстрока не срабатывала где не надо.
            if not found:
                subs = [s.lower() for s in cat.get("keyword_substrings", [])]
                if subs:
                    excl = tuple(x.lower() for x in cat.get("keyword_substrings_exclude", []))
                    for token in re.findall(r"[а-яёa-z]+", low):
                        if excl and token.startswith(excl):
                            continue
                        if any(s in token for s in subs):
                            found = True
                            break
            if found:
                detected.append(cat_key)
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
                    idx = _find_phrase(low, phrase)
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

            elif rtype == "conditional":
                # Сработать, если есть триггер, но нет ни одного обязательного элемента
                # (например: онлайн-заказ без реквизитов продавца — ст. 8).
                trig = _conditional_trigger(rule, low)
                if trig and not _required_satisfied(rule, low, text):
                    matched = True
                    idx = low.find(trig.lower())
                    evidence = _snippet(text, idx, len(trig)) if idx >= 0 else None

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

            # 1) Общая карточка «особый режим категории» выдаётся ТОЛЬКО если есть
            #    неповторяющийся контекст (непустой prohibitions). Если все требования
            #    категории уже покрыты отдельными проверками (как у кредита), общая
            #    карточка не показывается, чтобы не дублировать риски.
            prohibitions = cat.get("prohibitions", [])
            if prohibitions:
                findings.append(
                    self._build_finding(
                        finding_id=f"category_{cat_key}",
                        category=cat_key,
                        title=f"Особый правовой режим: {title}",
                        description=(
                            f"Реклама категории «{title}». Обратите внимание на "
                            f"специальные требования законодательства о рекламе:"
                        ),
                        risk_level=cat.get("risk_level", "medium"),
                        law_refs=cat.get("law_refs", []),
                        liability_refs=cat.get("liability_refs", []),
                        practice_refs=cat.get("practice_refs", []),
                        mitigation=list(prohibitions),
                        evidence=None,
                    )
                )

            # 2) Проверка обязательных дисклеймеров (всегда обязательны для категории).
            for disc in cat.get("required_disclaimers", []):
                patterns = disc.get("patterns", [])
                present = any(p.lower() in low for p in patterns)
                if not present:
                    findings.append(
                        self._build_finding(
                            finding_id=f"disclaimer_{cat_key}_{disc['id']}",
                            category=cat_key,
                            title=f"Не указано обязательное: {_label(disc, disc.get('text', ''))}",
                            description=(
                                f"Категория «{title}». Не обнаружено обязательное: "
                                f"{disc.get('text', '')}."
                            ),
                            risk_level=disc.get("risk_level", cat.get("risk_level", "medium")),
                            # У требования может быть своя точная норма (напр. ст. 28 ч. 3.1);
                            # иначе — общие статьи категории.
                            law_refs=disc.get("law_refs", cat.get("law_refs", [])),
                            liability_refs=cat.get("liability_refs", []),
                            practice_refs=cat.get("practice_refs", []),
                            mitigation=[f"Добавьте: {disc.get('text', '')}"],
                            evidence=None,
                        )
                    )

            # 3) Условные дисклеймеры: обязательны, если сработал триггер.
            #    По умолчанию (always_when_triggered) — риск выводится ВСЕГДА при наличии
            #    триггера (напр. для вклада указано любое финусловие → правило ст. 28
            #    ч. 2 п. 2 применимо; полноту раскрытия оценивает юрист). Иначе — только
            #    если ни один обязательный элемент не раскрыт.
            for disc in cat.get("conditional_disclaimers", []):
                triggers = disc.get("trigger_patterns", [])
                required = disc.get("required_patterns", [])
                always = disc.get("always_when_triggered", False)
                triggered = next(
                    (t for t in triggers if t.lower() in low), None
                )
                satisfied = any(r.lower() in low for r in required)
                if triggered and (always or not satisfied):
                    idx = low.find(triggered.lower())
                    note = ""
                    if always and satisfied:
                        note = (
                            " Часть условий, возможно, уже раскрыта — полноту и "
                            "читаемость проверяет юрист (риск может быть снят/понижен)."
                        )
                    findings.append(
                        self._build_finding(
                            finding_id=f"cond_{cat_key}_{disc['id']}",
                            category=cat_key,
                            title=f"Не раскрыто обязательное: {_label(disc, disc.get('text', ''))}",
                            description=(
                                f"Категория «{title}». В рекламе указано условие «{triggered}» "
                                f"— необходимо раскрыть иные условия, влияющие на доход/расход: "
                                f"{disc.get('text', '')}.{note}"
                            ),
                            risk_level=disc.get("risk_level", cat.get("risk_level", "medium")),
                            law_refs=disc.get("law_refs", cat.get("law_refs", [])),
                            liability_refs=cat.get("liability_refs", []),
                            practice_refs=cat.get("practice_refs", []),
                            mitigation=[f"Добавьте: {disc.get('text', '')}"],
                            evidence=_snippet(text, idx, len(triggered)) if idx >= 0 else None,
                        )
                    )

            # 4) Запрещённые формулировки (например, обещание гарантированного дохода
            #    для инвестиций или «спишем все долги» для банкротства).
            for fp in cat.get("forbidden_patterns", []):
                patterns = fp.get("patterns", [])
                hit = next((p for p in patterns if p.lower() in low), None)
                if hit:
                    idx = low.find(hit.lower())
                    findings.append(
                        self._build_finding(
                            finding_id=f"forbidden_{cat_key}_{fp['id']}",
                            category=cat_key,
                            title=f"Запрещённая формулировка: {_label(fp, fp.get('text', ''))}",
                            description=f"Категория «{title}». " + fp.get("text", "Обнаружена запрещённая формулировка."),
                            risk_level=fp.get("risk_level", cat.get("risk_level", "high")),
                            law_refs=fp.get("law_refs", cat.get("law_refs", [])),
                            liability_refs=cat.get("liability_refs", []),
                            practice_refs=cat.get("practice_refs", []),
                            mitigation=["Удалите или переформулируйте: " + fp.get("text", "")],
                            evidence=_snippet(text, idx, len(hit)) if idx >= 0 else None,
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
