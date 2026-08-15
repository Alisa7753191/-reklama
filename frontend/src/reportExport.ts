import { CATEGORY_LABEL, CHANNEL_LABEL } from './labels'
import type { ReviewMatter, WorkspaceSettings } from './workspace'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char] ?? char)
}

export function exportReviewToWord(review: ReviewMatter, settings: WorkspaceSettings): void {
  const report = review.report
  if (!report) return

  const findings = report.findings.map((finding, index) => `
    <section class="finding">
      <h2>${index + 1}. ${escapeHtml(finding.title)}</h2>
      <p><strong>Уровень риска:</strong> ${escapeHtml(finding.risk_level)}</p>
      <p>${escapeHtml(finding.description)}</p>
      ${finding.evidence ? `<blockquote>«${escapeHtml(finding.evidence)}»</blockquote>` : ''}
      <h3>Правовое основание</h3>
      <ul>${finding.legal_basis.map((basis) => `<li><strong>${escapeHtml(basis.law)}, ${escapeHtml(basis.article)}</strong> — ${escapeHtml(basis.title || '')}<br>${escapeHtml(basis.summary || '')}</li>`).join('')}</ul>
      <h3>Рекомендации</h3>
      <ul>${finding.mitigation.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
  `).join('')

  const html = `<!doctype html>
  <html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(settings.reportTitle)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#172019;line-height:1.5;margin:42px}
    h1{font-size:24px;margin:0 0 8px}h2{font-size:17px;margin:24px 0 8px}h3{font-size:13px;margin:14px 0 5px}
    .meta{border:1px solid #cfd8d1;background:#f6f9f7;padding:16px;margin:20px 0}.meta p{margin:4px 0}
    .finding{border-top:2px solid #2bc875;padding-top:8px;page-break-inside:avoid}blockquote{border-left:3px solid #2bc875;padding:8px 12px;background:#f3f7f4}
    .footer{margin-top:34px;border-top:1px solid #cfd8d1;padding-top:16px;font-size:12px;color:#59665d}
  </style></head><body>
    <p>${escapeHtml(settings.firmName)}</p>
    <h1>${escapeHtml(settings.reportTitle)}</h1>
    <p>Номер проверки: <strong>${escapeHtml(review.number)}</strong></p>
    <div class="meta">
      <p><strong>Материал:</strong> ${escapeHtml(review.title)}</p>
      <p><strong>Компания:</strong> ${escapeHtml(review.context.company)}</p>
      <p><strong>Продукт:</strong> ${escapeHtml(review.context.product)}</p>
      <p><strong>Канал:</strong> ${escapeHtml(CHANNEL_LABEL[review.context.channel] ?? review.context.channel)}</p>
      <p><strong>Категории:</strong> ${escapeHtml(report.detected_categories.map((item) => CATEGORY_LABEL[item] ?? item).join(', ') || 'Не определены')}</p>
      <p><strong>Итоговый риск:</strong> ${escapeHtml(report.overall_risk)}</p>
    </div>
    <p>${escapeHtml(report.summary)}</p>
    ${findings || '<p>Явных правовых рисков автоматически не обнаружено.</p>'}
    <div class="footer">
      <p><strong>Проверил:</strong> ${escapeHtml(review.reviewer || settings.signatory)}</p>
      <p>${escapeHtml(report.disclaimer)}</p>
      <p>${escapeHtml(settings.legalName)} · ИНН ${escapeHtml(settings.inn)}</p>
    </div>
  </body></html>`

  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${review.number}-zaklyuchenie.doc`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
