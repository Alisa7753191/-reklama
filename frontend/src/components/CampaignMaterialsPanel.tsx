import { useEffect, useMemo, useState } from 'react'
import { CAMPAIGN_ROLE_LABEL } from '../batchAnalysis'
import { getReviewMaterial } from '../reviewMaterialStorage'
import type { CommentRegion, ReviewComment, ReviewMaterial } from '../workspace'

interface Props {
  materials: ReviewMaterial[]
  comments: ReviewComment[]
  selectedRegion?: CommentRegion
  onSelectRegion: (region?: CommentRegion) => void
}

export function CampaignMaterialsPanel({ materials, comments, selectedRegion, onSelectRegion }: Props) {
  const [activeId, setActiveId] = useState(materials[0]?.id ?? '')
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({})
  const active = materials.find((item) => item.id === activeId) ?? materials[0]

  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    Promise.all(materials.filter((item) => item.storageId).map(async (item) => {
      const record = await getReviewMaterial(item.storageId as string)
      if (!record || cancelled) return
      const url = URL.createObjectURL(record.blob)
      created.push(url)
      setObjectUrls((current) => ({ ...current, [item.id]: url }))
    })).catch(() => undefined)
    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [materials])

  const regions = useMemo(() => comments.filter((item) => item.region?.materialId === active?.id), [comments, active?.id])
  if (materials.length === 0) return null

  function selectImageRegion(event: React.MouseEvent<HTMLDivElement>) {
    if (!active || active.type !== 'image') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const width = 18
    const height = 18
    const x = Math.max(0, Math.min(100 - width, ((event.clientX - bounds.left) / bounds.width) * 100 - width / 2))
    const y = Math.max(0, Math.min(100 - height, ((event.clientY - bounds.top) / bounds.height) * 100 - height / 2))
    onSelectRegion({ materialId: active.id, materialLabel: active.label, x, y, width, height })
  }

  return <section className="campaign-materials workspace-card">
    <header><div><p className="eyebrow">ИСХОДНИКИ КАМПАНИИ</p><h2>Материалы и визуальные комментарии</h2></div><span>{materials.length}</span></header>
    <div className="campaign-material-tabs">{materials.map((item, index) => <button key={item.id} type="button" className={item.id === active?.id ? 'active' : ''} onClick={() => { setActiveId(item.id); onSelectRegion(undefined) }}><b>{index + 1}</b><span>{item.label}</span><small>{CAMPAIGN_ROLE_LABEL[item.role]}</small></button>)}</div>
    {active && <div className="campaign-preview">
      <div className="campaign-preview__meta"><span>{CAMPAIGN_ROLE_LABEL[active.role]}</span><b>{active.label}</b></div>
      {active.type === 'image' && objectUrls[active.id] && <div className="annotatable-image" onClick={selectImageRegion} role="button" tabIndex={0} aria-label="Выберите область изображения для комментария">
        <img src={objectUrls[active.id]} alt={active.label} />
        {regions.map((comment, index) => comment.region && <span key={comment.id} className="image-region image-region--saved" style={{ left: `${comment.region.x}%`, top: `${comment.region.y}%`, width: `${comment.region.width}%`, height: `${comment.region.height}%` }} title={comment.text}>{index + 1}</span>)}
        {selectedRegion?.materialId === active.id && <span className="image-region image-region--selected" style={{ left: `${selectedRegion.x}%`, top: `${selectedRegion.y}%`, width: `${selectedRegion.width}%`, height: `${selectedRegion.height}%` }}>+</span>}
      </div>}
      {active.type === 'image' && !objectUrls[active.id] && <div className="campaign-file-placeholder">Изображение сохранено только в браузере, где создавалась проверка.</div>}
      {active.type === 'audio' && objectUrls[active.id] && <audio controls src={objectUrls[active.id]} />}
      {active.type === 'video' && objectUrls[active.id] && <video controls src={objectUrls[active.id]} />}
      {active.type === 'document' && <div className="campaign-file-placeholder"><b>{active.label}</b><span>Текст документа включён в общий отчёт.</span>{objectUrls[active.id] && <a href={objectUrls[active.id]} download={active.label}>Скачать исходник</a>}</div>}
      {active.type === 'text' && <pre className="campaign-text-preview">{active.text}</pre>}
      {active.type === 'url' && <div className="campaign-file-placeholder"><a href={active.url} target="_blank" rel="noreferrer">Открыть проверенную страницу ↗</a></div>}
      {active.type === 'image' && <p className="annotation-hint">Нажмите на область изображения, затем добавьте комментарий в правой колонке.</p>}
    </div>}
  </section>
}
