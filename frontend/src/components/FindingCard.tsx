import type { Finding } from '../types'
import { SOURCE_LABEL } from '../labels'
import { RiskBadge } from './RiskBadge'

export function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const f = finding
  return (
    <article className={`finding finding--${f.risk_level}`}>
      <header className="finding__head">
        <span className="finding__num">{index + 1}</span>
        <h3 className="finding__title">{f.title}</h3>
        <div className="finding__tags">
          <RiskBadge level={f.risk_level} small />
          <span className="tag tag--source">{SOURCE_LABEL[f.source] ?? f.source}</span>
        </div>
      </header>

      <p className="finding__desc">{f.description}</p>

      {f.evidence && (
        <blockquote className="finding__evidence">
          <span className="finding__evidence-label">Фрагмент рекламы</span>
          «{f.evidence}»
        </blockquote>
      )}

      <div className="finding__grid">
        {f.legal_basis.length > 0 && (
          <section className="block">
            <h4 className="block__title">📖 Правовое основание</h4>
            <ul className="block__list">
              {f.legal_basis.map((lb, i) => (
                <li key={i}>
                  <strong>{lb.law}</strong>, {lb.article}
                  {lb.title ? ` — ${lb.title}` : ''}
                  {lb.summary && <div className="muted">{lb.summary}</div>}
                  {lb.url && (
                    <a className="link" href={lb.url} target="_blank" rel="noreferrer">
                      источник ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {f.liability && (
          <section className="block">
            <h4 className="block__title">⚖️ Ответственность</h4>
            <p>
              <strong>{f.liability.koap_article}</strong>
              {f.liability.title ? ` — ${f.liability.title}` : ''}
            </p>
            <ul className="fines">
              {f.liability.fine_citizens && (
                <li>Граждане: <b>{f.liability.fine_citizens}</b></li>
              )}
              {f.liability.fine_officials && (
                <li>Должностные лица: <b>{f.liability.fine_officials}</b></li>
              )}
              {f.liability.fine_legal && (
                <li>Юридические лица: <b>{f.liability.fine_legal}</b></li>
              )}
            </ul>
            {f.liability.note && <div className="muted">{f.liability.note}</div>}
          </section>
        )}

        {f.mitigation.length > 0 && (
          <section className="block">
            <h4 className="block__title">🛠 Меры минимизации</h4>
            <ul className="block__list">
              {f.mitigation.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        {f.practice.length > 0 && (
          <section className="block">
            <h4 className="block__title">🏛 Практика ФАС / судов</h4>
            <ul className="block__list">
              {f.practice.map((p, i) => (
                <li key={i}>
                  <strong>{p.type}:</strong> {p.reference}
                  <div className="muted">{p.summary}</div>
                  {p.url && (
                    <a className="link" href={p.url} target="_blank" rel="noreferrer">
                      подробнее ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  )
}
