# Перенос проекта «ПравоРеклама» в другой аккаунт

Проверка рекламных коммуникаций на правовые риски по ФЗ‑38 «О рекламе» (РФ).

## Что внутри
```
backend/            FastAPI + движок правил (Python). Правовая база — backend/app/knowledge/*.yaml
frontend/           React + Vite (интерфейс)
standalone/         Автономная версия (1 HTML, работает офлайн, только правила)
docs/               Копия автономной версии для GitHub Pages
.claude/skills/     Скиллы Claude:
                      proverka-reklamy-vklada          — проверка рекламы вклада
                      proverka-reklamy-obshchie-normy  — общие нормы (ст. 5/8/9)
Dockerfile          Единый контейнер (интерфейс + API) для деплоя
render.yaml         Блупринт для Render
docker-compose.yml  Локальный запуск (2 контейнера)
DEPLOY.md           Инструкция по хостингу (Render / HF / локально)
.github/workflows/  Автодеплой автономной версии на GitHub Pages
```

## Как перенести в новый GitHub‑аккаунт
1. Создай пустой репозиторий в новом аккаунте (например, `pravoreklama`).
2. В папке проекта:
   ```bash
   git init
   git add .
   git commit -m "Импорт проекта ПравоРеклама"
   git branch -M main
   git remote add origin https://github.com/<НОВЫЙ_АККАУНТ>/pravoreklama.git
   git push -u origin main
   ```
3. Скиллы Claude уже в `.claude/skills/` — они переедут вместе с репозиторием.

## Как запустить локально
**Бэкенд:**
```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload      # http://127.0.0.1:8000  (API — /api, интерфейс — /)
```
**Фронтенд (для разработки):**
```bash
cd frontend
npm install
npm run dev                        # http://127.0.0.1:5173
```
**Автономная версия:** открой `standalone/index.html` в браузере (без сервера).

## Как задеплоить публично
Подробно — в `DEPLOY.md`. Кратко: Render → New → Blueprint (или Web Service из Docker),
задать секрет `ANTHROPIC_API_KEY` (нужен только для ИИ‑анализа и «зрения» по картинкам;
без него работают правила + OCR).

## Правовая база и правила
Всё редактируется в YAML (не в коде): `backend/app/knowledge/`
- `laws.yaml` — статьи законов; `liability.yaml` — штрафы КоАП; `practice.yaml` — практика ФАС;
- `categories.yaml` — товарные/продуктовые категории; `rules.yaml` — общие правила.
После правок автономную версию пересобрать: `python backend/tools/build_standalone.py`.

> ⚠️ Инструмент — поддержка решений, не юридическая консультация. Сверяйте с действующей
> редакцией закона и юристом.
