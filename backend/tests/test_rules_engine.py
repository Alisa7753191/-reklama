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
    assert "guarantee" in _ids("Стопроцентно вылечит любую болезнь без побочных")


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


def test_category_credit():
    assert "credit" in _cats("Кредит наличными под 5% годовых без справок")


def test_category_deposit():
    assert "deposit" in _cats("Вклад «Доходный» — 12% годовых")


def test_category_investment():
    assert "investment" in _cats("Инвестиции в облигации через брокера")


def test_category_bankruptcy():
    assert "bankruptcy" in _cats("Списание долгов через процедуру банкротства")


def test_category_energy_drinks():
    assert "energy_drinks" in _cats("Энергетический напиток с гуараной")


def test_category_weapons():
    assert "weapons" in _cats("Продаём травматическое оружие и патроны")


def test_credit_requires_risk_warning():
    ids = _ids("Кредит наличными от 5% годовых!")
    assert any("credit_warning" in i for i in ids)


def test_credit_conditional_psk_when_rate_present():
    ids = _ids("Ипотека 6% годовых, оформи сейчас")
    assert any(i.startswith("cond_credit") for i in ids)


def test_deposit_fixed_rate_not_flagged_as_false_guarantee():
    # Для вклада фиксированная ставка допустима: не должно быть находки «гарантии»,
    # но должно быть требование раскрыть все условия (ст. 28 ч. 2 п. 2).
    findings, _ = engine.analyze("Вклад с гарантированной ставкой 12% годовых")
    ids = {f.id for f in findings}
    assert "guarantee" not in ids
    assert any(i.startswith("cond_deposit") for i in ids)


def test_investment_guarantee_is_forbidden():
    ids = _ids("Инвестиции с гарантированной доходностью без риска")
    assert any(i.startswith("forbidden_investment") for i in ids)


def test_forex_requires_risk_warning():
    ids = _ids("Заработок на форекс с нашим форекс-дилером")
    assert any("forex_warning" in i for i in ids)


def test_bankruptcy_forbidden_and_warning():
    ids = _ids("Спишем все долги гарантированно через банкротство")
    assert any(i.startswith("forbidden_bankruptcy") for i in ids)
    assert any("bankr_warning" in i for i in ids)


def test_promo_event_requires_terms():
    assert "promo_event" in _ids("Розыгрыш призов! Выиграй автомобиль при покупке")


def test_tobacco_uses_current_legal_basis_not_repealed_article():
    findings, _ = engine.analyze("Электронная сигарета с никотином")
    tob = next(f for f in findings if f.id == "category_tobacco")
    # ст. 23 утратила силу — основание должно ссылаться на ст. 7 / ФЗ-15.
    assert tob.legal_basis
    assert "7" in tob.legal_basis[0].article


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
