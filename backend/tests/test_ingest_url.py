"""Проверки нормализации и защиты загрузчика лендингов."""

import pytest

from app.ingest.url import _normalize_url, _validate_public_url


def test_normalize_url_adds_https_to_bare_domain():
    assert _normalize_url("example.ru/landing") == "https://example.ru/landing"


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://10.0.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "http://localhost:8000/",
    ],
)
def test_validate_public_url_blocks_local_networks(url: str):
    with pytest.raises(ValueError, match="Локальные"):
        _validate_public_url(url)


def test_validate_public_url_rejects_credentials():
    with pytest.raises(ValueError, match="логином"):
        _validate_public_url("https://user:secret@example.ru/")
