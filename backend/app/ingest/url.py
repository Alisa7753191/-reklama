"""Безопасная загрузка лендинга и извлечение видимого текста."""
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass, field
from typing import List
from urllib.parse import urljoin, urlparse

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
_REDIRECT_CODES = {301, 302, 303, 307, 308}
_MAX_REDIRECTS = 5


@dataclass
class URLResult:
    text: str
    title: str = ""
    warnings: List[str] = field(default_factory=list)


def _normalize_url(url: str) -> str:
    value = (url or "").strip()
    if value and "://" not in value:
        value = f"https://{value}"
    return value


def _validate_public_url(url: str) -> None:
    """Отклонить служебные и локальные адреса, включая цели редиректов."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Некорректный URL. Укажите адрес сайта, например example.ru.")
    if parsed.username or parsed.password:
        raise ValueError("URL с логином или паролем не поддерживается.")

    hostname = parsed.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith((".localhost", ".local")):
        raise ValueError("Локальные и служебные адреса нельзя анализировать.")

    try:
        literal = ipaddress.ip_address(hostname)
        addresses = [literal]
    except ValueError:
        try:
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            resolved = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
            addresses = list({ipaddress.ip_address(item[4][0]) for item in resolved})
        except (OSError, ValueError) as exc:
            raise ValueError("Не удалось определить адрес сайта.") from exc

    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Локальные и служебные адреса нельзя анализировать.")


def _download_html(url: str) -> str:
    current_url = _normalize_url(url)
    if not current_url:
        raise ValueError("Не указан адрес страницы.")

    with httpx.Client(
        timeout=settings.url_fetch_timeout,
        follow_redirects=False,
        headers=_HEADERS,
    ) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            _validate_public_url(current_url)
            with client.stream("GET", current_url) as response:
                if response.status_code in _REDIRECT_CODES:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("Сайт вернул редирект без нового адреса.")
                    current_url = urljoin(current_url, location)
                    continue

                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                if content_type and not (
                    content_type.startswith("text/")
                    or "application/xhtml+xml" in content_type
                ):
                    raise ValueError("По ссылке находится не HTML-страница с рекламой.")

                content_length = response.headers.get("content-length")
                if content_length:
                    try:
                        if int(content_length) > settings.max_html_bytes:
                            raise ValueError("Страница слишком большая для безопасной проверки.")
                    except ValueError as exc:
                        if "слишком большая" in str(exc):
                            raise

                chunks: list[bytes] = []
                total = 0
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > settings.max_html_bytes:
                        raise ValueError("Страница слишком большая для безопасной проверки.")
                    chunks.append(chunk)

                encoding = response.charset_encoding or "utf-8"
                return b"".join(chunks).decode(encoding, errors="replace")

    raise ValueError("Сайт перенаправляет запрос слишком много раз.")


def ingest_url(url: str) -> URLResult:
    try:
        html = _download_html(url)
    except ValueError as exc:
        return URLResult(text="", warnings=[str(exc)])
    except httpx.HTTPError as exc:
        return URLResult(text="", warnings=[f"Не удалось загрузить страницу: {exc}"])

    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else ""
    if soup.title:
        soup.title.decompose()
    for tag in soup(_DROP_TAGS):
        tag.decompose()

    parts: List[str] = []
    if title:
        parts.append(title)
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        parts.append(str(meta_desc["content"]))

    body_text = soup.get_text(separator=" ", strip=True)
    if body_text:
        parts.append(body_text)

    text = "\n".join(parts)
    if len(text) > settings.max_text_chars:
        text = text[: settings.max_text_chars]

    warnings: List[str] = []
    if not body_text:
        warnings.append(
            "Страница не содержит доступного текста. Возможно, контент загружается "
            "через JavaScript; загрузите скриншот или вставьте текст рекламы."
        )
    return URLResult(text=text, title=title, warnings=warnings)
