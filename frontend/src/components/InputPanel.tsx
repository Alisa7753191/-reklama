import { useRef, useState } from 'react'
import type { Channel } from '../api'
import type { BatchMaterial, BatchProgress } from '../batchAnalysis'
import { CHANNEL_LABEL } from '../labels'
import type { InputType } from '../types'

interface Props {
  loading: boolean
  channel: Channel
  progress: BatchProgress | null
  onDraftChange: () => void
  onAnalyzeBatch: (materials: BatchMaterial[]) => void
}

const TABS: { key: InputType; label: string }[] = [
  { key: 'text', label: 'Текст' },
  { key: 'url', label: 'Ссылка / лендинг' },
  { key: 'image', label: 'Изображения' },
]

const EXAMPLE =
  'Наш банк — лучший на рынке! Гарантированный доход по вкладам и самые ' +
  'выгодные кредиты. Оставьте заявку прямо сейчас!'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_BATCH_ITEMS = 20
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

function createMaterialId() {
  return `material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`
}

function materialPreview(material: BatchMaterial) {
  if (material.type === 'text') return material.text
  if (material.type === 'url') return material.url
  return `${material.file.type.replace('image/', '').toUpperCase()} · ${formatFileSize(material.file.size)}`
}

export function InputPanel({
  loading,
  channel,
  progress,
  onDraftChange,
  onAnalyzeBatch,
}: Props) {
  const [tab, setTab] = useState<InputType>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [materials, setMaterials] = useState<BatchMaterial[]>([])
  const [fileError, setFileError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const remainingSlots = MAX_BATCH_ITEMS - materials.length

  function changeTab(nextTab: InputType) {
    if (nextTab === tab) return
    setTab(nextTab)
    onDraftChange()
  }

  function addText() {
    const value = text.trim()
    if (!value || remainingSlots <= 0) return
    const number = materials.filter((item) => item.type === 'text').length + 1
    setMaterials((current) => [...current, {
      id: createMaterialId(),
      type: 'text',
      label: `Текстовый материал ${number}`,
      text: value,
    }])
    setText('')
    onDraftChange()
  }

  function addUrl() {
    const value = url.trim()
    if (!value || remainingSlots <= 0) return
    const number = materials.filter((item) => item.type === 'url').length + 1
    setMaterials((current) => [...current, {
      id: createMaterialId(),
      type: 'url',
      label: `Ссылка ${number}: ${value}`,
      url: value,
    }])
    setUrl('')
    onDraftChange()
  }

  function addFiles(fileList?: FileList | File[]) {
    onDraftChange()
    setFileError('')
    if (!fileList || fileList.length === 0) return

    const selected = Array.from(fileList)
    const accepted: File[] = []
    const errors: string[] = []

    for (const candidate of selected) {
      if (!ALLOWED_IMAGE_TYPES.has(candidate.type)) {
        errors.push(`${candidate.name}: неподдерживаемый формат`)
      } else if (candidate.size > MAX_IMAGE_BYTES) {
        errors.push(`${candidate.name}: файл больше 10 МБ`)
      } else if (accepted.length >= remainingSlots) {
        errors.push(`В одну проверку можно добавить не более ${MAX_BATCH_ITEMS} материалов`)
        break
      } else {
        accepted.push(candidate)
      }
    }

    if (accepted.length > 0) {
      setMaterials((current) => [
        ...current,
        ...accepted.map((file) => ({
          id: createMaterialId(),
          type: 'image' as const,
          label: file.name,
          file,
        })),
      ])
    }
    if (errors.length > 0) setFileError(Array.from(new Set(errors)).join('. '))
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeMaterial(id: string) {
    setMaterials((current) => current.filter((item) => item.id !== id))
    onDraftChange()
  }

  function clearMaterials() {
    setMaterials([])
    setFileError('')
    onDraftChange()
  }

  return (
    <div className="panel batch-panel">
      <div className="panel__header">
        <div>
          <span className="panel__eyebrow">ПАКЕТ МАТЕРИАЛОВ</span>
          <h2>Соберите всё для одной проверки</h2>
        </div>
        <span className="panel__status"><i /> {materials.length > 0 ? `${materials.length} в пакете` : 'Готово к загрузке'}</span>
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

      <div className="channel-row batch-channel-row">
        <label>Канал пакета:</label>
        <strong>{CHANNEL_LABEL[channel] ?? channel}</strong>
        <span className="channel-hint">Каждый материал проверяется отдельно, выводы объединяются в одно заключение</span>
      </div>

      {tab === 'text' && (
        <div className="tab-body">
          <textarea
            className="textarea"
            placeholder="Вставьте первый рекламный текст, объявление, пост или слоган…"
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
              onClick={addText}
              disabled={loading || !text.trim() || remainingSlots <= 0}
            >
              + Добавить текст в пакет
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
            <span className="hint">Можно добавить несколько разных лендингов</span>
            <button
              type="button"
              className="btn"
              onClick={addUrl}
              disabled={loading || !url.trim() || remainingSlots <= 0}
            >
              + Добавить ссылку в пакет
            </button>
          </div>
        </div>
      )}

      {tab === 'image' && (
        <div className="tab-body">
          <div
            className="filedrop"
            role="button"
            tabIndex={loading || remainingSlots <= 0 ? -1 : 0}
            aria-disabled={loading || remainingSlots <= 0}
            onClick={() => !loading && remainingSlots > 0 && fileRef.current?.click()}
            onKeyDown={(event) => {
              if (!loading && remainingSlots > 0 && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                fileRef.current?.click()
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (!loading && remainingSlots > 0) addFiles(event.dataTransfer.files)
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              hidden
              onChange={(event) => addFiles(event.target.files ?? undefined)}
              disabled={loading || remainingSlots <= 0}
            />
            <b>Перетащите или выберите несколько креативов</b>
            <span>PNG, JPG, WEBP или GIF · каждый файл до 10 МБ</span>
          </div>
          {fileError && <div className="field-error" role="alert">{fileError}</div>}
          <div className="panel__actions">
            <span className="hint">Все выбранные изображения сразу добавятся в пакет</span>
            <span className="batch-slots">Свободно мест: {remainingSlots}</span>
          </div>
        </div>
      )}

      <section className="batch-queue" aria-live="polite">
        <div className="batch-queue__head">
          <div><span>МАТЕРИАЛЫ ДЛЯ ПРОВЕРКИ</span><h3>{materials.length > 0 ? `${materials.length} из ${MAX_BATCH_ITEMS} добавлено` : 'Пакет пока пуст'}</h3></div>
          {materials.length > 0 && <button type="button" className="text-action" onClick={clearMaterials} disabled={loading}>Очистить</button>}
        </div>

        {materials.length === 0 ? (
          <div className="batch-empty">Выберите формат выше и добавьте один или несколько материалов.</div>
        ) : (
          <div className="batch-list">
            {materials.map((material, index) => (
              <article className="batch-item" key={material.id}>
                <span className={`batch-item__type batch-item__type--${material.type}`}>
                  {material.type === 'text' ? 'ТЕКСТ' : material.type === 'url' ? 'URL' : 'ФАЙЛ'}
                </span>
                <div className="batch-item__body">
                  <b>{index + 1}. {material.label}</b>
                  <p>{materialPreview(material)}</p>
                </div>
                <button type="button" className="batch-item__remove" onClick={() => removeMaterial(material.id)} disabled={loading} aria-label={`Удалить ${material.label}`}>×</button>
              </article>
            ))}
          </div>
        )}

        <div className="batch-submit">
          <div>
            <b>{loading && progress ? `Проверяю ${progress.current} из ${progress.total}` : 'Единое заключение по всему пакету'}</b>
            <span>{loading && progress ? progress.label : 'Риски будут отмечены номером исходного материала'}</span>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onAnalyzeBatch(materials)}
            disabled={loading || materials.length === 0}
          >
            {loading ? 'Идёт проверка…' : `Проверить пакет · ${materials.length}`}
          </button>
        </div>
      </section>
    </div>
  )
}
