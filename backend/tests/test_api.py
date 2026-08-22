"""Тесты HTTP-эндпоинтов через FastAPI TestClient."""
import io
import zipfile

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


def test_analyze_invalid_url_returns_error_instead_of_clean_report():
    resp = client.post(
        "/api/analyze",
        json={"input_type": "url", "url": "http://127.0.0.1/internal"},
    )
    assert resp.status_code == 422
    assert "Локальные" in resp.json()["detail"]


def test_analyze_image_rejects_bad_type():
    resp = client.post(
        "/api/analyze/image",
        files={"file": ("test.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 400


def test_analyze_image_rejects_oversized_file(monkeypatch):
    from app.api import routes

    monkeypatch.setattr(routes.settings, "max_image_bytes", 4)
    resp = client.post(
        "/api/analyze/image",
        files={"file": ("large.png", b"12345", "image/png")},
    )
    assert resp.status_code == 413


def test_analyze_image_ocr_failure_is_not_reported_as_low_risk(monkeypatch):
    from app.api import routes
    from app.ingest.image import ImageResult

    monkeypatch.setattr(
        routes,
        "ingest_image",
        lambda *_args, **_kwargs: ImageResult(
            text="",
            warnings=["Не удалось распознать текст на изображении."],
        ),
    )
    resp = client.post(
        "/api/analyze/image",
        files={"file": ("creative.png", b"image", "image/png")},
    )
    assert resp.status_code == 422
    assert "Не удалось распознать" in resp.json()["detail"]


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


def test_analyze_docx_extracts_ad_text():
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        archive.writestr(
            "word/document.xml",
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Лучший банк для бизнеса</w:t></w:r></w:p></w:body></w:document>',
        )
    resp = client.post(
        "/api/analyze/file",
        files={"file": ("advert.docx", payload.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"material_role": "creative"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["input_type"] == "document"
    assert "Лучший банк" in body["extracted_text"]
    assert any(item["id"] == "superlative" for item in body["findings"])


def test_analyze_audio_uses_supplied_transcript():
    resp = client.post(
        "/api/analyze/file",
        files={"file": ("radio.mp3", b"fake-audio", "audio/mpeg")},
        data={"transcript": "Лучший банк для бизнеса", "material_role": "script"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["input_type"] == "audio"
    assert "сценарий/транскрипт" in " ".join(body["meta"]["warnings"])


def test_analyze_video_requires_transcript():
    resp = client.post(
        "/api/analyze/file",
        files={"file": ("spot.mp4", b"fake-video", "video/mp4")},
    )
    assert resp.status_code == 422
    assert "сценарий" in resp.json()["detail"]


def test_rewrite_returns_editable_draft_without_llm():
    resp = client.post(
        "/api/rewrite",
        json={
            "text": "Лучший банк. Гарантированный доход.",
            "findings": [],
            "company_description": "Банк",
            "product_description": "Вклад",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] in {"rules", "claude"}
    assert body["text"].strip()
