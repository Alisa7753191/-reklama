import { useRef, useState } from 'react'
import type { Channel } from '../api'
import {
  CAMPAIGN_ROLE_LABEL,
  type BatchMaterial,
  type BatchProgress,
  type CampaignRole,
} from '../batchAnalysis'
import { CHANNEL_LABEL } from '../labels'

interface Props {
  loading: boolean
  channel: Channel
  progress: BatchProgress | null
  onDraftChange: () => void
  onAnalyzeBatch: (materials: BatchMaterial[]) => void
}

type InputTab = 'text' | 'url' | 'image' | 'file'

const TABS: { key: InputTab; label: string }[] = [
  { key: 'text', label: 'Текст' },
  { key: 'url', label: 'Ссылка' },
  { key: 'image', label: 'Изображения' },
  { key: 'file', label: 'Файлы и медиа' },
]

const EXAMPLE = 'Наш банк — лучший на рынке! Гарантированный доход по вкладам и самые выгодные кредиты. Оставьте заявку прямо сейчас!'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_BATCH_ITEMS = 20
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx', 'pptx', 'txt', 'md', 'rtf', 'srt', 'vtt'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi'])

function createMaterialId() {
  return `material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extensionOf(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`
}

function materialPreview(material: BatchMaterial) {
  if (material.type === 'text') return material.text
  if (material.type === 'url') return material.url
  const suffix = `${extensionOf(material.file).toUpperCase()} · ${formatFileSize(material.file.size)}`
  if (material.type === 'audio' || material.type === 'video') {
    return `${suffix} · ${material.transcript.trim() ? 'расшифровка добавлена' : 'нужна расшифровка'}`
  }
  return suffix
}

function typeLabel(material: BatchMaterial) {
  if (material.type === 'text') return 'ТЕКСТ'
  if (material.type === 'url') return 'URL'
  if (material.type === 'image') return 'ФАЙЛ'
  if (material.type === 'document') return 'ДОК'
  if (material.type === 'audio') return 'АУДИО'
  return 'ВИДЕО'
}

export function InputPanel({ loading, channel, progress, onDraftChange, onAnalyzeBatch }: Props) {
  const [tab, setTab] = useState<InputTab>('text')
  const [role, setRole] = useState<CampaignRole>('creative')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [materials, setMaterials] = useState<BatchMaterial[]>([])
  const [fileError, setFileError] = useState('')
  const imageRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const remainingSlots = MAX_BATCH_ITEMS - materials.length
  const missingTranscripts = materials.filter((item) => (
    (item.type === 'audio' || item.type === 'video') && !item.transcript.trim()
  )).length

  function changed() {
    setFileError('')
    onDraftChange()
  }

  function addText() {
    const value = text.trim()
    if (!value || remainingSlots <= 0) return
    const number = materials.filter((item) => item.type === 'text').length + 1
    setMaterials((current) => [...current, { id: createMaterialId(), type: 'text', role, label: `${CAMPAIGN_ROLE_LABEL[role]} · текст ${number}`, text: value }])
    setText('')
    changed()
  }

  function addUrl() {
    const value = url.trim()
    if (!value || remainingSlots <= 0) return
    const number = materials.filter((item) => item.type === 'url').length + 1
    setMaterials((current) => [...current, { id: createMaterialId(), type: 'url', role: role === 'creative' ? 'landing' : role, label: `Ссылка ${number}: ${value}`, url: value }])
    setUrl('')
    changed()
  }

  function addImages(fileList?: FileList | File[]) {
    changed()
    if (!fileList?.length) return
    const accepted: File[] = []
    const errors: string[] = []
    for (const file of Array.from(fileList)) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) errors.push(`${file.name}: неподдерживаемый формат`)
      else if (file.size > MAX_IMAGE_BYTES) errors.push(`${file.name}: больше 10 МБ`)
      else if (accepted.length >= remainingSlots) { errors.push(`Лимит — ${MAX_BATCH_ITEMS} материалов`); break }
      else accepted.push(file)
    }
    setMaterials((current) => [...current, ...accepted.map((file) => ({ id: createMaterialId(), type: 'image' as const, role, label: file.name, file }))])
    if (errors.length) setFileError(Array.from(new Set(errors)).join('. '))
    if (imageRef.current) imageRef.current.value = ''
  }

  function addDocumentsAndMedia(fileList?: FileList | File[]) {
    changed()
    if (!fileList?.length) return
    const additions: BatchMaterial[] = []
    const errors: string[] = []
    for (const file of Array.from(fileList)) {
      const extension = extensionOf(file)
      if (file.size > MAX_FILE_BYTES) errors.push(`${file.name}: больше 25 МБ`)
      else if (additions.length >= remainingSlots) { errors.push(`Лимит — ${MAX_BATCH_ITEMS} материалов`); break }
      else if (DOCUMENT_EXTENSIONS.has(extension)) additions.push({ id: createMaterialId(), type: 'document', role, label: file.name, file })
      else if (AUDIO_EXTENSIONS.has(extension)) additions.push({ id: createMaterialId(), type: 'audio', role: role === 'creative' ? 'script' : role, label: file.name, file, transcript: '' })
      else if (VIDEO_EXTENSIONS.has(extension)) additions.push({ id: createMaterialId(), type: 'video', role: role === 'creative' ? 'script' : role, label: file.name, file, transcript: '' })
      else errors.push(`${file.name}: неподдерживаемый формат`)
    }
    setMaterials((current) => [...current, ...additions])
    if (errors.length) setFileError(Array.from(new Set(errors)).join('. '))
    if (fileRef.current) fileRef.current.value = ''
  }

  function updateRole(id: string, nextRole: CampaignRole) {
    setMaterials((current) => current.map((item) => item.id === id ? { ...item, role: nextRole } : item) as BatchMaterial[])
    changed()
  }

  function updateTranscript(id: string, transcript: string) {
    setMaterials((current) => current.map((item) => (
      item.id === id && (item.type === 'audio' || item.type === 'video') ? { ...item, transcript } : item
    )))
    changed()
  }

  function removeMaterial(id: string) {
    setMaterials((current) => current.filter((item) => item.id !== id))
    changed()
  }

  function clearMaterials() {
    setMaterials([])
    changed()
  }

  return (
    <div className="panel batch-panel">
      <div className="panel__header">
        <div><span className="panel__eyebrow">КАМПАНИЯ ЦЕЛИКОМ</span><h2>Соберите связанные материалы</h2></div>
        <span className="panel__status"><i /> {materials.length ? `${materials.length} в пакете` : 'Готово к загрузке'}</span>
      </div>

      <div className="tabs tabs--four">
        {TABS.map((item, index) => <button key={item.key} type="button" className={`tab ${tab === item.key ? 'tab--active' : ''}`} onClick={() => { setTab(item.key); changed() }} disabled={loading}><span>0{index + 1}</span>{item.label}</button>)}
      </div>

      <div className="batch-setup-row">
        <div><span>КАНАЛ</span><b>{CHANNEL_LABEL[channel] ?? channel}</b></div>
        <label>Роль новых материалов<select value={role} onChange={(event) => { setRole(event.target.value as CampaignRole); changed() }} disabled={loading}>{Object.entries(CAMPAIGN_ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p>Креативы, лендинг и правила будут проверены отдельно и собраны в единое заключение.</p>
      </div>

      {tab === 'text' && <div className="tab-body">
        <textarea className="textarea" placeholder="Вставьте рекламный текст, правила акции или сценарий ролика…" value={text} onChange={(event) => { setText(event.target.value); changed() }} rows={8} maxLength={20_000} disabled={loading} />
        <div className="field-meta">{text.length.toLocaleString('ru-RU')} / 20 000</div>
        <div className="panel__actions"><button type="button" className="link-btn" onClick={() => { setText(EXAMPLE); changed() }} disabled={loading}>Подставить пример</button><button type="button" className="btn" onClick={addText} disabled={loading || !text.trim() || remainingSlots <= 0}>+ Добавить текст</button></div>
      </div>}

      {tab === 'url' && <div className="tab-body">
        <input className="input" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="example.ru/landing" value={url} onChange={(event) => { setUrl(event.target.value); changed() }} disabled={loading} />
        <div className="panel__actions"><span className="hint">Можно добавить лендинг, страницу акции и опубликованные материалы</span><button type="button" className="btn" onClick={addUrl} disabled={loading || !url.trim() || remainingSlots <= 0}>+ Добавить ссылку</button></div>
      </div>}

      {tab === 'image' && <div className="tab-body">
        <div className="filedrop" role="button" tabIndex={loading || remainingSlots <= 0 ? -1 : 0} aria-disabled={loading || remainingSlots <= 0} onClick={() => !loading && imageRef.current?.click()} onKeyDown={(event) => { if (!loading && (event.key === 'Enter' || event.key === ' ')) imageRef.current?.click() }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!loading) addImages(event.dataTransfer.files) }}>
          <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(event) => addImages(event.target.files ?? undefined)} disabled={loading} />
          <b>Выберите несколько баннеров и креативов</b><span>PNG, JPG, WEBP или GIF · каждый файл до 10 МБ</span>
        </div>
        {fileError && <div className="field-error" role="alert">{fileError}</div>}
      </div>}

      {tab === 'file' && <div className="tab-body">
        <div className="filedrop filedrop--media" role="button" tabIndex={loading || remainingSlots <= 0 ? -1 : 0} aria-disabled={loading || remainingSlots <= 0} onClick={() => !loading && fileRef.current?.click()} onKeyDown={(event) => { if (!loading && (event.key === 'Enter' || event.key === ' ')) fileRef.current?.click() }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!loading) addDocumentsAndMedia(event.dataTransfer.files) }}>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.pptx,.txt,.md,.rtf,.srt,.vtt,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,.mkv,.avi" multiple hidden onChange={(event) => addDocumentsAndMedia(event.target.files ?? undefined)} disabled={loading} />
          <b>Документы, презентации, аудио и видео</b><span>PDF, Word, PowerPoint, TXT, субтитры и медиа · до 25 МБ</span>
        </div>
        <p className="media-note">Для аудио и видео после добавления укажите сценарий или расшифровку речи. Система не будет угадывать содержание файла.</p>
        {fileError && <div className="field-error" role="alert">{fileError}</div>}
      </div>}

      <section className="batch-queue" aria-live="polite">
        <div className="batch-queue__head"><div><span>МАТЕРИАЛЫ ДЛЯ ПРОВЕРКИ</span><h3>{materials.length ? `Добавлено: ${materials.length} из ${MAX_BATCH_ITEMS}` : 'Пакет пока пуст'}</h3></div>{materials.length > 0 && <button type="button" className="text-action" onClick={clearMaterials} disabled={loading}>Очистить</button>}</div>
        {materials.length === 0 ? <div className="batch-empty">Добавьте хотя бы один материал. Форматы можно смешивать.</div> : <div className="batch-list">{materials.map((material, index) => <article className={`batch-item ${material.type === 'audio' || material.type === 'video' ? 'batch-item--media' : ''}`} key={material.id}>
          <span className={`batch-item__type batch-item__type--${material.type}`}>{typeLabel(material)}</span>
          <div className="batch-item__body"><b>{index + 1}. {material.label}</b><p>{materialPreview(material)}</p><select aria-label={`Роль материала ${material.label}`} value={material.role} onChange={(event) => updateRole(material.id, event.target.value as CampaignRole)} disabled={loading}>{Object.entries(CAMPAIGN_ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{(material.type === 'audio' || material.type === 'video') && <textarea className="batch-transcript" value={material.transcript} onChange={(event) => updateTranscript(material.id, event.target.value)} placeholder="Вставьте сценарий, реплики диктора, титры и обязательные предупреждения…" maxLength={20_000} disabled={loading} />}</div>
          <button type="button" className="batch-item__remove" onClick={() => removeMaterial(material.id)} disabled={loading} aria-label={`Удалить ${material.label}`}>×</button>
        </article>)}</div>}

        {missingTranscripts > 0 && <div className="batch-warning">Добавьте расшифровку для {missingTranscripts} медиафайл(ов), чтобы включить их в юридическую проверку.</div>}
        <div className="batch-submit"><div><b>{loading && progress ? `Проверяю ${progress.current} из ${progress.total}` : 'Единое заключение по всей кампании'}</b><span>{loading && progress ? progress.label : 'Каждый риск будет привязан к исходному материалу и его роли'}</span></div><button type="button" className="btn btn--primary" onClick={() => onAnalyzeBatch(materials)} disabled={loading || materials.length === 0 || missingTranscripts > 0}>{loading ? 'Идёт проверка…' : `Проверить кампанию · ${materials.length}`}</button></div>
      </section>
    </div>
  )
}
