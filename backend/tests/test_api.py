"""Тесты HTTP-эндпоинтов через FastAPI TestClient."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "llm_enabled" in body


def test_analyze_text_ok():
    resp = client.post("/api/analyze", json={"input_type": "text", "text": "Лучший банк!"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["overall_risk"] in {"low", "medium", "high", "critical"}
    assert any(f["id"] == "superlative" for f in body["findings"])


def test_analyze_text_accepts_onboarding_context():
    resp = client.post(
        "/api/analyze",
        json={
            "input_type": "text",
            "text": "До 18% годовых",
            "company_description": "Банк для частных клиентов",
            "product_description": "Банковский вклад",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "deposit" in body["detected_categories"]
    assert body["meta"]["company_description"] == "Банк для частных клиентов"
    assert body["meta"]["product_description"] == "Банковский вклад"


def test_analyze_empty_text_400():
    resp = client.post("/api/analyze", json={"input_type": "text", "text": "  "})
    assert resp.status_code == 400


def test_analyze_url_missing_400():
    resp = client.post("/api/analyze", json={"input_type": "url"})
    assert resp.status_code == 400


def test_analyze_invalid_url_degrades_gracefully():
    resp = client.post("/api/analyze", json={"input_type": "url", "url": "not-a-url"})
    assert resp.status_code == 200
    body = resp.json()
    assert any("Некорректный URL" in w for w in body["meta"]["warnings"])


def test_analyze_image_rejects_bad_type():
    resp = client.post(
        "/api/analyze/image",
        files={"file": ("test.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 400


def test_image_split_text_visual_keeps_marking_out_of_engine():
    # Блок «ВИЗУАЛ» (со словом «erid») не должен попадать в текст для движка,
    # иначе проверка маркировки решит, что erid присутствует.
    from app.ingest.image import _split_text_visual

    raw = (
        "ТЕКСТ:\nВклад 20% годовых. АЛЬФА\n"
        "ВИЗУАЛ:\nТолько логотип, фирменного наименования нет; erid не виден."
    )
    text, visual = _split_text_visual(raw)
    assert "erid" not in text.lower()
    assert text.startswith("Вклад 20% годовых")
    assert "erid" in visual.lower()
    assert not visual.lower().startswith("визуал")
