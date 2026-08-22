import type { AnalysisContext, InputType, Report, RiskLevel } from './types'

export type BatchMaterial =
  | { id: string; type: 'text'; label: string; text: string }
  | { id: string; type: 'url'; label: string; url: string }
  | { id: string; type: 'image'; label: string; file: File }

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
  return `Материал ${index + 1} — ${shortLabel(material.label)}`
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
  const failedNote = failures.length > 0
    ? ` ${failures.length} ${failures.length === 1 ? 'материал не удалось проверить' : 'материала не удалось проверить'}; подробности указаны в предупреждениях.`
    : ''

  return {
    overall_risk: overallRisk,
    summary: `Пакетная проверка: проанализировано ${successes.length} из ${total} материалов, выявлено ${findings.length} замечаний.${failedNote}`,
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
