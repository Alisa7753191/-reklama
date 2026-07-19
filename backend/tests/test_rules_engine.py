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


def test_category_deposit_compound_forms():
    # Слитные маркетинговые формы должны распознаваться как «вклад».
    assert "deposit" in _cats("СУПЕРВКЛАД до 24% годовых")
    assert "deposit" in _cats("Мегадепозит 18%")


def test_category_deposit_no_false_positive_on_tab():
    # «Вкладка»/«вкладыш» — не банковский вклад.
    assert "deposit" not in _cats("Новая вкладка в браузере, удобный интерфейс")
    assert "deposit" not in _cats("Рекламный вкладыш в журнале")


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


def test_promo_event_ok_with_terms_and_source():
    # Указаны сроки и источник правил/организатора → риск не выставляется.
    assert "promo_event" not in _ids(
        "Розыгрыш авто. Сроки 01.06–31.08.2025. Организатор и правила на сайте"
    )


def test_promo_event_not_triggered_by_plain_discount():
    # Скидочная акция — это не ст. 9 (стимулирующее мероприятие).
    assert "promo_event" not in _ids("Скидка -20% на всё до конца недели")


def test_distance_selling_flagged_without_seller_details():
    assert "distance_selling" in _ids("Купи смарт-часы на сайте — доставка по России")


def test_distance_selling_co_occurrence_with_words_between():
    # «купи … онлайн» с словами между должно срабатывать (группы триггеров).
    assert "distance_selling" in _ids("купи товары онлайн")
    assert "distance_selling" in _ids("Закажи кроссовки с доставкой")
    assert "distance_selling" in _ids("Купить телефон в интернете")


def test_distance_selling_not_triggered_by_online_service_without_purchase():
    # «онлайн» без покупки товара — не дистанционная продажа.
    assert "distance_selling" not in _ids("Консультация юриста онлайн")


def test_distance_selling_any_sale_without_online_word():
    # Любая продажа товара (без слова «онлайн») тоже триггерит ст. 8.
    assert "distance_selling" in _ids("Купи кроссовки")
    assert "distance_selling" in _ids("Новая коллекция уже в продаже")
    assert "distance_selling" in _ids("Закажи цветы с доставкой")


def test_distance_selling_not_triggered_for_financial_service():
    # Финансовые услуги (вклад/кредит) — не товар, ст. 8 не применяется.
    assert "distance_selling" not in _ids("Оформи вклад под 16% годовых")
    assert "distance_selling" not in _ids("Оформи кредит наличными")


def test_distance_selling_ok_with_ogrn():
    assert "distance_selling" not in _ids(
        "Купите на сайте. Продавец ООО «Ромашка», г. Москва, ОГРН 1027700000000"
    )


def test_distance_selling_not_triggered_offline():
    assert "distance_selling" not in _ids("Магазин в ТЦ «Авиапарк», только офлайн-покупка")


def test_firm_name_flagged_for_brand_only():
    # «Сбер» — бренд, а не фирменное наименование → должно флагаться (ст. 28 ч. 1).
    ids = _ids("Вклад в Сбере под 12% годовых")
    assert any("firm_name" in i for i in ids)


def test_firm_name_ok_with_legal_form():
    ids = _ids("Вклад в ПАО Сбербанк, срок 1 год, с капитализацией процентов")
    assert not any("firm_name" in i for i in ids)


def test_credit_psk_required_when_rate_present():
    assert "cond_credit_credit_psk" in _ids("Кредит наличными под 5% годовых")


def test_credit_psk_ok_when_disclosed():
    ids = _ids("Кредит, ставка 5% годовых, полная стоимость кредита 5-8%")
    assert "cond_credit_credit_psk" not in ids


def test_credit_psk_abbreviation_alone_is_not_enough():
    # ч. 3 ст. 28 требует слов «полная стоимость кредита (займа)» — «ПСК» не хватает.
    assert "cond_credit_credit_psk" in _ids("Кредит, ставка 5% годовых, ПСК 5-8%")


def test_credit_findings_cite_specific_parts_of_art28():
    findings, _ = engine.analyze("Кредит в Сбере под 5% годовых!")
    by_id = {f.id: f for f in findings}
    warn = by_id["disclaimer_credit_credit_warning"]
    assert any("3.1" in lb.article for lb in warn.legal_basis)
    firm = by_id["disclaimer_credit_firm_name"]
    assert any(lb.article == "ст. 28, ч. 1" for lb in firm.legal_basis)
    psk = by_id["cond_credit_credit_psk"]
    assert any(lb.article == "ст. 28, ч. 3" for lb in psk.legal_basis)
    # ч. 3.2 (ипотека) цитируется как сопутствующая норма
    assert any("3.2" in lb.article for lb in psk.legal_basis)


def test_deposit_terms_not_flagged_without_financial_condition():
    # Письмо ФАС КТ/85530/23: риск только «если сообщается хотя бы одно условие».
    assert "cond_deposit_deposit_terms" not in _ids("Вклад с высоким доходом")
    assert "cond_deposit_deposit_terms" not in _ids("Откройте вклад в ПАО Сбербанк")


def test_deposit_terms_flagged_when_rate_stated():
    assert "cond_deposit_deposit_terms" in _ids("Вклад 12% годовых")


def test_deposit_terms_flagged_by_default_even_when_disclosed():
    # Дефолт: при любом финусловии риск раскрытия условий выводится ВСЕГДА,
    # даже если условия на вид раскрыты (полноту оценивает юрист).
    findings, _ = engine.analyze(
        "Вклад 12% годовых, срок 6 месяцев, с ежемесячной капитализацией"
    )
    ids = {f.id for f in findings}
    assert "cond_deposit_deposit_terms" in ids
    note = next(f for f in findings if f.id == "cond_deposit_deposit_terms")
    assert "юрист" in note.description  # отметка о проверке полноты юристом


def test_deposit_terms_flagged_when_only_term_or_sum_stated():
    # Финусловие — не только ставка: срок или сумма тоже триггерят правило 2.
    assert "cond_deposit_deposit_terms" in _ids("Вклад на 6 месяцев")
    assert "cond_deposit_deposit_terms" in _ids("Вклад от 100 000 ₽")


def test_deposit_no_special_regime_card():
    # Мусорная карточка «Особый правовой режим: Вклады» не должна выводиться.
    ids = _ids("Вклад 12% годовых в АО «Банк»")
    assert "category_deposit" not in ids


def test_zero_currency_not_matched_inside_amount():
    # «0 ₽» не должно ложно матчиться внутри «100 000 ₽».
    ids = _ids("Вклад 15%, сумма от 100 000 ₽. АО «Банк»")
    assert "free_bait" not in ids


def test_no_category_card_when_specific_checks_cover_it():
    # У кредита все требования покрыты отдельными проверками — общая карточка
    # «Особый правовой режим» не выдаётся (не дублирует фирменное наименование).
    ids = _ids("Кредит в Сбере под 5% годовых")
    assert "category_credit" not in ids
    # Но категория всё равно определена.
    assert "credit" in _cats("Кредит в Сбере под 5% годовых")


def test_category_card_kept_when_it_carries_context():
    # У алкоголя есть неповторяющиеся запреты (интернет-запрет и т.п.) — карточка нужна.
    assert "category_alcohol" in _ids("Купите вино «Солнечное»")


def test_mortgage_subject_to_same_credit_rules():
    # ч. 3.2: ипотека физлицам — те же требования, что и потребкредит.
    ids = _ids("Ипотека под 6% годовых в Сбере")
    assert "cond_credit_credit_psk" in ids
    assert any("credit_warning" in i for i in ids)


def test_fully_compliant_credit_ad_is_clean():
    text = (
        "ПАО Сбербанк. Кредит: полная стоимость кредита от 5,1% до 8,3%. "
        "Ставка 5% годовых. Изучите все условия кредита (займа) на сайте "
        "sberbank.ru в разделе «Кредиты». Оценивайте свои финансовые "
        "возможности и риски."
    )
    findings, _ = engine.analyze(text)
    credit_issues = [
        f for f in findings
        if f.category == "credit" and f.id != "category_credit"
    ]
    assert credit_issues == []


def test_credit_link_required_with_phrase():
    assert "cond_credit_credit_link" in _ids(
        "Кредит. Изучите все условия кредита. ПАО Банк."
    )


def test_credit_link_ok_with_site():
    ids = _ids("Кредит. Изучите все условия кредита на сайте bank.ru. ПАО Банк.")
    assert "cond_credit_credit_link" not in ids


def test_company_name_not_misdetected_as_alcohol():
    # Регрессия: «Ромашка» (содержит «ром»), «промо» не должны давать категорию алкоголь.
    assert "alcohol" not in _cats("Скидки и промо от компании ООО Ромашка")
    # А настоящий алкоголь по-прежнему определяется.
    assert "alcohol" in _cats("Выдержанный ром и коньяк")


def test_age_marking_not_required_for_ordinary_goods():
    # Возрастная маркировка НЕ нужна для рекламы обычных товаров/услуг.
    assert "age_marking_missing" not in _ids("Купите пылесос со скидкой 20%")
    assert "age_marking_missing" not in _ids("Кредит наличными под 5% годовых")


def test_age_marking_required_for_info_product_without_mark():
    # Информационная продукция без знака 0+…18+ → флаг.
    assert "age_marking_missing" in _ids("Премьера нового фильма уже в кино!")


def test_age_marking_ok_for_info_product_with_mark():
    assert "age_marking_missing" not in _ids("Премьера нового фильма в кино. 16+")


def test_age_marking_required_for_mobile_app():
    # Мобильное приложение — программа для ЭВМ = информационная продукция (436-ФЗ).
    assert "age_marking_missing" in _ids("Скачайте наше приложение банка в App Store")
    assert "age_marking_missing" in _ids("Мобильный банк СБОЛ — оплата в одно касание")


def test_age_marking_ok_for_app_with_mark():
    assert "age_marking_missing" not in _ids("Приложение доступно в Google Play. 6+")


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
