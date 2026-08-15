import type { Report } from '../types'
import { CHANNEL_LABEL } from '../labels'
import { FindingCard } from './FindingCard'

export function ReportView({ report }: { report: Report }) {
  const r = report
  const generatedAt = new Date().toLocaleString('ru-RU')
  return (
    <div className="report">
      <div className="report__toolbar">
        <div className="report__print-title">
          Отчёт о проверке рекламы · {generatedAt}
        </div>
        <button className="btn btn--ghost" onClick={() => window.print()}>
          🖨 Скачать PDF / печать
        </button>
      </div>

      <p className="report__summary">{r.summary}</p>

      {(r.meta.company_description || r.meta.product_description) && (
        <div className="report-context">
          {r.meta.company_description && (
            <div><span>Компания</span><p>{r.meta.company_description}</p></div>
          )}
          {r.meta.product_description && (
            <div><span>Продукт</span><p>{r.meta.product_description}</p></div>
          )}
        </div>
      )}

      {r.detected_categories.length > 0 && (
        <div className="chips">
          <span className="chips__label">Категории:</span>
          {r.detected_categories.map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
      )}

      <div className="report__meta">
        {r.meta.channel && <span>Канал: {CHANNEL_LABEL[r.meta.channel] ?? r.meta.channel}</span>}
        <span>Правил: {r.meta.rules_findings}</span>
        {r.meta.llm_used && <span>ИИ-находок: {r.meta.llm_findings}</span>}
      </div>

      {r.meta.warnings.length > 0 && (
        <div className="warnings">
          {r.meta.warnings.map((w, i) => (
            <div key={i} className="warnings__item">⚠️ {w}</div>
          ))}
        </div>
      )}

      {r.findings.length === 0 ? (
        <div className="empty">
          ✅ Явных правовых рисков не обнаружено. Рекомендуется финальная проверка юристом.
        </div>
      ) : (
        <div className="findings">
          {r.findings.map((f, i) => (
            <FindingCard key={f.id} finding={f} index={i} />
          ))}
        </div>
      )}

      {r.extracted_text && (
        <details className="extracted">
          <summary>Проанализированный текст</summary>
          <pre>{r.extracted_text}</pre>
        </details>
      )}

      <div className="disclaimer">{r.disclaimer}</div>
    </div>
  )
}
