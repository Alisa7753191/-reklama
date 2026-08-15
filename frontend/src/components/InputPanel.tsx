import { useRef, useState } from 'react'
import type { InputType } from '../types'
import type { Channel } from '../api'

interface Props {
  loading: boolean
  onDraftChange: () => void
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
  { key: 'email', label: 'E-mail' },
  { key: 'tv', label: 'ТВ' },
  { key: 'radio', label: 'Радио' },
  { key: 'print', label: 'Печать' },
  { key: 'outdoor', label: 'Наружная' },
]

const EXAMPLE =
  'Наш банк — лучший на рынке! Гарантированный доход по вкладам и самые ' +
  'выгодные кредиты. Оставьте заявку прямо сейчас!'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export function InputPanel({
  loading,
  onDraftChange,
  onAnalyzeText,
  onAnalyzeUrl,
  onAnalyzeImage,
}: Props) {
  const [tab, setTab] = useState<InputType>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [channel, setChannel] = useState<Channel>('internet')
  const fileRef = useRef<HTMLInputElement>(null)

  function changeTab(nextTab: InputType) {
    if (nextTab === tab) return
    setTab(nextTab)
    onDraftChange()
  }

  function selectFile(nextFile?: File) {
    onDraftChange()
    setFileError('')

    if (!nextFile) {
      setFile(null)
      return
    }
    if (!ALLOWED_IMAGE_TYPES.has(nextFile.type)) {
      setFile(null)
      setFileError('Поддерживаются только PNG, JPG, WEBP и GIF.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      setFile(null)
      setFileError('Файл больше 10 МБ. Уменьшите изображение и попробуйте снова.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFile(nextFile)
  }

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
        {TABS.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={`tab ${tab === item.key ? 'tab--active' : ''}`}
            onClick={() => changeTab(item.key)}
            disabled={loading}
          >
            <span>0{index + 1}</span>{item.label}
          </button>
        ))}
      </div>

      <div className="channel-row">
        <label htmlFor="channel">Канал распространения:</label>
        <select
          id="channel"
          value={channel}
          onChange={(event) => {
            setChannel(event.target.value as Channel)
            onDraftChange()
          }}
          disabled={loading}
        >
          {CHANNELS.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
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
            onChange={(event) => {
              setText(event.target.value)
              onDraftChange()
            }}
            rows={8}
            maxLength={20_000}
            disabled={loading}
          />
          <div className="field-meta">{text.length.toLocaleString('ru-RU')} / 20 000</div>
          <div className="panel__actions">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setText(EXAMPLE)
                onDraftChange()
              }}
              disabled={loading}
            >
              Подставить пример
            </button>
            <button
              type="button"
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
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="example.ru/landing"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              onDraftChange()
            }}
            disabled={loading}
          />
          <div className="panel__actions">
            <span className="hint">Можно вставить адрес с https:// или без него</span>
            <button
              type="button"
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
          <div
            className="filedrop"
            role="button"
            tabIndex={loading ? -1 : 0}
            aria-disabled={loading}
            onClick={() => !loading && fileRef.current?.click()}
            onKeyDown={(event) => {
              if (!loading && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                fileRef.current?.click()
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (!loading) selectFile(event.dataTransfer.files?.[0])
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => selectFile(event.target.files?.[0])}
              disabled={loading}
            />
            {file ? (
              <><b>Файл выбран</b><span>{file.name}</span></>
            ) : (
              <><b>Перетащите или выберите креатив</b><span>PNG, JPG, WEBP или GIF · до 10 МБ</span></>
            )}
          </div>
          {fileError && <div className="field-error" role="alert">{fileError}</div>}
          <div className="panel__actions">
            <span className="hint">Текст распознаётся через OCR / vision-модель</span>
            <button
              type="button"
              className="btn"
              onClick={() => file && onAnalyzeImage(file, channel)}
              disabled={loading || !file}
            >
              {loading ? 'Проверяю…' : 'Проверить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
