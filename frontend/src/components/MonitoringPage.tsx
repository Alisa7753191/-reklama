import { useMemo, useState } from 'react'
import { analyzeUrl } from '../api'
import { RISK_LABEL } from '../labels'
import { createId, formatDate, type PublicationMonitor, type WorkspaceData } from '../workspace'

function nextCheckDate(frequency: PublicationMonitor['frequency'], from = new Date()) {
  const date = new Date(from)
  date.setDate(date.getDate() + (frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30))
  return date.toISOString()
}

export function MonitoringPage({ data, onChange }: { data: WorkspaceData; onChange: (data: WorkspaceData) => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? '')
  const [frequency, setFrequency] = useState<PublicationMonitor['frequency']>('weekly')
  const [checking, setChecking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const knowledgeUpdate = useMemo(() => data.knowledge.map((item) => item.updatedAt).sort().at(-1) ?? '', [data.knowledge])
  const dueCount = data.monitors.filter((item) => item.active && (!item.nextCheck || new Date(item.nextCheck) <= new Date() || item.lastKnowledgeUpdate !== knowledgeUpdate)).length

  function addMonitor(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !url.trim()) return
    const monitor: PublicationMonitor = { id: createId('monitor'), name: name.trim(), url: url.trim(), clientId, frequency, active: true, lastChecked: '', nextCheck: new Date().toISOString(), lastKnowledgeUpdate: '' }
    onChange({ ...data, monitors: [monitor, ...data.monitors] })
    setName(''); setUrl(''); setError('')
  }

  async function runCheck(monitor: PublicationMonitor) {
    try {
      const client = data.clients.find((item) => item.id === monitor.clientId)
      const report = await analyzeUrl(monitor.url, 'internet', { company_description: client?.name ?? '', product_description: `Опубликованный материал: ${monitor.name}` })
      const now = new Date()
      return { ...monitor, lastChecked: now.toISOString(), nextCheck: nextCheckDate(monitor.frequency, now), lastRisk: report.overall_risk, findingsCount: report.findings.length, lastKnowledgeUpdate: knowledgeUpdate, lastError: '' } satisfies PublicationMonitor
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось проверить страницу.'
      setError(message)
      return { ...monitor, lastError: message } satisfies PublicationMonitor
    }
  }

  async function checkMonitor(monitor: PublicationMonitor) {
    setChecking(monitor.id); setError('')
    try {
      const updated = await runCheck(monitor)
      onChange({ ...data, monitors: data.monitors.map((item) => item.id === monitor.id ? updated : item) })
    } finally { setChecking(null) }
  }

  async function checkDue() {
    const due = data.monitors.filter((item) => item.active && (!item.nextCheck || new Date(item.nextCheck) <= new Date() || item.lastKnowledgeUpdate !== knowledgeUpdate))
    if (due.length === 0) return
    setError('')
    let updatedMonitors = [...data.monitors]
    try {
      for (const monitor of due) {
        setChecking(monitor.id)
        const updated = await runCheck(monitor)
        updatedMonitors = updatedMonitors.map((item) => item.id === monitor.id ? updated : item)
      }
      onChange({ ...data, monitors: updatedMonitors })
    } finally { setChecking(null) }
  }

  return <>
    <div className="workspace-page-head"><div><p className="eyebrow">POST-PUBLICATION CONTROL</p><h1>Мониторинг рекламы</h1><p>Повторная проверка опубликованных страниц по расписанию и после обновления базы знаний.</p></div><button className="btn btn--primary" onClick={checkDue} disabled={checking !== null || dueCount === 0}>Проверить требующие внимания · {dueCount}</button></div>
    <section className="metrics-grid"><article className="metric-card"><span>Под наблюдением</span><strong>{data.monitors.length}</strong><small>опубликованных страниц</small></article><article className="metric-card metric-card--amber"><span>Требуют проверки</span><strong>{dueCount}</strong><small>срок или новая редакция базы</small></article><article className="metric-card metric-card--red"><span>Высокий риск</span><strong>{data.monitors.filter((item) => ['high', 'critical'].includes(item.lastRisk ?? '')).length}</strong><small>по последнему результату</small></article></section>
    <div className="monitoring-layout">
      <section className="workspace-card monitor-list-card"><div className="section-head"><div><span>РЕЕСТР</span><h2>Опубликованные материалы</h2></div><b>{data.monitors.length}</b></div>
        {data.monitors.length === 0 ? <div className="table-empty">Добавьте первую опубликованную страницу справа.</div> : <div className="monitor-list">{data.monitors.map((item) => {
          const lawChanged = Boolean(item.lastChecked && item.lastKnowledgeUpdate !== knowledgeUpdate)
          const due = !item.nextCheck || new Date(item.nextCheck) <= new Date()
          return <article key={item.id} className={!item.active ? 'disabled' : ''}><div className="monitor-state"><i className={item.active ? 'on' : ''} /><span>{lawChanged ? 'ОБНОВИЛАСЬ БАЗА' : due ? 'ПОРА ПРОВЕРИТЬ' : 'НАБЛЮДЕНИЕ'}</span></div><h3>{item.name}</h3><a href={/^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`} target="_blank" rel="noreferrer">{item.url}</a><div className="monitor-meta"><span>Последняя: {item.lastChecked ? formatDate(item.lastChecked) : 'ещё не проводилась'}</span><span>Следующая: {formatDate(item.nextCheck)}</span>{item.lastRisk && <b>{RISK_LABEL[item.lastRisk]} · {item.findingsCount ?? 0} замечаний</b>}</div>{item.lastError && <p className="monitor-error">{item.lastError}</p>}<footer><button className="btn btn--secondary" onClick={() => checkMonitor(item)} disabled={checking !== null}>{checking === item.id ? 'Проверяю…' : 'Проверить сейчас'}</button><button className="text-action" onClick={() => onChange({ ...data, monitors: data.monitors.map((monitor) => monitor.id === item.id ? { ...monitor, active: !monitor.active } : monitor) })}>{item.active ? 'Приостановить' : 'Возобновить'}</button><button className="text-action danger" onClick={() => onChange({ ...data, monitors: data.monitors.filter((monitor) => monitor.id !== item.id) })}>Удалить</button></footer></article>
        })}</div>}
        {error && <div className="error" role="alert">{error}</div>}
      </section>
      <form className="workspace-card monitor-form" onSubmit={addMonitor}><p className="eyebrow">ДОБАВИТЬ НАБЛЮДЕНИЕ</p><h2>Новая страница</h2><label>Название<input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Лендинг кредита" required /></label><label>URL<input className="input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="example.ru/landing" required /></label><label>Клиент<select value={clientId} onChange={(event) => setClientId(event.target.value)}>{data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Периодичность<select value={frequency} onChange={(event) => setFrequency(event.target.value as PublicationMonitor['frequency'])}><option value="daily">Ежедневно</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option></select></label><button className="btn btn--primary" disabled={!name.trim() || !url.trim()}>Добавить в мониторинг</button><p className="settings-note">В прототипе плановая проверка запускается при открытии рабочего пространства или вручную. Для промышленного контура подключается серверное расписание.</p></form>
    </div>
  </>
}
