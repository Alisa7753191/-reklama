# Единый контейнер: собирает интерфейс и запускает FastAPI, который отдаёт
# и API (/api), и собранный интерфейс (/). Подходит для деплоя одним web-сервисом
# (Render, Hugging Face Spaces, Railway, Fly.io и т. п.).

# --- Этап 1: сборка фронтенда ---
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# --- Этап 2: бэкенд + распознавание картинок ---
FROM python:3.12-slim

# tesseract — запасной OCR (rus+eng), если не задан ANTHROPIC_API_KEY.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /fe/dist ./frontend_dist

ENV FRONTEND_DIST=/app/frontend_dist
# Хостинги задают порт через $PORT; для Hugging Face Spaces по умолчанию 7860.
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
