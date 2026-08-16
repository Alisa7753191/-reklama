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

export const CATEGORY_LABEL: Record<string, string> = {
  alcohol: 'Алкогольная продукция',
  tobacco: 'Табак и никотинсодержащая продукция',
  medicine: 'Лекарства и медицинские услуги',
  bad: 'Биологически активные добавки',
  credit: 'Кредиты, займы и ипотека',
  deposit: 'Вклады и депозиты',
  investment: 'Инвестиции и ценные бумаги',
  bankruptcy: 'Услуги по банкротству',
  gambling: 'Азартные игры и пари',
  children: 'Реклама для несовершеннолетних',
  energy_drinks: 'Безалкогольные тонизирующие напитки',
  weapons: 'Оружие',
  cfa: 'Цифровые финансовые активы',
  rent_contract: 'Пожизненная рента',
  promotion: 'Акции, конкурсы и розыгрыши',
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
