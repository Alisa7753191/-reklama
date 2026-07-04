"""Тесты детерминированного движка правил и определения категорий."""
from app.rules.engine import RulesEngine

engine = RulesEngine()


def _ids(text: str) -> set[str]:
    findings, _ = engine.analyze(text)
    return {f.id for f in findings}


def _cats(text: str) -> list[str]:
    _, cats = engine.analyze(text)
    return cats


def test_superlative_detected():
    assert "superlative" in _ids("Мы — лучший сервис в городе!")


def test_superlative_inflected_forms():
    # Морфология должна ловить формы: «лучшая», «самые».
    assert "superlative" in _ids("Самые выгодные условия и лучшая поддержка")


def test_superlative_not_triggered_by_bare_digit_one():
    # Регрессия: «за 1 час» не должно срабатывать как «№ 1».
    findings, _ = engine.analyze("Доставка за 1 час, скидка 20 процентов")
    assert "superlative" not in {f.id for f in findings}


def test_number_one_symbol_detected():
    assert "superlative" in _ids("Магазин №1 в России")


def test_guarantee_detected():
    assert "guarantee" in _ids("Гарантированно избавим вас от долгов навсегда")


def test_personal_data_detected():
    assert "personal_data" in _ids("Оставьте заявку и мы перезвоним")


def test_category_alcohol():
    assert "alcohol" in _cats("Элитный коньяк со скидкой")


def test_category_tobacco_vape():
    assert "tobacco" in _cats("Электронная сигарета с никотином")


def test_category_medicine_and_bad():
    cats = _cats("БАД, который вылечит вашу печень, — лучший препарат")
    assert "bad" in cats
    assert "medicine" in cats


def test_category_finance():
    assert "finance" in _cats("Кредит под 5% годовых без справок")


def test_missing_erid_flagged_for_internet_ad():
    assert "erid_missing" in _ids("Покупайте наши товары прямо сейчас")


def test_erid_present_not_flagged():
    text = "Реклама. Рекламодатель ООО Ромашка. erid: 2Vfnxabc123"
    assert "erid_missing" not in _ids(text)


def test_clean_marked_ad_has_no_formal_findings():
    text = (
        "Кофейня «Утро». Реклама. Рекламодатель: ООО «Утро», ИНН 1234567890. "
        "erid: 2Vfnxabc123. Приходите на чашку кофе. 0+"
    )
    findings, cats = engine.analyze(text)
    assert findings == []
    assert cats == []


def test_alcohol_requires_harm_warning():
    findings, _ = engine.analyze("Купите вино «Солнечное» с доставкой")
    ids = {f.id for f in findings}
    assert any(i.startswith("disclaimer_alcohol") for i in ids)


def test_findings_carry_legal_basis_and_liability():
    findings, _ = engine.analyze("Мы лучший банк страны")
    superl = next(f for f in findings if f.id == "superlative")
    assert superl.legal_basis, "должно быть правовое основание"
    assert superl.liability is not None
    assert superl.liability.fine_legal
