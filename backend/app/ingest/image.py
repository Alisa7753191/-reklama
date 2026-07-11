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
    "Это статичный рекламный креатив (баннер/картинка), НЕ видео. Выполни две задачи.\n"
    "1) В блоке «ТЕКСТ:» приведи ВЕСЬ видимый текст ДОСЛОВНО, включая мелкий шрифт, "
    "сноски и дисклеймеры (под звёздочкой, внизу, сбоку). Ничего не пропускай.\n"
    "2) В блоке «ВИЗУАЛ:» опиши значимые для рекламного комплаенса визуальные факты:\n"
    "- есть ли на креативе фирменное наименование (организационно-правовая форма + "
    "название) или только логотип/бренд без наименования;\n"
    "- видна ли пометка «реклама», рекламодатель и идентификатор erid;\n"
    "- есть ли возрастная маркировка (0+…18+);\n"
    "- читаемы ли существенные условия или набраны нечитаемо мелким/низкоконтрастным "
    "шрифтом;\n"
    "- образы людей/детей/животных, алкоголь/табак, медицинская атрибутика.\n"
    "Строго соблюдай формат: сначала строка «ТЕКСТ:» и дословный текст, затем строка "
    "«ВИЗУАЛ:» и наблюдения."
)


def _split_text_visual(raw: str) -> tuple[str, str]:
    """Делит ответ vision-модели на дословный текст (в движок правил) и визуальные
    наблюдения (отдельная заметка). Важно не смешивать: слова из блока «ВИЗУАЛ»
    (напр. «erid не виден») не должны попадать в детерминированные проверки, иначе
    проверка маркировки решит, что erid присутствует."""
    text_part, visual_part = raw, ""
    low = raw.lower()
    vi = low.find("визуал")
    if vi != -1:
        text_part = raw[:vi]
        visual_part = raw[vi:]
    # Убираем метку «ТЕКСТ:» из начала текстового блока.
    ti = text_part.lower().find("текст:")
    if ti != -1:
        text_part = text_part[ti + len("текст:"):]
    # Из визуального блока убираем саму метку «ВИЗУАЛ:».
    visual_part = re_sub_label(visual_part)
    return text_part.strip(), visual_part.strip()


def re_sub_label(visual_part: str) -> str:
    idx = visual_part.lower().find("визуал")
    if idx == -1:
        return visual_part
    rest = visual_part[idx + len("визуал"):]
    return rest.lstrip(": ").lstrip()


@dataclass
class ImageResult:
    text: str
    visual: str = ""
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
        raw = _vision_ocr(image_bytes, media_type)
        if raw:
            text, visual = _split_text_visual(raw)
            return ImageResult(text=text or raw, visual=visual, warnings=warnings)
        warnings.append("Vision-модель недоступна, пробуем Tesseract.")

    text = _tesseract_ocr(image_bytes)
    if text:
        # Tesseract даёт только текст, без визуальных наблюдений.
        return ImageResult(text=text, warnings=warnings)

    warnings.append(
        "Не удалось распознать текст на изображении. Задайте ANTHROPIC_API_KEY "
        "для vision-распознавания или установите Tesseract OCR (пакет tesseract-ocr, "
        "языки rus+eng)."
    )
    return ImageResult(text="", warnings=warnings)
