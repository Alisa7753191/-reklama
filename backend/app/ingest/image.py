"""Приём изображения-креатива: извлечение текста и значимых визуальных деталей.

Приоритет — vision-модель Claude (читает текст + описывает образы, важные для
рекламного комплаенса: изображения людей/животных для алкоголя, наличие пометки
«реклама», возрастных знаков и т.п.). Если ключа нет — запасной вариант Tesseract.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field
from typing import List

from ..config import settings

_VISION_PROMPT = (
    "Это рекламный креатив. Извлеки ВЕСЬ видимый текст дословно (включая мелкий "
    "шрифт, дисклеймеры, пометки «реклама», erid, возрастную маркировку). Затем "
    "кратко опиши значимые для рекламного комплаенса визуальные элементы: образы "
    "людей и животных, детей, алкоголь/табак, медицинскую атрибутику. Ответ дай в "
    "виде простого текста: сначала блок «ТЕКСТ:», затем блок «ВИЗУАЛ:»."
)


@dataclass
class ImageResult:
    text: str
    warnings: List[str] = field(default_factory=list)


def _vision_ocr(image_bytes: bytes, media_type: str) -> str | None:
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        b64 = base64.standard_b64encode(image_bytes).decode("ascii")
        resp = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": _VISION_PROMPT},
                    ],
                }
            ],
        )
        return "".join(
            b.text for b in resp.content if getattr(b, "type", "") == "text"
        ).strip()
    except Exception:  # noqa: BLE001
        return None


def _tesseract_ocr(image_bytes: bytes) -> str | None:
    try:
        import io

        import pytesseract
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(img, lang="rus+eng").strip()
    except Exception:  # noqa: BLE001
        return None


def ingest_image(image_bytes: bytes, media_type: str = "image/png") -> ImageResult:
    warnings: List[str] = []

    if settings.llm_enabled:
        text = _vision_ocr(image_bytes, media_type)
        if text:
            return ImageResult(text=text, warnings=warnings)
        warnings.append("Vision-модель недоступна, пробуем Tesseract.")

    text = _tesseract_ocr(image_bytes)
    if text:
        return ImageResult(text=text, warnings=warnings)

    warnings.append(
        "Не удалось распознать текст на изображении. Задайте ANTHROPIC_API_KEY "
        "для vision-распознавания или установите Tesseract OCR (пакет tesseract-ocr, "
        "языки rus+eng)."
    )
    return ImageResult(text="", warnings=warnings)
