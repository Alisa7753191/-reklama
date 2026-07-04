"""Быстрый смоук-тест ядра (движок правил + оркестратор) без LLM и сети."""
from app.analysis.orchestrator import Analyzer
from app.models import InputType

SAMPLES = {
    "Превосходная степень + маркетинг": (
        "Наш банк — лучший на рынке! Самые выгодные кредиты и гарантированный "
        "доход по вкладам. Оставьте заявку прямо сейчас!"
    ),
    "Алкоголь в интернете": (
        "Премиальная водка «Северная» со скидкой 20%. Успейте купить! "
        "Доставка на дом за 1 час."
    ),
    "БАД под видом лекарства": (
        "Средство «Гепаклин» — биологически активная добавка, которая вылечит "
        "вашу печень навсегда и избавит от всех болезней!"
    ),
    "Корректная реклама с маркировкой": (
        "Кофейня «Утро». Реклама. Рекламодатель: ООО «Утро», ИНН 1234567890. "
        "erid: 2Vfnxabc123. Приходите на чашку кофе. 0+"
    ),
    "Вейпы": (
        "Новинка! Электронная сигарета POD X с ярким вкусом. Никотин 20 мг. "
        "Заказывай со скидкой."
    ),
}


def main() -> None:
    analyzer = Analyzer()
    for name, text in SAMPLES.items():
        report = analyzer.analyze(text=text, input_type=InputType.text)
        print("=" * 78)
        print(f"КЕЙС: {name}")
        print(f"Итоговый риск: {report.overall_risk.value.upper()} | "
              f"находок: {len(report.findings)} | "
              f"категории: {report.detected_categories}")
        for f in report.findings:
            liab = f.liability.koap_article if f.liability else "—"
            law = f.legal_basis[0].article if f.legal_basis else "—"
            print(f"  • [{f.risk_level.value:8}] {f.title}")
            print(f"      основание: {law} | ответственность: {liab}")
            if f.evidence:
                print(f"      цитата: {f.evidence}")
    print("=" * 78)
    print("OK: смоук-тест выполнен.")


if __name__ == "__main__":
    main()
