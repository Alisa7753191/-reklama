import type { AnalysisContext, Report } from './types'

export type Channel = 'internet' | 'sms' | 'email' | 'tv' | 'radio' | 'print' | 'outdoor'

const BASE = '/api'
const REQUEST_TIMEOUT_MS = 70_000
const IMAGE_TIMEOUT_MS = 120_000

async function handle(resp: Response): Promise<Report> {
  if (!resp.ok) {
    let detail = `Ошибка ${resp.status}`
    try {
      const data = await resp.json()
      if (data?.detail) detail = data.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return resp.json()
}

async function fetchReport(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Report> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await handle(await fetch(input, { ...init, signal: controller.signal }))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Проверка заняла слишком много времени. Попробуйте ещё раз.')
    }
    if (error instanceof TypeError) {
      throw new Error('Не удалось связаться с сервисом проверки. Повторите попытку через минуту.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export async function analyzeText(
  text: string,
  channel: Channel = 'internet',
  context?: AnalysisContext,
): Promise<Report> {
  return fetchReport(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_type: 'text', text, channel, ...context }),
  })
}

export async function analyzeUrl(
  url: string,
  channel: Channel = 'internet',
  context?: AnalysisContext,
): Promise<Report> {
  return fetchReport(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_type: 'url', url: normalizeUrl(url), channel, ...context }),
  })
}

export async function analyzeImage(
  file: File,
  channel: Channel = 'internet',
  context?: AnalysisContext,
): Promise<Report> {
  const form = new FormData()
  form.append('file', file)
  form.append('channel', channel)
  if (context?.company_description) form.append('company_description', context.company_description)
  if (context?.product_description) form.append('product_description', context.product_description)
  return fetchReport(`${BASE}/analyze/image`, {
    method: 'POST',
    body: form,
  }, IMAGE_TIMEOUT_MS)
}

export async function getHealth(): Promise<{ llm_enabled: boolean; llm_provider: string | null }> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 10_000)
  try {
    const resp = await fetch(`${BASE}/health`, { signal: controller.signal })
    if (!resp.ok) throw new Error(`Ошибка ${resp.status}`)
    return resp.json()
  } finally {
    window.clearTimeout(timer)
  }
}
