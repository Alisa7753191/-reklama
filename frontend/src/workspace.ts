import type { Channel } from './api'
import type { InputType, Report, RiskLevel } from './types'

export type WorkspaceView =
  | 'dashboard'
  | 'reviews'
  | 'clients'
  | 'templates'
  | 'knowledge'
  | 'team'
  | 'analytics'
  | 'settings'
  | 'new-review'
  | 'review'

export type ReviewStatus =
  | 'draft'
  | 'auto_review'
  | 'lawyer_review'
  | 'needs_changes'
  | 'approved'

export interface Client {
  id: string
  name: string
  industry: string
  contact: string
  createdAt: string
}

export interface ReviewContext {
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

export interface ReviewVersion {
  id: string
  number: number
  createdAt: string
  text: string
  overallRisk: RiskLevel
  findingsCount: number
}

export interface ReviewComment {
  id: string
  author: string
  text: string
  createdAt: string
}

export interface ReviewMatter {
  id: string
  number: string
  clientId: string
  title: string
  status: ReviewStatus
  context: ReviewContext
  materialType: InputType
  materialLabel: string
  report: Report | null
  versions: ReviewVersion[]
  comments: ReviewComment[]
  reviewer: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewTemplate {
  id: string
  name: string
  description: string
  industry: string
  channel: Channel
  prompt: string
}

export interface KnowledgeEntry {
  id: string
  title: string
  source: string
  article: string
  category: string
  updatedAt: string
  enabled: boolean
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'Администратор' | 'Юрист' | 'Младший юрист' | 'Наблюдатель'
  active: boolean
}

export interface WorkspaceSettings {
  firmName: string
  legalName: string
  inn: string
  signatory: string
  reportTitle: string
  retentionDays: number
  dataRegion: string
  accent: string
}

export interface WorkspaceData {
  clients: Client[]
  reviews: ReviewMatter[]
  templates: ReviewTemplate[]
  knowledge: KnowledgeEntry[]
  team: TeamMember[]
  settings: WorkspaceSettings
}

const STORAGE_KEY = 'pravoreklama.workspace.v1'

const now = new Date()
const iso = (daysAgo = 0) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Черновик',
  auto_review: 'Автопроверка',
  lawyer_review: 'На проверке юриста',
  needs_changes: 'Требует исправлений',
  approved: 'Согласовано',
}

export const STATUS_TONE: Record<ReviewStatus, string> = {
  draft: 'neutral',
  auto_review: 'blue',
  lawyer_review: 'amber',
  needs_changes: 'red',
  approved: 'green',
}

export const DEFAULT_WORKSPACE: WorkspaceData = {
  clients: [
    { id: 'client-nova', name: 'Клиника «Нова»', industry: 'Медицина', contact: 'marketing@nova.demo', createdAt: iso(42) },
    { id: 'client-vector', name: 'Банк «Вектор»', industry: 'Финансы', contact: 'legal@vector.demo', createdAt: iso(35) },
    { id: 'client-lime', name: 'Lime Market', industry: 'E-commerce', contact: 'brand@lime.demo', createdAt: iso(18) },
  ],
  reviews: [
    {
      id: 'review-demo-1',
      number: 'PR-2026-0018',
      clientId: 'client-nova',
      title: 'Лендинг программы восстановления',
      status: 'lawyer_review',
      context: {
        company: 'Сеть частных медицинских клиник',
        product: 'Программа медицинской реабилитации',
        audience: 'Совершеннолетние пациенты',
        territory: 'Россия',
        publishDate: '',
        channel: 'internet',
        hasLicense: true,
        targetsMinors: false,
        bloggerAd: false,
        promotion: false,
        personalData: true,
      },
      materialType: 'url',
      materialLabel: 'nova.demo/recovery',
      report: null,
      versions: [],
      comments: [
        { id: 'comment-demo-1', author: 'Анна Крылова', text: 'Проверить предупреждение о противопоказаниях и реквизиты лицензии.', createdAt: iso(1) },
      ],
      reviewer: 'Анна Крылова',
      createdAt: iso(3),
      updatedAt: iso(1),
    },
    {
      id: 'review-demo-2',
      number: 'PR-2026-0017',
      clientId: 'client-vector',
      title: 'Баннер потребительского кредита',
      status: 'needs_changes',
      context: {
        company: 'Коммерческий банк',
        product: 'Потребительский кредит наличными',
        audience: 'Физические лица 21+',
        territory: 'Россия',
        publishDate: '',
        channel: 'internet',
        hasLicense: true,
        targetsMinors: false,
        bloggerAd: false,
        promotion: true,
        personalData: false,
      },
      materialType: 'image',
      materialLabel: 'credit-banner-v3.png',
      report: null,
      versions: [],
      comments: [],
      reviewer: 'Михаил Орлов',
      createdAt: iso(5),
      updatedAt: iso(2),
    },
    {
      id: 'review-demo-3',
      number: 'PR-2026-0016',
      clientId: 'client-lime',
      title: 'Розыгрыш среди покупателей',
      status: 'approved',
      context: {
        company: 'Интернет-магазин одежды',
        product: 'Стимулирующая акция с розыгрышем сертификатов',
        audience: 'Покупатели 18+',
        territory: 'Россия',
        publishDate: '',
        channel: 'internet',
        hasLicense: false,
        targetsMinors: false,
        bloggerAd: true,
        promotion: true,
        personalData: true,
      },
      materialType: 'text',
      materialLabel: 'Пост для социальных сетей',
      report: null,
      versions: [],
      comments: [],
      reviewer: 'Анна Крылова',
      createdAt: iso(8),
      updatedAt: iso(6),
    },
  ],
  templates: [
    { id: 'template-med', name: 'Медицинская услуга', description: 'Клиники, диагностика, лечение и реабилитация', industry: 'Медицина', channel: 'internet', prompt: 'Медицинская услуга. Проверить противопоказания, гарантии результата, лицензию и специальные ограничения статьи 24.' },
    { id: 'template-credit', name: 'Кредит или заём', description: 'Банки, МФО, ипотека и рассрочка', industry: 'Финансы', channel: 'internet', prompt: 'Потребительский кредит. Проверить ПСК, предупреждение «Изучите все условия», фирменное наименование и раскрытие условий.' },
    { id: 'template-promo', name: 'Акция или розыгрыш', description: 'Конкурсы, подарки и стимулирующие мероприятия', industry: 'Маркетинг', channel: 'internet', prompt: 'Стимулирующая акция. Проверить сроки, источник правил, организатора, призовой фонд и порядок получения призов.' },
    { id: 'template-blogger', name: 'Реклама у блогера', description: 'Посевы, интеграции и нативные публикации', industry: 'Digital', channel: 'internet', prompt: 'Интернет-реклама у блогера. Проверить пометку «Реклама», рекламодателя, ERID и корректность рекламных обещаний.' },
  ],
  knowledge: [
    { id: 'kb-fz38-5', title: 'Общие требования к рекламе', source: 'ФЗ № 38-ФЗ «О рекламе»', article: 'Статья 5', category: 'Общие требования', updatedAt: '2026-07-26', enabled: true },
    { id: 'kb-fz38-18-1', title: 'Маркировка интернет-рекламы', source: 'ФЗ № 38-ФЗ «О рекламе»', article: 'Статья 18.1', category: 'Интернет-реклама', updatedAt: '2026-07-26', enabled: true },
    { id: 'kb-fz38-24', title: 'Лекарства и медицинские услуги', source: 'ФЗ № 38-ФЗ «О рекламе»', article: 'Статья 24', category: 'Медицина', updatedAt: '2026-07-26', enabled: true },
    { id: 'kb-fz38-28', title: 'Финансовые услуги', source: 'ФЗ № 38-ФЗ «О рекламе»', article: 'Статья 28', category: 'Финансы', updatedAt: '2026-07-26', enabled: true },
    { id: 'kb-fas', title: 'Подходы ФАС к превосходной степени', source: 'Практика ФАС России', article: 'Подборка решений', category: 'Практика', updatedAt: '2026-06-18', enabled: true },
  ],
  team: [
    { id: 'team-1', name: 'Анна Крылова', email: 'a.krylova@lex.demo', role: 'Администратор', active: true },
    { id: 'team-2', name: 'Михаил Орлов', email: 'm.orlov@lex.demo', role: 'Юрист', active: true },
    { id: 'team-3', name: 'Елена Волкова', email: 'e.volkova@lex.demo', role: 'Младший юрист', active: true },
  ],
  settings: {
    firmName: 'ПравоРеклама Legal',
    legalName: 'ООО «Юридические решения»',
    inn: '7700000000',
    signatory: 'Анна Крылова, руководитель практики',
    reportTitle: 'Заключение о соответствии рекламного материала',
    retentionDays: 365,
    dataRegion: 'Российская Федерация',
    accent: '#39f28a',
  },
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function loadWorkspace(): WorkspaceData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WORKSPACE
    const stored = JSON.parse(raw) as Partial<WorkspaceData>
    return {
      ...DEFAULT_WORKSPACE,
      ...stored,
      settings: { ...DEFAULT_WORKSPACE.settings, ...stored.settings },
    }
  } catch {
    return DEFAULT_WORKSPACE
  }
}

export function saveWorkspace(data: WorkspaceData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function formatDate(value: string): string {
  if (!value) return 'Не указана'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function nextReviewNumber(reviews: ReviewMatter[]): string {
  const year = new Date().getFullYear()
  const max = reviews.reduce((acc, item) => {
    const match = item.number.match(/(\d+)$/)
    return match ? Math.max(acc, Number(match[1])) : acc
  }, 0)
  return `PR-${year}-${String(max + 1).padStart(4, '0')}`
}
