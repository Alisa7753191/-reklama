import { useRef, useState } from 'react'
import type { InputType } from '../types'

interface Props {
  loading: boolean
  onAnalyzeText: (text: string) => void
  onAnalyzeUrl: (url: string) => void
  onAnalyzeImage: (file: File) => void
}

const TABS: { key: InputType; label: string }[] = [
  { key: 'text', label: 'Текст' },
  { key: 'url', label: 'Ссылка / лендинг' },
  { key: 'image', label: 'Изображение' },
]

const EXAMPLE =
  'Наш банк — лучший на рынке! Гарантированный доход по вкладам и самые ' +
  'выгодные кредиты. Оставьте заявку прямо сейчас!'

export function InputPanel({ loading, onAnalyzeText, onAnalyzeUrl, onAnalyzeImage }: Props) {
  const [tab, setTab] = useState<InputType>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="panel">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'tab--active' : ''}`}
            onClick={() => setTab(t.key)}
            disabled={loading}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'text' && (
        <div className="tab-body">
          <textarea
            className="textarea"
            placeholder="Вставьте рекламный текст, объявление, пост, слоган…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            disabled={loading}
          />
          <div className="panel__actions">
            <button className="link-btn" onClick={() => setText(EXAMPLE)} disabled={loading}>
              Подставить пример
            </button>
            <button
              className="btn"
              onClick={() => onAnalyzeText(text)}
              disabled={loading || !text.trim()}
            >
              {loading ? 'Проверяю…' : 'Проверить'}
            </button>
          </div>
        </div>
      )}

      {tab === 'url' && (
        <div className="tab-body">
          <input
            className="input"
            type="url"
            placeholder="https://example.ru/landing"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <div className="panel__actions">
            <span className="hint">Загрузим страницу и проверим её текст</span>
            <button
              className="btn"
              onClick={() => onAnalyzeUrl(url)}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Проверяю…' : 'Проверить'}
            </button>
          </div>
        </div>
      )}

      {tab === 'image' && (
        <div className="tab-body">
          <div className="filedrop" onClick={() => fileRef.current?.click()}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              disabled={loading}
            />
            {fileName ? (
              <span>📎 {fileName}</span>
            ) : (
              <span>Нажмите, чтобы выбрать креатив (PNG, JPG, WEBP)</span>
            )}
          </div>
          <div className="panel__actions">
            <span className="hint">Текст распознаётся через OCR / vision-модель</span>
            <button
              className="btn"
              onClick={() => {
                const file = fileRef.current?.files?.[0]
                if (file) onAnalyzeImage(file)
              }}
              disabled={loading || !fileName}
            >
              {loading ? 'Проверяю…' : 'Проверить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
