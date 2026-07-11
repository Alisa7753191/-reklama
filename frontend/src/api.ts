import type { Report } from './types'

export type Channel = 'internet' | 'sms' | 'email' | 'tv' | 'radio' | 'print' | 'outdoor'

const BASE = '/api'

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

export async function analyzeText(text: string, channel: Channel = 'internet'): Promise<Report> {
  const resp = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_type: 'text', text, channel }),
  })
  return handle(resp)
}

export async function analyzeUrl(url: string, channel: Channel = 'internet'): Promise<Report> {
  const resp = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_type: 'url', url, channel }),
  })
  return handle(resp)
}

export async function analyzeImage(file: File, channel: Channel = 'internet'): Promise<Report> {
  const form = new FormData()
  form.append('file', file)
  form.append('channel', channel)
  const resp = await fetch(`${BASE}/analyze/image`, {
    method: 'POST',
    body: form,
  })
  return handle(resp)
}

export async function getHealth(): Promise<{ llm_enabled: boolean; llm_provider: string | null }> {
  const resp = await fetch(`${BASE}/health`)
  return resp.json()
}
