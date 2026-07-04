"""Тесты оркестратора: агрегация уровня риска, дедуп, деградация без LLM."""
from app.analysis.orchestrator import Analyzer
from app.models import InputType, RiskLevel

analyzer = Analyzer()


def test_empty_text_returns_low_and_warning():
    report = analyzer.analyze(text="   ", input_type=InputType.text)
    assert report.overall_risk == RiskLevel.low
    assert report.findings == []
    assert any("Пустой текст" in w for w in report.meta.warnings)


def test_overall_risk_is_max_of_findings():
    # Алкоголь → критический уровень должен всплыть наверх.
    report = analyzer.analyze(
        text="Премиальная водка со скидкой, купить сейчас",
        input_type=InputType.text,
    )
    assert report.overall_risk == RiskLevel.critical
    assert "alcohol" in report.detected_categories


def test_findings_sorted_by_severity_desc():
    report = analyzer.analyze(
        text="Лучший банк! Кредит от 5%. Оставьте заявку.",
        input_type=InputType.text,
    )
    levels = [f.risk_level for f in report.findings]
    order = {RiskLevel.critical: 4, RiskLevel.high: 3, RiskLevel.medium: 2, RiskLevel.low: 1}
    weights = [order[l] for l in levels]
    assert weights == sorted(weights, reverse=True)


def test_llm_disabled_without_key_produces_warning():
    report = analyzer.analyze(text="Лучший сервис", input_type=InputType.text)
    assert report.meta.llm_used is False
    assert any("LLM-анализ отключён" in w for w in report.meta.warnings)


def test_report_has_disclaimer():
    report = analyzer.analyze(text="Лучший сервис", input_type=InputType.text)
    assert "не являются юридической консультацией" in report.disclaimer.lower()


def test_dedupe_removes_identical_findings():
    report = analyzer.analyze(text="лучший лучший лучший", input_type=InputType.text)
    superl = [f for f in report.findings if f.id == "superlative"]
    assert len(superl) == 1
