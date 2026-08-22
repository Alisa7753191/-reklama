"""Извлечение текста из документов и приём расшифровок аудио/видео."""
from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import List
from xml.etree import ElementTree

from pypdf import PdfReader

from ..config import settings
from ..models import InputType

_DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt", ".md", ".rtf", ".srt", ".vtt"}
_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}
_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
_MAX_ARCHIVE_FILES = 2500
_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024


@dataclass
class FileResult:
    text: str
    input_type: InputType
    warnings: List[str] = field(default_factory=list)


def supported_extensions() -> set[str]:
    return _DOCUMENT_EXTENSIONS | _AUDIO_EXTENSIONS | _VIDEO_EXTENSIONS


def infer_input_type(filename: str) -> InputType:
    extension = Path(filename or "").suffix.lower()
    if extension in _DOCUMENT_EXTENSIONS:
        return InputType.document
    if extension in _AUDIO_EXTENSIONS:
        return InputType.audio
    if extension in _VIDEO_EXTENSIONS:
        return InputType.video
    raise ValueError(
        "Неподдерживаемый формат файла. Допустимы PDF, DOCX, PPTX, TXT, MD, "
        "RTF, SRT, VTT, MP3, WAV, M4A, OGG, FLAC, MP4, MOV, WEBM, MKV и AVI."
    )


def _limit_text(text: str) -> tuple[str, List[str]]:
    normalized = re.sub(r"\n{3,}", "\n\n", (text or "").replace("\r\n", "\n")).strip()
    if len(normalized) <= settings.max_text_chars:
        return normalized, []
    return normalized[: settings.max_text_chars], [
        f"Текст файла сокращён до {settings.max_text_chars:,} символов для безопасной проверки."
    ]


def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16", "cp1251"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _extract_pdf(data: bytes) -> tuple[str, List[str]]:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("PDF защищён паролем. Загрузите файл без защиты.")
        pages = reader.pages[:100]
        parts = [(page.extract_text() or "").strip() for page in pages]
        warnings = []
        if len(reader.pages) > len(pages):
            warnings.append("Проверены первые 100 страниц PDF.")
        if any(not part for part in parts):
            warnings.append("На отдельных страницах PDF текст не распознан; проверьте сканы вручную.")
        return "\n\n".join(part for part in parts if part), warnings
    except ValueError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Не удалось прочитать PDF. Проверьте, что файл не повреждён.") from exc


def _safe_zip(data: bytes) -> zipfile.ZipFile:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        entries = archive.infolist()
        if len(entries) > _MAX_ARCHIVE_FILES:
            archive.close()
            raise ValueError("В документе слишком много вложенных элементов.")
        if sum(entry.file_size for entry in entries) > _MAX_UNCOMPRESSED_BYTES:
            archive.close()
            raise ValueError("Распакованный документ слишком большой для безопасной проверки.")
        return archive
    except zipfile.BadZipFile as exc:
        raise ValueError("Не удалось открыть документ. Проверьте формат и целостность файла.") from exc


def _xml_paragraphs(xml_data: bytes, paragraph_tag: str, text_tag: str) -> List[str]:
    try:
        root = ElementTree.fromstring(xml_data)
    except ElementTree.ParseError:
        return []
    paragraphs: List[str] = []
    for paragraph in root.iter(paragraph_tag):
        text = "".join((node.text or "") for node in paragraph.iter(text_tag)).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def _extract_docx(data: bytes) -> str:
    word_ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    parts: List[str] = []
    with _safe_zip(data) as archive:
        names = [name for name in archive.namelist() if re.match(r"word/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$", name)]
        names.sort(key=lambda name: (0 if name == "word/document.xml" else 1, name))
        for name in names:
            parts.extend(_xml_paragraphs(archive.read(name), f"{word_ns}p", f"{word_ns}t"))
    return "\n".join(parts)


def _slide_number(name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def _extract_pptx(data: bytes) -> str:
    drawing_ns = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    parts: List[str] = []
    with _safe_zip(data) as archive:
        slides = [name for name in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name)]
        for name in sorted(slides, key=_slide_number):
            try:
                root = ElementTree.fromstring(archive.read(name))
            except ElementTree.ParseError:
                continue
            texts = [(node.text or "").strip() for node in root.iter(f"{drawing_ns}t")]
            slide_text = " ".join(text for text in texts if text)
            if slide_text:
                parts.append(f"Слайд {_slide_number(name)}\n{slide_text}")
    return "\n\n".join(parts)


def _extract_rtf(data: bytes) -> str:
    value = _decode_text(data)
    value = re.sub(r"\\par[d]?\s*", "\n", value)
    value = re.sub(r"\\'[0-9a-fA-F]{2}", "", value)
    value = re.sub(r"\\[a-zA-Z]+-?\d*\s?", "", value)
    return value.replace("{", "").replace("}", "")


def ingest_file(data: bytes, filename: str, transcript: str = "") -> FileResult:
    input_type = infer_input_type(filename)
    extension = Path(filename).suffix.lower()
    warnings: List[str] = []

    if input_type in {InputType.audio, InputType.video}:
        text, limit_warnings = _limit_text(transcript)
        if not text:
            kind = "аудио" if input_type == InputType.audio else "видео"
            raise ValueError(
                f"Для проверки {kind} добавьте сценарий или расшифровку речи. "
                "Система проверит текст; звук, монтаж и видеоряд должен подтвердить юрист."
            )
        warnings.extend(limit_warnings)
        warnings.append(
            "Проверен предоставленный сценарий/транскрипт. Звук, темп, монтаж, "
            "читаемость титров и видеоряд требуют отдельной проверки юристом."
        )
        return FileResult(text=text, input_type=input_type, warnings=warnings)

    if extension == ".pdf":
        text, extract_warnings = _extract_pdf(data)
        warnings.extend(extract_warnings)
    elif extension == ".docx":
        text = _extract_docx(data)
    elif extension == ".pptx":
        text = _extract_pptx(data)
    elif extension == ".rtf":
        text = _extract_rtf(data)
    else:
        text = _decode_text(data)

    text, limit_warnings = _limit_text(text)
    warnings.extend(limit_warnings)
    if not text:
        raise ValueError(
            "В файле не найден доступный текст. Если это скан, загрузите страницы "
            "как изображения или добавьте текстовую расшифровку."
        )
    return FileResult(text=text, input_type=input_type, warnings=warnings)
