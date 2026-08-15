import { useEffect, useMemo, useState } from 'react'
import { analyzeImage, analyzeText, analyzeUrl, getHealth, type Channel } from '../api'
import { CHANNEL_LABEL, RISK_LABEL } from '../labels'
import { exportReviewToWord } from '../reportExport'
import type { AnalysisContext, InputType, Report } from '../types'
import {
  STATUS_LABEL,
  STATUS_TONE,
  createId,
  formatDate,
  loadWorkspace,
  nextReviewNumber,
  saveWorkspace,
  type Client,
  type KnowledgeEntry,
  type ReviewMatter,
  type ReviewStatus,
  type ReviewTemplate,
  type TeamMember,
  type WorkspaceData,
  type WorkspaceSettings,
  type WorkspaceView,
} from '../workspace'
import { InputPanel } from './InputPanel'
import { ReportView } from './ReportView'

const NAV_ITEMS: { id: WorkspaceView; label: string; short: string }[] = [
  { id: 'dashboard', label: 'Обзор', short: 'ОБ' },
  { id: 'reviews', label: 'Проверки', short: 'ПР' },
  { id: 'clients', label: 'Клиенты', short: 'КЛ' },
  { id: 'templates', label: 'Шаблоны', short: 'ШБ' },
  { id: 'knowledge', label: 'База знаний', short: 'БЗ' },
  { id: 'team', label: 'Команда', short: 'КО' },
  { id: 'analytics', label: 'Аналитика', short: 'АН' },
  { id: 'settings', label: 'Настройки', short: 'НС' },
]

const STATUS_ORDER: ReviewStatus[] = ['draft', 'auto_review', 'lawyer_review', 'needs_changes', 'approved']

interface NewReviewDraft {
  clientId: string
  title: string
  company: string
  product: string
  audience: string
  territory: string
  publishDate: string
  channel: Channel
  hasLicense: boolean
  targetsMinors: boolean
  bloggerAd: boolean
  promotion: boolean
  personalData: boolean
}

const emptyDraft = (clients: Client[]): NewReviewDraft => {
  const client = clients[0]
  return {
    clientId: client?.id ?? '',
    title: '',
    company: client ? `${client.name}, сфера: ${client.industry}` : '',
    product: '',
    audience: 'Совершеннолетние потребители',
    territory: 'Российская Федерация',
    publishDate: '',
    channel: 'internet',
    hasLicense: false,
    targetsMinors: false,
    bloggerAd: false,
    promotion: false,
    personalData: false,
  }
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`status-badge status-badge--${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
}

function MetricCard({ label, value, hint, tone = 'green' }: { label: string; value: string | number; hint: string; tone?: string }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  )
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="workspace-page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function ReviewsTable({ reviews, clients, onOpen }: { reviews: ReviewMatter[]; clients: Client[]; onOpen: (id: string) => void }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead><tr><th>Проверка</th><th>Клиент</th><th>Канал</th><th>Статус</th><th>Обновлена</th></tr></thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id} onClick={() => onOpen(review.id)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onOpen(review.id)}>
              <td><b>{review.title}</b><small>{review.number}</small></td>
              <td>{clients.find((client) => client.id === review.clientId)?.name ?? 'Без клиента'}</td>
              <td>{CHANNEL_LABEL[review.context.channel] ?? review.context.channel}</td>
              <td><StatusBadge status={review.status} /></td>
              <td>{formatDate(review.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reviews.length === 0 && <div className="table-empty">Проверок по выбранным условиям нет.</div>}
    </div>
  )
}

function Dashboard({ data, onNew, onOpenReview, onNavigate }: { data: WorkspaceData; onNew: () => void; onOpenReview: (id: string) => void; onNavigate: (view: WorkspaceView) => void }) {
  const needsAttention = data.reviews.filter((review) => ['lawyer_review', 'needs_changes'].includes(review.status)).length
  const approved = data.reviews.filter((review) => review.status === 'approved').length
  const findings = data.reviews.reduce((total, review) => total + (review.report?.findings.length ?? 0), 0)
  return (
    <>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">B2B LEGAL WORKSPACE</p>
          <h1>Юридический контроль<br /><span>рекламы — в одном окне.</span></h1>
          <p>От первичной проверки до согласованного заключения юриста с полной историей работы.</p>
          <div className="dashboard-hero__actions">
            <button className="btn btn--primary" onClick={onNew}>+ Новая проверка</button>
            <button className="btn btn--secondary" onClick={() => onNavigate('templates')}>Открыть шаблоны</button>
          </div>
        </div>
        <div className="workflow-orbit" aria-label="Этапы юридической проверки">
          <div><b>01</b><span>Материал</span></div>
          <div><b>02</b><span>Автоанализ</span></div>
          <div><b>03</b><span>Юрист</span></div>
          <div><b>04</b><span>Заключение</span></div>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Всего проверок" value={data.reviews.length} hint="в рабочем пространстве" />
        <MetricCard label="Требуют внимания" value={needsAttention} hint="юрист или исправления" tone="amber" />
        <MetricCard label="Согласовано" value={approved} hint="готово к публикации" tone="blue" />
        <MetricCard label="Найдено рисков" value={findings} hint="в сохранённых отчётах" tone="red" />
      </section>

      <section className="workspace-section">
        <div className="section-head"><div><span>ПОСЛЕДНИЕ ДЕЛА</span><h2>Активные проверки</h2></div><button className="text-action" onClick={() => onNavigate('reviews')}>Все проверки →</button></div>
        <ReviewsTable reviews={data.reviews.slice(0, 5)} clients={data.clients} onOpen={onOpenReview} />
      </section>

      <section className="dashboard-panels">
        <article className="workspace-card">
          <div className="section-head"><div><span>БАЗА ЗНАНИЙ</span><h2>Актуальность источников</h2></div><span className="live-dot">обновлено</span></div>
          <div className="source-list">
            {data.knowledge.slice(0, 4).map((entry) => <div key={entry.id}><span>{entry.article}</span><p>{entry.title}</p><small>{entry.updatedAt}</small></div>)}
          </div>
        </article>
        <article className="workspace-card security-card">
          <span className="security-card__icon">◎</span>
          <p className="eyebrow">КОНТРОЛЬ ДАННЫХ</p>
          <h2>Материалы под контролем команды</h2>
          <p>Роли, журнал согласований, управляемый срок хранения и отдельный отчёт для клиента.</p>
          <button className="text-action" onClick={() => onNavigate('settings')}>Настройки безопасности →</button>
        </article>
      </section>
    </>
  )
}

function ReviewsPage({ data, onNew, onOpen }: { data: WorkspaceData; onNew: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | ReviewStatus>('all')
  const reviews = useMemo(() => data.reviews.filter((review) => {
    const client = data.clients.find((item) => item.id === review.clientId)
    const haystack = `${review.number} ${review.title} ${client?.name ?? ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase()) && (status === 'all' || review.status === status)
  }), [data.clients, data.reviews, query, status])

  return (
    <>
      <PageHeader eyebrow="РЕЕСТР МАТЕРИАЛОВ" title="Проверки" description="История рекламных материалов, статусов и юридических решений." action={<button className="btn btn--primary" onClick={onNew}>+ Новая проверка</button>} />
      <div className="filters-row">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по номеру, материалу или клиенту" />
        <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | ReviewStatus)}>
          <option value="all">Все статусы</option>
          {STATUS_ORDER.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </select>
      </div>
      <ReviewsTable reviews={reviews} clients={data.clients} onOpen={onOpen} />
    </>
  )
}

function ClientsPage({ data, onChange }: { data: WorkspaceData; onChange: (data: WorkspaceData) => void }) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [contact, setContact] = useState('')

  function addClient(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const client: Client = { id: createId('client'), name: name.trim(), industry: industry.trim() || 'Не указана', contact: contact.trim(), createdAt: new Date().toISOString() }
    onChange({ ...data, clients: [client, ...data.clients] })
    setName(''); setIndustry(''); setContact(''); setFormOpen(false)
  }

  return (
    <>
      <PageHeader eyebrow="КЛИЕНТСКИЙ ПОРТФЕЛЬ" title="Клиенты" description="Организации и рекламные проекты, разделённые внутри рабочего пространства." action={<button className="btn btn--primary" onClick={() => setFormOpen((value) => !value)}>+ Добавить клиента</button>} />
      {formOpen && (
        <form className="inline-create-form" onSubmit={addClient}>
          <label>Название<input className="input" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Сфера<input className="input" value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Медицина, финансы…" /></label>
          <label>Контакт<input className="input" type="email" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="legal@company.ru" /></label>
          <button className="btn btn--primary">Сохранить</button>
        </form>
      )}
      <div className="client-grid">
        {data.clients.map((client) => {
          const reviews = data.reviews.filter((review) => review.clientId === client.id)
          return <article className="client-card" key={client.id}><div className="client-card__mark">{client.name.slice(0, 2).toUpperCase()}</div><div><span>{client.industry}</span><h2>{client.name}</h2><p>{client.contact || 'Контакт не указан'}</p></div><footer><span>{reviews.length} проверок</span><span>{reviews.filter((review) => review.status === 'approved').length} согласовано</span></footer></article>
        })}
      </div>
    </>
  )
}

function TemplatesPage({ data, onChange, onUse }: { data: WorkspaceData; onChange: (data: WorkspaceData) => void; onUse: (template: ReviewTemplate) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function addTemplate(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const template: ReviewTemplate = { id: createId('template'), name: name.trim(), description: description.trim() || 'Пользовательский сценарий проверки', industry: 'Пользовательский', channel: 'internet', prompt: description.trim() }
    onChange({ ...data, templates: [...data.templates, template] })
    setName(''); setDescription('')
  }

  return (
    <>
      <PageHeader eyebrow="СТАНДАРТЫ ПРАКТИКИ" title="Шаблоны проверок" description="Готовые сценарии для повторяющихся юридических задач." />
      <div className="template-grid">
        {data.templates.map((template, index) => <article className="template-card" key={template.id}><span className="template-card__number">0{index + 1}</span><span>{template.industry}</span><h2>{template.name}</h2><p>{template.description}</p><button className="btn btn--secondary" onClick={() => onUse(template)}>Начать проверку →</button></article>)}
      </div>
      <form className="workspace-card compact-form" onSubmit={addTemplate}>
        <div><p className="eyebrow">СОБСТВЕННЫЙ PLAYBOOK</p><h2>Добавить сценарий компании</h2></div>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Название шаблона" />
        <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что должен проверять юрист" />
        <button className="btn btn--primary">Добавить</button>
      </form>
    </>
  )
}

function KnowledgePage({ data, onChange }: { data: WorkspaceData; onChange: (data: WorkspaceData) => void }) {
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [article, setArticle] = useState('')
  const entries = data.knowledge.filter((entry) => `${entry.title} ${entry.source} ${entry.article}`.toLowerCase().includes(query.toLowerCase()))

  function addEntry(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !source.trim()) return
    const entry: KnowledgeEntry = { id: createId('kb'), title: title.trim(), source: source.trim(), article: article.trim(), category: 'Материал компании', updatedAt: new Date().toISOString().slice(0, 10), enabled: true }
    onChange({ ...data, knowledge: [entry, ...data.knowledge] })
    setTitle(''); setSource(''); setArticle(''); setShowForm(false)
  }

  function toggleEntry(id: string) {
    onChange({ ...data, knowledge: data.knowledge.map((entry) => entry.id === id ? { ...entry, enabled: !entry.enabled } : entry) })
  }

  return (
    <>
      <PageHeader eyebrow="LEGAL KNOWLEDGE BASE" title="База знаний" description="Нормы, практика и внутренние позиции, на которых строится юридический анализ." action={<button className="btn btn--primary" onClick={() => setShowForm((value) => !value)}>+ Добавить источник</button>} />
      {showForm && <form className="inline-create-form" onSubmit={addEntry}><label>Название<input className="input" value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Источник<input className="input" value={source} onChange={(event) => setSource(event.target.value)} required /></label><label>Статья<input className="input" value={article} onChange={(event) => setArticle(event.target.value)} /></label><button className="btn btn--primary">Сохранить</button></form>}
      <div className="filters-row"><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти норму или практику" /><span className="knowledge-count">{entries.filter((entry) => entry.enabled).length} активных источников</span></div>
      <div className="knowledge-list">
        {entries.map((entry) => <article key={entry.id} className={entry.enabled ? '' : 'is-disabled'}><div><span>{entry.category}</span><h2>{entry.title}</h2><p>{entry.source} · {entry.article}</p></div><div><small>Актуально на {entry.updatedAt}</small><button className={`switch ${entry.enabled ? 'switch--on' : ''}`} aria-label="Включить источник" onClick={() => toggleEntry(entry.id)}><i /></button></div></article>)}
      </div>
    </>
  )
}

function TeamPage({ data, onChange }: { data: WorkspaceData; onChange: (data: WorkspaceData) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamMember['role']>('Юрист')

  function addMember(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return
    const member: TeamMember = { id: createId('team'), name: name.trim(), email: email.trim(), role, active: true }
    onChange({ ...data, team: [...data.team, member] })
    setName(''); setEmail('')
  }

  return (
    <>
      <PageHeader eyebrow="РОЛИ И ДОСТУП" title="Команда" description="Юристы, рецензенты и наблюдатели рабочего пространства." />
      <div className="team-layout">
        <div className="team-list">{data.team.map((member) => <article key={member.id}><div className="avatar">{member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><h2>{member.name}</h2><p>{member.email}</p></div><span className="role-chip">{member.role}</span><span className={member.active ? 'member-active' : 'member-off'}>{member.active ? 'Активен' : 'Отключён'}</span></article>)}</div>
        <form className="workspace-card invite-card" onSubmit={addMember}><p className="eyebrow">ПРИГЛАСИТЬ</p><h2>Новый участник</h2><label>Имя<input className="input" value={name} onChange={(event) => setName(event.target.value)} required /></label><label>E-mail<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Роль<select value={role} onChange={(event) => setRole(event.target.value as TeamMember['role'])}><option>Администратор</option><option>Юрист</option><option>Младший юрист</option><option>Наблюдатель</option></select></label><button className="btn btn--primary">Добавить в команду</button></form>
      </div>
    </>
  )
}

function AnalyticsPage({ data }: { data: WorkspaceData }) {
  const statuses = STATUS_ORDER.map((status) => ({ status, count: data.reviews.filter((review) => review.status === status).length }))
  const max = Math.max(1, ...statuses.map((item) => item.count))
  const channels = Object.entries(data.reviews.reduce<Record<string, number>>((acc, review) => ({ ...acc, [review.context.channel]: (acc[review.context.channel] ?? 0) + 1 }), {}))
  return (
    <>
      <PageHeader eyebrow="ПРОИЗВОДИТЕЛЬНОСТЬ ПРАКТИКИ" title="Аналитика" description="Нагрузка, результаты проверок и повторяющиеся зоны риска." />
      <section className="metrics-grid"><MetricCard label="Среднее время" value="7 мин" hint="на первичную проверку" /><MetricCard label="Автоматизация" value="68%" hint="замечаний найдены до юриста" tone="blue" /><MetricCard label="На доработку" value={data.reviews.filter((review) => review.status === 'needs_changes').length} hint="материалов" tone="red" /><MetricCard label="Экономия" value={`${Math.max(1, data.reviews.length * 2)} ч`} hint="оценочно за месяц" tone="amber" /></section>
      <div className="analytics-grid">
        <article className="workspace-card chart-card"><span>ВОРОНКА ПРОВЕРОК</span><h2>Распределение по статусам</h2><div className="bar-chart">{statuses.map((item) => <div key={item.status}><label>{STATUS_LABEL[item.status]}<b>{item.count}</b></label><span><i style={{ width: `${(item.count / max) * 100}%` }} /></span></div>)}</div></article>
        <article className="workspace-card chart-card"><span>КАНАЛЫ</span><h2>Материалы по размещению</h2><div className="donut-summary"><div className="donut"><strong>{data.reviews.length}</strong><span>всего</span></div><ul>{channels.map(([channel, count]) => <li key={channel}><i />{CHANNEL_LABEL[channel] ?? channel}<b>{count}</b></li>)}</ul></div></article>
      </div>
      <article className="workspace-card insight-card"><p className="eyebrow">УПРАВЛЕНЧЕСКИЙ ВЫВОД</p><h2>Основной потенциал — стандартизировать проверку специальных категорий</h2><p>Используйте шаблоны для медицины, финансов и стимулирующих мероприятий. Система сохранит единый подход команды и сократит повторную работу.</p></article>
    </>
  )
}

function SettingsPage({ data, onChange }: { data: WorkspaceData; onChange: (data: WorkspaceData) => void }) {
  const [settings, setSettings] = useState<WorkspaceSettings>(data.settings)
  const [saved, setSaved] = useState(false)
  function update<K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) { setSettings((current) => ({ ...current, [key]: value })); setSaved(false) }
  function submit(event: React.FormEvent) { event.preventDefault(); onChange({ ...data, settings }); setSaved(true) }
  return (
    <>
      <PageHeader eyebrow="WHITE LABEL И БЕЗОПАСНОСТЬ" title="Настройки компании" description="Брендирование заключений, хранение данных и параметры юридической практики." />
      <form className="settings-layout" onSubmit={submit}>
        <section className="workspace-card settings-card"><span>БРЕНД И ОТЧЁТ</span><h2>Данные компании</h2><div className="form-grid"><label>Название продукта<input className="input" value={settings.firmName} onChange={(event) => update('firmName', event.target.value)} /></label><label>Юридическое лицо<input className="input" value={settings.legalName} onChange={(event) => update('legalName', event.target.value)} /></label><label>ИНН<input className="input" value={settings.inn} onChange={(event) => update('inn', event.target.value)} /></label><label>Подписант<input className="input" value={settings.signatory} onChange={(event) => update('signatory', event.target.value)} /></label><label className="form-grid__wide">Название заключения<input className="input" value={settings.reportTitle} onChange={(event) => update('reportTitle', event.target.value)} /></label><label>Акцентный цвет<input className="input color-input" type="color" value={settings.accent} onChange={(event) => update('accent', event.target.value)} /></label></div></section>
        <section className="workspace-card settings-card"><span>КОНТРОЛЬ ДАННЫХ</span><h2>Безопасность и хранение</h2><div className="form-grid"><label>Срок хранения, дней<input className="input" type="number" min="1" max="3650" value={settings.retentionDays} onChange={(event) => update('retentionDays', Number(event.target.value))} /></label><label>Регион данных<input className="input" value={settings.dataRegion} onChange={(event) => update('dataRegion', event.target.value)} /></label></div><div className="security-checklist"><div><i>✓</i><p><b>Разделение клиентов</b><span>Материалы привязаны к отдельным делам</span></p></div><div><i>✓</i><p><b>Журнал решений</b><span>Сохраняются статусы, версии и комментарии</span></p></div><div><i>✓</i><p><b>Управляемое удаление</b><span>Политика хранения задаётся администратором</span></p></div></div><p className="settings-note">Для промышленного внедрения подключаются корпоративный вход, серверная база данных и частный контур заказчика.</p></section>
        <div className="settings-actions"><button className="btn btn--primary">Сохранить настройки</button>{saved && <span>✓ Настройки сохранены</span>}</div>
      </form>
    </>
  )
}

function NewReviewPage({ data, initialTemplate, onCancel, onCreated }: { data: WorkspaceData; initialTemplate: ReviewTemplate | null; onCancel: () => void; onCreated: (review: ReviewMatter) => void }) {
  const [draft, setDraft] = useState<NewReviewDraft>(() => {
    const value = emptyDraft(data.clients)
    return initialTemplate ? { ...value, title: initialTemplate.name, product: initialTemplate.prompt, channel: initialTemplate.channel } : value
  })
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const valid = draft.clientId && draft.title.trim() && draft.company.trim() && draft.product.trim()
  const context: AnalysisContext = { company_description: draft.company.trim(), product_description: draft.product.trim() }

  function setField<K extends keyof NewReviewDraft>(key: K, value: NewReviewDraft[K]) { setDraft((current) => ({ ...current, [key]: value })) }

  function selectClient(id: string) {
    const client = data.clients.find((item) => item.id === id)
    setDraft((current) => ({ ...current, clientId: id, company: client ? `${client.name}, сфера: ${client.industry}` : current.company }))
  }

  async function runAnalysis(type: InputType, label: string, fn: () => Promise<Report>) {
    setLoading(true); setError('')
    try {
      const report = await fn()
      const now = new Date().toISOString()
      const review: ReviewMatter = {
        id: createId('review'),
        number: nextReviewNumber(data.reviews),
        clientId: draft.clientId,
        title: draft.title.trim(),
        status: 'lawyer_review',
        context: {
          company: draft.company.trim(), product: draft.product.trim(), audience: draft.audience.trim(), territory: draft.territory.trim(), publishDate: draft.publishDate, channel: draft.channel,
          hasLicense: draft.hasLicense, targetsMinors: draft.targetsMinors, bloggerAd: draft.bloggerAd, promotion: draft.promotion, personalData: draft.personalData,
        },
        materialType: type,
        materialLabel: label,
        report,
        versions: [{ id: createId('version'), number: 1, createdAt: now, text: report.extracted_text, overallRisk: report.overall_risk, findingsCount: report.findings.length }],
        comments: [],
        reviewer: null,
        createdAt: now,
        updatedAt: now,
      }
      onCreated(review)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось выполнить проверку.')
    } finally { setLoading(false) }
  }

  return (
    <>
      <PageHeader eyebrow={`НОВАЯ ПРОВЕРКА · ШАГ ${step} ИЗ 2`} title={step === 1 ? 'Контекст рекламного материала' : 'Загрузите материал'} description={step === 1 ? 'Заполните данные, которые влияют на юридическую оценку.' : 'Система сформирует черновик, который затем подтверждает юрист.'} action={<button className="btn btn--secondary" onClick={onCancel}>Отменить</button>} />
      <div className="review-progress"><span className={step >= 1 ? 'active' : ''}>01 Контекст</span><i /><span className={step >= 2 ? 'active' : ''}>02 Материал и анализ</span></div>
      {step === 1 ? (
        <section className="workspace-card intake-card">
          <div className="form-grid form-grid--three">
            <label>Клиент<select value={draft.clientId} onChange={(event) => selectClient(event.target.value)}>{data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="form-grid__wide">Название проверки<input className="input" value={draft.title} onChange={(event) => setField('title', event.target.value)} placeholder="Например: баннер программы реабилитации" /></label>
            <label className="form-grid__wide">Чем занимается компания<textarea className="textarea compact-textarea" value={draft.company} onChange={(event) => setField('company', event.target.value)} /></label>
            <label className="form-grid__wide">Какой продукт рекламируется<textarea className="textarea compact-textarea" value={draft.product} onChange={(event) => setField('product', event.target.value)} placeholder="Опишите услугу, предложение и важные условия" /></label>
            <label>Аудитория<input className="input" value={draft.audience} onChange={(event) => setField('audience', event.target.value)} /></label>
            <label>Территория<input className="input" value={draft.territory} onChange={(event) => setField('territory', event.target.value)} /></label>
            <label>Плановая публикация<input className="input" type="date" value={draft.publishDate} onChange={(event) => setField('publishDate', event.target.value)} /></label>
            <label>Канал<select value={draft.channel} onChange={(event) => setField('channel', event.target.value as Channel)}>{Object.entries(CHANNEL_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="context-switches">
            {[
              ['hasLicense', 'Есть лицензируемая деятельность'], ['targetsMinors', 'Реклама адресована несовершеннолетним'], ['bloggerAd', 'Интеграция у блогера'], ['promotion', 'Есть акция, скидка или розыгрыш'], ['personalData', 'Собираются персональные данные'],
            ].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draft[key as keyof NewReviewDraft])} onChange={(event) => setField(key as keyof NewReviewDraft, event.target.checked as never)} /><span>{label}</span></label>)}
          </div>
          <div className="form-actions"><span>Обязательные поля: клиент, название, компания и продукт.</span><button className="btn btn--primary" disabled={!valid} onClick={() => setStep(2)}>Продолжить →</button></div>
        </section>
      ) : (
        <section className="material-step">
          <div className="matter-context-strip"><div><span>КЛИЕНТ</span><p>{data.clients.find((client) => client.id === draft.clientId)?.name}</p></div><div><span>МАТЕРИАЛ</span><p>{draft.title}</p></div><div><span>КАНАЛ</span><p>{CHANNEL_LABEL[draft.channel]}</p></div><button className="text-action" onClick={() => setStep(1)}>Изменить контекст</button></div>
          <InputPanel loading={loading} onDraftChange={() => setError('')} onAnalyzeText={(text) => runAnalysis('text', 'Рекламный текст', () => analyzeText(text, draft.channel, context))} onAnalyzeUrl={(url) => runAnalysis('url', url, () => analyzeUrl(url, draft.channel, context))} onAnalyzeImage={(file) => runAnalysis('image', file.name, () => analyzeImage(file, draft.channel, context))} />
          {loading && <div className="loading"><div className="spinner" /><div><b>Формируем юридический черновик</b><span>Проверяем материал и сопоставляем его с базой знаний…</span></div></div>}
          {error && <div className="error" role="alert">{error}</div>}
        </section>
      )}
    </>
  )
}

function ReviewPage({ review, client, settings, onBack, onUpdate }: { review: ReviewMatter; client: Client | undefined; settings: WorkspaceSettings; onBack: () => void; onUpdate: (review: ReviewMatter) => void }) {
  const [comment, setComment] = useState('')
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionText, setRevisionText] = useState(review.report?.extracted_text ?? '')
  const [rechecking, setRechecking] = useState(false)
  const [error, setError] = useState('')
  const [exportNotice, setExportNotice] = useState('')

  function changeStatus(status: ReviewStatus) {
    onUpdate({ ...review, status, reviewer: status === 'approved' ? settings.signatory : review.reviewer, updatedAt: new Date().toISOString() })
  }

  function addComment(event: React.FormEvent) {
    event.preventDefault()
    if (!comment.trim()) return
    onUpdate({ ...review, comments: [...review.comments, { id: createId('comment'), author: settings.signatory.split(',')[0], text: comment.trim(), createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() })
    setComment('')
  }

  async function analyzeRevision() {
    if (!revisionText.trim()) return
    setRechecking(true); setError('')
    try {
      const report = await analyzeText(revisionText, review.context.channel, { company_description: review.context.company, product_description: review.context.product })
      const updatedAt = new Date().toISOString()
      onUpdate({ ...review, report, status: 'lawyer_review', reviewer: null, materialType: 'text', materialLabel: `Редакция ${review.versions.length + 1}`, versions: [...review.versions, { id: createId('version'), number: review.versions.length + 1, createdAt: updatedAt, text: report.extracted_text, overallRisk: report.overall_risk, findingsCount: report.findings.length }], updatedAt })
      setRevisionOpen(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось проверить новую редакцию.') } finally { setRechecking(false) }
  }

  return (
    <>
      <div className="review-detail-head">
        <button className="back-link" onClick={onBack}>← Все проверки</button>
        <div><span>{review.number}</span><h1>{review.title}</h1><p>{client?.name ?? 'Без клиента'} · обновлено {formatDate(review.updatedAt)}</p></div>
        <div className="review-detail-actions"><StatusBadge status={review.status} /><button className="btn btn--secondary" disabled={!review.report} onClick={() => { setExportNotice('Открыто окно печати — выберите «Сохранить как PDF».'); window.print() }}>PDF</button><button className="btn btn--secondary" disabled={!review.report} onClick={() => { exportReviewToWord(review, settings); setExportNotice('Заключение Word подготовлено к скачиванию.') }}>Word</button>{review.status !== 'approved' && <button className="btn btn--primary" disabled={!review.report} onClick={() => changeStatus('approved')}>✓ Согласовать</button>}</div>
      </div>

      {exportNotice && <div className="export-notice" role="status">✓ {exportNotice}<button onClick={() => setExportNotice('')}>×</button></div>}

      <div className="matter-meta-grid">
        <div><span>КОМПАНИЯ</span><p>{review.context.company}</p></div><div><span>ПРОДУКТ</span><p>{review.context.product}</p></div><div><span>АУДИТОРИЯ</span><p>{review.context.audience}</p></div><div><span>КАНАЛ</span><p>{CHANNEL_LABEL[review.context.channel]}</p></div>
      </div>

      <div className="review-workbench">
        <main>
          {!review.report ? (
            <div className="workspace-card no-report"><span>ЧЕРНОВИК ДЕЛА</span><h2>Автоматический отчёт ещё не сохранён</h2><p>Создайте новую проверку материала, чтобы получить подробные замечания и заключение.</p></div>
          ) : <ReportView report={review.report} />}
        </main>
        <aside className="review-sidebar">
          <section className="workspace-card review-control"><span>РЕШЕНИЕ ЮРИСТА</span><h2>Статус дела</h2><select value={review.status} onChange={(event) => changeStatus(event.target.value as ReviewStatus)}>{STATUS_ORDER.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select>{review.reviewer && <p className="reviewer-line">✓ {review.reviewer}</p>}</section>
          <section className="workspace-card"><div className="section-head"><div><span>ВЕРСИИ</span><h2>История материала</h2></div><b>{review.versions.length}</b></div><div className="version-list">{review.versions.map((version) => <div key={version.id}><b>v{version.number}</b><p>{RISK_LABEL[version.overallRisk]} риск · {version.findingsCount} замечаний</p><small>{formatDate(version.createdAt)}</small></div>)}</div>{review.report && <button className="btn btn--secondary btn--full" onClick={() => setRevisionOpen((value) => !value)}>+ Новая редакция</button>}</section>
          <section className="workspace-card"><span>КОММЕНТАРИИ</span><h2>Обсуждение</h2><div className="comment-list">{review.comments.map((item) => <div key={item.id}><b>{item.author}</b><p>{item.text}</p><small>{formatDate(item.createdAt)}</small></div>)}{review.comments.length === 0 && <p className="muted-empty">Комментариев пока нет.</p>}</div><form className="comment-form" onSubmit={addComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий для команды…" /><button className="btn btn--primary" disabled={!comment.trim()}>Добавить</button></form></section>
        </aside>
      </div>
      {revisionOpen && <section className="revision-drawer"><div><p className="eyebrow">НОВАЯ ВЕРСИЯ</p><h2>Проверьте исправленную редакцию</h2><p>После анализа она появится в истории, а дело вернётся на проверку юриста.</p></div><textarea className="textarea" value={revisionText} onChange={(event) => setRevisionText(event.target.value)} /><div><button className="btn btn--secondary" onClick={() => setRevisionOpen(false)}>Отмена</button><button className="btn btn--primary" disabled={rechecking || !revisionText.trim()} onClick={analyzeRevision}>{rechecking ? 'Проверяем…' : 'Проверить редакцию'}</button></div>{error && <div className="error">{error}</div>}</section>}
    </>
  )
}

export function WorkspaceApp() {
  const [data, setData] = useState<WorkspaceData>(() => loadWorkspace())
  const [view, setView] = useState<WorkspaceView>(() => new URLSearchParams(window.location.search).has('review') ? 'review' : 'dashboard')
  const [activeReviewId, setActiveReviewId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('review'))
  const [template, setTemplate] = useState<ReviewTemplate | null>(null)
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null)

  useEffect(() => { saveWorkspace(data); document.documentElement.style.setProperty('--primary', data.settings.accent) }, [data])
  useEffect(() => { getHealth().then((result) => setLlmEnabled(result.llm_enabled)).catch(() => setLlmEnabled(null)) }, [])

  function navigate(next: WorkspaceView) {
    setView(next)
    if (next !== 'review') { setActiveReviewId(null); window.history.replaceState({}, '', window.location.pathname) }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openReview(id: string) {
    setActiveReviewId(id); setView('review'); window.history.replaceState({}, '', `${window.location.pathname}?review=${encodeURIComponent(id)}`); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function createReview(review: ReviewMatter) {
    setData((current) => ({ ...current, reviews: [review, ...current.reviews] })); openReview(review.id)
  }

  function updateReview(review: ReviewMatter) {
    setData((current) => ({ ...current, reviews: current.reviews.map((item) => item.id === review.id ? review : item) }))
  }

  function startFromTemplate(item: ReviewTemplate) { setTemplate(item); navigate('new-review') }
  function startNew() { setTemplate(null); navigate('new-review') }

  const activeReview = data.reviews.find((review) => review.id === activeReviewId)
  const page = (() => {
    if (view === 'dashboard') return <Dashboard data={data} onNew={startNew} onOpenReview={openReview} onNavigate={navigate} />
    if (view === 'reviews') return <ReviewsPage data={data} onNew={startNew} onOpen={openReview} />
    if (view === 'clients') return <ClientsPage data={data} onChange={setData} />
    if (view === 'templates') return <TemplatesPage data={data} onChange={setData} onUse={startFromTemplate} />
    if (view === 'knowledge') return <KnowledgePage data={data} onChange={setData} />
    if (view === 'team') return <TeamPage data={data} onChange={setData} />
    if (view === 'analytics') return <AnalyticsPage data={data} />
    if (view === 'settings') return <SettingsPage data={data} onChange={setData} />
    if (view === 'new-review') return <NewReviewPage key={template?.id ?? 'blank'} data={data} initialTemplate={template} onCancel={() => navigate('dashboard')} onCreated={createReview} />
    if (view === 'review' && activeReview) return <ReviewPage review={activeReview} client={data.clients.find((client) => client.id === activeReview.clientId)} settings={data.settings} onBack={() => navigate('reviews')} onUpdate={updateReview} />
    return <Dashboard data={data} onNew={startNew} onOpenReview={openReview} onNavigate={navigate} />
  })()

  return (
    <div className="workspace-shell">
      <aside className="workspace-nav">
        <button className="workspace-brand" onClick={() => navigate('dashboard')}><span>PR</span><div><b>{data.settings.firmName}</b><small>ADVERTISING COUNSEL</small></div></button>
        <nav>{NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id || (item.id === 'reviews' && view === 'review') ? 'active' : ''} onClick={() => navigate(item.id)}><span>{item.short}</span>{item.label}{item.id === 'reviews' && <i>{data.reviews.filter((review) => ['lawyer_review', 'needs_changes'].includes(review.status)).length}</i>}</button>)}</nav>
        <div className="workspace-nav__bottom"><div className="system-status"><i /><span><b>Система работает</b><small>{llmEnabled ? 'Правила + ИИ-анализ' : 'Движок правовых правил'}</small></span></div><div className="user-card"><span>АК</span><div><b>Анна Крылова</b><small>Администратор</small></div></div></div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar"><div><span className="workspace-topbar__dot" />Защищённое рабочее пространство</div><button className="quick-new" onClick={startNew}>+ Новая проверка</button><div className="topbar-profile">АК</div></header>
        <main className="workspace-content">{page}</main>
        <footer className="workspace-footer"><span>© 2026 {data.settings.firmName}</span><span>Автоматический анализ требует профессиональной проверки юристом</span></footer>
      </div>
    </div>
  )
}
