import type { Report } from '../types'
import { RISK_EMOJI, RISK_LABEL } from '../labels'
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

      <div className={`report__hero report__hero--${r.overall_risk}`}>
        <div className="report__light">{RISK_EMOJI[r.overall_risk]}</div>
        <div>
          <div className="report__hero-label">Итоговый уровень риска</div>
          <div className="report__hero-level">{RISK_LABEL[r.overall_risk]}</div>
        </div>
      </div>

      <p className="report__summary">{r.summary}</p>

      {r.detected_categories.length > 0 && (
        <div className="chips">
          <span className="chips__label">Категории:</span>
          {r.detected_categories.map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
      )}

      <div className="report__meta">
        <span>Правил: {r.meta.rules_findings}</span>
        <span>ИИ-находок: {r.meta.llm_findings}</span>
        <span>
          ИИ-анализ:{' '}
          {r.meta.llm_used ? `вкл (${r.meta.llm_provider})` : 'выкл (только правила)'}
        </span>
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
