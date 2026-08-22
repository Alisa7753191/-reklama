import type { AnalysisContext, InputType, Report, RiskLevel } from './types'

export type CampaignRole = 'creative' | 'landing' | 'rules' | 'script' | 'supporting'

export const CAMPAIGN_ROLE_LABEL: Record<CampaignRole, string> = {
  creative: 'Рекламный креатив',
  landing: 'Лендинг',
  rules: 'Правила акции',
  script: 'Сценарий ролика',
  supporting: 'Подтверждающий документ',
}

export type BatchMaterial =
  | { id: string; type: 'text'; label: string; role: CampaignRole; text: string }
  | { id: string; type: 'url'; label: string; role: CampaignRole; url: string }
  | { id: string; type: 'image'; label: string; role: CampaignRole; file: File }
  | { id: string; type: 'document'; label: string; role: CampaignRole; file: File }
  | { id: string; type: 'audio'; label: string; role: CampaignRole; file: File; transcript: string }
  | { id: string; type: 'video'; label: string; role: CampaignRole; file: File; transcript: string }

export interface BatchProgress {
  current: number
  total: number
  label: string
}

export interface BatchAnalysisResult {
  material: BatchMaterial
  index: number
  report: Report
}

export interface BatchAnalysisFailure {
  material: BatchMaterial
  index: number
  message: string
}

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

function shortLabel(value: string, maxLength = 76) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized
}

export function describeBatchMaterial(material: BatchMaterial, index: number) {
  return `Материал ${index + 1} · ${CAMPAIGN_ROLE_LABEL[material.role]} — ${shortLabel(material.label)}`
}

export function isFileMaterial(material: BatchMaterial): material is Extract<BatchMaterial, { file: File }> {
  return 'file' in material
}

export function mergeBatchReports(
  successes: BatchAnalysisResult[],
  failures: BatchAnalysisFailure[],
  channel: string,
  context: AnalysisContext,
): Report {
  if (successes.length === 0) throw new Error('Не удалось проверить ни один материал из пакета.')

  const sorted = [...successes].sort((a, b) => a.index - b.index)
  const overallRisk = sorted.reduce<RiskLevel>((highest, item) => (
    RISK_ORDER[item.report.overall_risk] > RISK_ORDER[highest]
      ? item.report.overall_risk
      : highest
  ), 'low')

  const findings = sorted.flatMap((item) => {
    const materialRef = describeBatchMaterial(item.material, item.index)
    return item.report.findings.map((finding) => ({
      ...finding,
      id: `${item.material.id}-${finding.id}`,
      title: `${materialRef}: ${finding.title}`,
      evidence: finding.evidence
        ? `${materialRef}\n${finding.evidence}`
        : materialRef,
    }))
  })

  const warnings = sorted.flatMap((item) => {
    const materialRef = describeBatchMaterial(item.material, item.index)
    return item.report.meta.warnings.map((warning) => `${materialRef}: ${warning}`)
  })
  warnings.push(...failures.map((item) => (
    `${describeBatchMaterial(item.material, item.index)} не проверен: ${item.message}`
  )))

  const extractedText = sorted.map((item) => {
    const heading = describeBatchMaterial(item.material, item.index).toUpperCase()
    return `${heading}\n${item.report.extracted_text || '[Текст не извлечён]'}`
  }).join('\n\n')

  const total = successes.length + failures.length
  const campaignRoles = Array.from(new Set(sorted.map((item) => CAMPAIGN_ROLE_LABEL[item.material.role])))
  if (campaignRoles.length > 1) {
    warnings.unshift(`Кампания проверена в совокупности ролей: ${campaignRoles.join(', ')}. Итоговый уровень определяется по наиболее существенному риску среди связанных материалов.`)
  }
  const failedNote = failures.length > 0
    ? ` ${failures.length} ${failures.length === 1 ? 'материал не удалось проверить' : 'материала не удалось проверить'}; подробности указаны в предупреждениях.`
    : ''

  return {
    overall_risk: overallRisk,
    summary: `Проверка кампании: проанализировано ${successes.length} из ${total} материалов в ${campaignRoles.length} ${campaignRoles.length === 1 ? 'роли' : 'ролях'}, выявлено ${findings.length} замечаний.${failedNote}`,
    detected_categories: Array.from(new Set(sorted.flatMap((item) => item.report.detected_categories))),
    findings,
    extracted_text: extractedText,
    disclaimer: sorted[0].report.disclaimer,
    meta: {
      input_type: sorted[0].report.meta.input_type as InputType,
      channel,
      llm_used: sorted.some((item) => item.report.meta.llm_used),
      llm_provider: Array.from(new Set(sorted.map((item) => item.report.meta.llm_provider).filter(Boolean))).join(', ') || null,
      rules_findings: sorted.reduce((sum, item) => sum + item.report.meta.rules_findings, 0),
      llm_findings: sorted.reduce((sum, item) => sum + item.report.meta.llm_findings, 0),
      warnings,
      company_description: context.company_description,
      product_description: context.product_description,
    },
  }
}
