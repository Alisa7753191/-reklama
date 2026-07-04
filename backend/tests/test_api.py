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
