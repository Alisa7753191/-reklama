"""Сборка автономного HTML (standalone/index.html) из правовой базы YAML.

Данные базы знаний внедряются в шаблон standalone/template.html вместо
плейсхолдера __KB_DATA__, чтобы автономная версия всегда была синхронна
с бэкендом. Запуск:  python backend/tools/build_standalone.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KNOW = ROOT / "backend" / "app" / "knowledge"
TEMPLATE = ROOT / "standalone" / "template.html"
OUTPUT = ROOT / "standalone" / "index.html"

sys.path.insert(0, str(ROOT / "backend"))
import yaml  # noqa: E402
from app.config import DISCLAIMER  # noqa: E402


def load(name: str) -> dict:
    with (KNOW / name).open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def main() -> None:
    kb = {
        "laws": load("laws.yaml"),
        "liability": load("liability.yaml"),
        "practice": load("practice.yaml"),
        "categories": load("categories.yaml"),
        "rules": load("rules.yaml"),
        "disclaimer": DISCLAIMER,
    }
    data = json.dumps(kb, ensure_ascii=False, separators=(",", ":"))
    template = TEMPLATE.read_text(encoding="utf-8")
    if "__KB_DATA__" not in template:
        raise SystemExit("В шаблоне не найден плейсхолдер __KB_DATA__")
    OUTPUT.write_text(template.replace("__KB_DATA__", data), encoding="utf-8")
    print(f"OK: {OUTPUT.relative_to(ROOT)} собран "
          f"(законов={len(kb['laws'])}, категорий={len(kb['categories'])}, правил={len(kb['rules'])})")


if __name__ == "__main__":
    main()
