"""Настройки приложения (читаются из переменных окружения)."""
from __future__ import annotations

import os

DISCLAIMER = (
    "Результаты проверки носят информационно-справочный характер, формируются "
    "автоматически и НЕ являются юридической консультацией или заключением. "
    "Правовая база и размеры штрафов могут устаревать. Перед принятием решений "
    "проконсультируйтесь с квалифицированным юристом."
)


class Settings:
    # LLM
    llm_provider: str = os.getenv("LLM_PROVIDER", "claude")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8")
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))

    # Сеть/ингест
    url_fetch_timeout: int = int(os.getenv("URL_FETCH_TIMEOUT", "20"))
    max_text_chars: int = int(os.getenv("MAX_TEXT_CHARS", "20000"))
    max_html_bytes: int = int(os.getenv("MAX_HTML_BYTES", str(2 * 1024 * 1024)))
    max_image_bytes: int = int(os.getenv("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
    max_file_bytes: int = int(os.getenv("MAX_FILE_BYTES", str(25 * 1024 * 1024)))

    # CORS
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key) and self.llm_provider == "claude"


settings = Settings()
