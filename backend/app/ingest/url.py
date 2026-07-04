"""Приём лендинга по URL: загрузка страницы и извлечение видимого текста.

MVP использует httpx + BeautifulSoup (быстро и без браузера). Для JS-тяжёлых
страниц позже можно подключить Playwright (в окружении он установлен).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from ..config import settings

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
_DROP_TAGS = ("script", "style", "noscript", "template", "svg")


@dataclass
class URLResult:
    text: str
    title: str = ""
    warnings: List[str] = field(default_factory=list)


def _valid_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:  # noqa: BLE001
        return False


def ingest_url(url: str) -> URLResult:
    url = (url or "").strip()
    if not _valid_url(url):
        return URLResult(text="", warnings=["Некорректный URL. Ожидается http(s)://…"])

    try:
        with httpx.Client(
            timeout=settings.url_fetch_timeout, follow_redirects=True, headers=_HEADERS
        ) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError as exc:
        return URLResult(text="", warnings=[f"Не удалось загрузить страницу: {exc}"])

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(_DROP_TAGS):
        tag.decompose()

    title = soup.title.get_text(strip=True) if soup.title else ""
    # Собираем видимый текст и содержимое meta-описания.
    parts: List[str] = []
    if title:
        parts.append(title)
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        parts.append(meta_desc["content"])

    body_text = soup.get_text(separator=" ", strip=True)
    parts.append(body_text)

    text = "\n".join(p for p in parts if p)
    if len(text) > settings.max_text_chars:
        text = text[: settings.max_text_chars]

    warnings: List[str] = []
    if not body_text.strip():
        warnings.append(
            "Страница вернула мало текста — возможно, контент рендерится через JS. "
            "Для таких страниц потребуется рендеринг браузером."
        )
    return URLResult(text=text, title=title, warnings=warnings)
