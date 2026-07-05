import type { RiskLevel } from './types'

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
}

export const RISK_EMOJI: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
}

export const SOURCE_LABEL: Record<string, string> = {
  rule: 'Правило',
  llm: 'ИИ-анализ',
}

export const CHANNEL_LABEL: Record<string, string> = {
  internet: 'Интернет',
  sms: 'СМС / рассылка',
  email: 'E-mail',
  tv: 'ТВ',
  radio: 'Радио',
  print: 'Печать',
  outdoor: 'Наружная',
}
