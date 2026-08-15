"""HTTP-эндпоинты анализа рекламы."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..analysis.orchestrator import Analyzer
from ..config import settings
from ..ingest.image import ingest_image
from ..ingest.text import ingest_text
from ..ingest.url import ingest_url
from ..models import AnalyzeRequest, Channel, InputType, Report

router = APIRouter()
_analyzer = Analyzer()

_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "llm_enabled": settings.llm_enabled,
        "llm_provider": settings.llm_provider if settings.llm_enabled else None,
    }


@router.post("/analyze", response_model=Report)
def analyze(req: AnalyzeRequest) -> Report:
    """Анализ текста или лендинга по URL."""
    if req.input_type == InputType.url:
        if not req.url:
            raise HTTPException(status_code=400, detail="Не указан URL для анализа.")
        result = ingest_url(req.url)
        if not result.text.strip():
            detail = result.warnings[0] if result.warnings else "Не удалось получить текст страницы."
            raise HTTPException(status_code=422, detail=detail)
        return _analyzer.analyze(
            text=result.text,
            input_type=InputType.url,
            extra_warnings=result.warnings,
            channel=req.channel,
            company_description=req.company_description or "",
            product_description=req.product_description or "",
        )

    # По умолчанию — текстовый анализ.
    text = ingest_text(req.text or "")
    if not text:
        raise HTTPException(status_code=400, detail="Не передан текст для анализа.")
    return _analyzer.analyze(
        text=text,
        input_type=InputType.text,
        channel=req.channel,
        company_description=req.company_description or "",
        product_description=req.product_description or "",
    )


@router.post("/analyze/image", response_model=Report)
async def analyze_image(
    file: UploadFile = File(...),
    channel: Channel = Form(Channel.internet),
    company_description: str = Form(""),
    product_description: str = Form(""),
) -> Report:
    """Анализ рекламного креатива (изображения) через OCR/vision."""
    media_type = file.content_type or "image/png"
    if media_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Неподдерживаемый тип изображения: {media_type}. "
            f"Допустимо: {', '.join(sorted(_ALLOWED_IMAGE_TYPES))}.",
        )
    image_bytes = await file.read(settings.max_image_bytes + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Пустой файл изображения.")
    if len(image_bytes) > settings.max_image_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Изображение слишком большое. Максимальный размер — "
            f"{settings.max_image_bytes // (1024 * 1024)} МБ.",
        )

    result = ingest_image(image_bytes, media_type=media_type)
    if not result.text.strip():
        detail = result.warnings[-1] if result.warnings else "Не удалось распознать текст."
        raise HTTPException(status_code=422, detail=detail)
    warnings = list(result.warnings)
    # Визуальные наблюдения показываем отдельной заметкой, но НЕ отдаём в движок правил
    # (чтобы слова вроде «erid» из наблюдений не глушили проверку маркировки).
    if result.visual:
        warnings.append(f"📷 Визуальные наблюдения (проверьте вручную): {result.visual}")
    return _analyzer.analyze(
        text=result.text,
        input_type=InputType.image,
        extra_warnings=warnings,
        channel=channel,
        company_description=company_description,
        product_description=product_description,
    )
