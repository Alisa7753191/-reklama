import { useRef, useState } from 'react'
import type { InputType } from '../types'
import type { Channel } from '../api'

interface Props {
  loading: boolean
  onAnalyzeText: (text: string, channel: Channel) => void
  onAnalyzeUrl: (url: string, channel: Channel) => void
  onAnalyzeImage: (file: File, channel: Channel) => void
}

const TABS: { key: InputType; label: string }[] = [
  { key: 'text', label: 'Текст' },
  { key: 'url', label: 'Ссылка / лендинг' },
  { key: 'image', label: 'Изображение' },
]

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'internet', label: 'Интернет' },
  { key: 'sms', label: 'СМС / рассылка' },
  { key: 'tv', label: 'ТВ' },
  { key: 'radio', label: 'Радио' },
  { key: 'print', label: 'Печать' },
  { key: 'outdoor', label: 'Наружная' },
]

const EXAMPLE =
  'Наш банк — лучший на рынке! Гарантированный доход по вкладам и самые ' +
  'выгодные кредиты. Оставьте заявку прямо сейчас!'

export function InputPanel({ loading, onAnalyzeText, onAnalyzeUrl, onAnalyzeImage }: Props) {
  const [tab, setTab] = useState<InputType>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [channel, setChannel] = useState<Channel>('internet')
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <span className="panel__eyebrow">ФОРМАТ МАТЕРИАЛА</span>
          <h2>Что будем проверять?</h2>
        </div>
        <span className="panel__status"><i /> Готово к анализу</span>
      </div>

      <div className="tabs">
        {TABS.map((t, index) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'tab--active' : ''}`}
            onClick={() => setTab(t.key)}
            disabled={loading}
          >
            <span>0{index + 1}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="channel-row">
        <label htmlFor="channel">Канал распространения:</label>
        <select
          id="channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          disabled={loading}
        >
          {CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="channel-hint">
          Риски маркировки (ERID, «реклама») — только для интернет-рекламы
        </span>
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
              onClick={() => onAnalyzeText(text, channel)}
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
              onClick={() => onAnalyzeUrl(url, channel)}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Проверяю…' : 'Проверить'}
            </button>
          </div>
        </div>
      )}

      {tab === 'image' && (
        <div className="tab-body">
          <button className="filedrop" type="button" onClick={() => fileRef.current?.click()} disabled={loading}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              disabled={loading}
            />
            {fileName ? (
              <><b>Файл выбран</b><span>{fileName}</span></>
            ) : (
              <><b>Перетащите или выберите креатив</b><span>PNG, JPG или WEBP · до 10 МБ</span></>
            )}
          </button>
          <div className="panel__actions">
            <span className="hint">Текст распознаётся через OCR / vision-модель</span>
            <button
              className="btn"
              onClick={() => {
                const file = fileRef.current?.files?.[0]
                if (file) onAnalyzeImage(file, channel)
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
