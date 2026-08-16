import { useState } from 'react'
import { analyzeText } from '../api'
import {
  buildPromotionRulesReport,
  downloadPromotionRulesAsWord,
  EMPTY_PROMOTION_DRAFT,
  generatePromotionRules,
  PROMOTION_KIND_LABEL,
  type PromotionDraft,
} from '../promotionRules'
import type { Report } from '../types'
import type { WorkspaceSettings } from '../workspace'
import { ReportView } from './ReportView'

type Mode = 'check' | 'compose'

export function PromotionRulesPage({ settings }: { settings: WorkspaceSettings }) {
  const [mode, setMode] = useState<Mode>('check')
  const [rulesText, setRulesText] = useState('')
  const [draft, setDraft] = useState<PromotionDraft>(() => ({ ...EMPTY_PROMOTION_DRAFT, organizer: settings.legalName, organizerDetails: `ИНН ${settings.inn}` }))
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function update<K extends keyof PromotionDraft>(key: K, value: PromotionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function switchMode(next: Mode) {
    setMode(next); setReport(null); setError(''); setNotice('')
  }

  function composeRules(event: React.FormEvent) {
    event.preventDefault()
    const generated = generatePromotionRules(draft)
    setRulesText(generated); setReport(null); setError(''); setNotice('Проект правил составлен. Проверьте формулировки и запустите юридическую проверку.')
  }

  async function checkRules() {
    if (!rulesText.trim()) return
    setLoading(true); setError(''); setNotice('')
    try {
      const base = await analyzeText(rulesText, 'internet', {
        company_description: draft.organizer || settings.legalName,
        product_description: `${PROMOTION_KIND_LABEL[draft.kind]}. Проверяются правила проведения, механика, призовой фонд и работа с участниками.`,
      })
      setReport(buildPromotionRulesReport(rulesText, base))
      setNotice('Проверка завершена. Текст остаётся в редакторе — замечания можно исправить и проверить повторно.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось проверить правила акции.')
    } finally {
      setLoading(false)
    }
  }

  const requiredDraftReady = Boolean(draft.name.trim() && draft.organizer.trim() && draft.startDate && draft.endDate && draft.mechanics.trim() && draft.prizes.trim() && draft.winnerMethod.trim())

  return (
    <>
      <div className="workspace-page-head promotion-page-head">
        <div><p className="eyebrow">PROMOTION LEGAL WORKSPACE</p><h1>Правила акций</h1><p>Составляйте и проверяйте правила стимулирующих мероприятий, конкурсов и розыгрышей.</p></div>
        <span className="promotion-law-chip">ФЗ № 38-ФЗ · ГК РФ · ФЗ № 152-ФЗ</span>
      </div>

      <div className="promotion-mode-tabs" role="tablist" aria-label="Режим работы с правилами">
        <button type="button" role="tab" aria-selected={mode === 'check'} className={mode === 'check' ? 'active' : ''} onClick={() => switchMode('check')}><span>01</span><b>Проверить готовые правила</b><small>Найти юридические риски и исправления</small></button>
        <button type="button" role="tab" aria-selected={mode === 'compose'} className={mode === 'compose' ? 'active' : ''} onClick={() => switchMode('compose')}><span>02</span><b>Составить правила</b><small>Собрать проект по параметрам акции</small></button>
      </div>

      {mode === 'compose' && !rulesText && <form className="promotion-builder" onSubmit={composeRules}>
        <section className="workspace-card promotion-builder__main">
          <div className="section-head"><div><span>ПАРАМЕТРЫ ДОКУМЕНТА</span><h2>Основные условия акции</h2></div><b>1 / 2</b></div>
          <div className="form-grid form-grid--three">
            <label className="form-grid__wide">Название акции<input className="input" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Например: Лето с подарками" required /></label>
            <label>Вид мероприятия<select value={draft.kind} onChange={(event) => update('kind', event.target.value as PromotionDraft['kind'])}>{Object.entries(PROMOTION_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="form-grid__wide">Организатор<input className="input" value={draft.organizer} onChange={(event) => update('organizer', event.target.value)} required /></label>
            <label>Реквизиты<input className="input" value={draft.organizerDetails} onChange={(event) => update('organizerDetails', event.target.value)} placeholder="Адрес, ИНН, ОГРН" /></label>
            <label>Дата начала<input className="input" type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} required /></label>
            <label>Дата окончания<input className="input" type="date" value={draft.endDate} onChange={(event) => update('endDate', event.target.value)} required /></label>
            <label>Территория<input className="input" value={draft.territory} onChange={(event) => update('territory', event.target.value)} /></label>
            <label className="form-grid__wide">Кто может участвовать<textarea className="textarea compact-textarea" value={draft.participants} onChange={(event) => update('participants', event.target.value)} /></label>
            <label>Ссылка на правила<input className="input" value={draft.rulesUrl} onChange={(event) => update('rulesUrl', event.target.value)} placeholder="https://site.ru/rules" /></label>
          </div>
        </section>
        <section className="workspace-card promotion-builder__main">
          <div className="section-head"><div><span>МЕХАНИКА И ПРИЗЫ</span><h2>Как проходит акция</h2></div><b>2 / 2</b></div>
          <div className="promotion-long-fields">
            <label>Действия участника<textarea className="textarea" value={draft.mechanics} onChange={(event) => update('mechanics', event.target.value)} placeholder="По шагам: покупка, регистрация чека, заявка…" required /></label>
            <label>Призовой фонд<textarea className="textarea" value={draft.prizes} onChange={(event) => update('prizes', event.target.value)} placeholder="Название, количество и стоимость призов" required /></label>
            <label>Определение победителей<textarea className="textarea" value={draft.winnerMethod} onChange={(event) => update('winnerMethod', event.target.value)} placeholder="Алгоритм, критерии, дата и протокол" required /></label>
            <label>Получение призов<textarea className="textarea" value={draft.prizeDelivery} onChange={(event) => update('prizeDelivery', event.target.value)} /></label>
          </div>
          <div className="promotion-switches">
            <label><input type="checkbox" checked={draft.purchaseRequired} onChange={(event) => update('purchaseRequired', event.target.checked)} /><span><b>Нужна покупка</b><small>Участие связано с приобретением товара</small></span></label>
            <label><input type="checkbox" checked={draft.randomSelection} onChange={(event) => update('randomSelection', event.target.checked)} /><span><b>Случайный выбор</b><small>Победитель определяется случайным способом</small></span></label>
            <label><input type="checkbox" checked={draft.collectsPersonalData} onChange={(event) => update('collectsPersonalData', event.target.checked)} /><span><b>Персональные данные</b><small>Собираются контакты или данные победителя</small></span></label>
            <label><input type="checkbox" checked={draft.publishesWinners} onChange={(event) => update('publishesWinners', event.target.checked)} /><span><b>Публикация победителей</b><small>Планируется публикация ФИО или фото</small></span></label>
          </div>
          <div className="promotion-builder__submit"><p>Проект является основой документа и требует проверки юристом с учётом фактической механики.</p><button className="btn btn--primary" disabled={!requiredDraftReady}>Составить проект правил →</button></div>
        </section>
      </form>}

      {(mode === 'check' || rulesText) && <section className="promotion-editor">
        <header><div><p className="eyebrow">{mode === 'compose' ? 'СОСТАВЛЕННЫЙ ПРОЕКТ' : 'ЮРИДИЧЕСКАЯ ПРОВЕРКА'}</p><h2>{mode === 'compose' ? 'Отредактируйте проект правил' : 'Вставьте полный текст правил'}</h2><p>Текст останется в редакторе после вывода рисков — замечания можно исправить и проверить повторно.</p></div>{mode === 'compose' && <button type="button" className="text-action" onClick={() => { setRulesText(''); setReport(null); setNotice('') }}>← Изменить параметры</button>}</header>
        <textarea className="textarea" value={rulesText} onChange={(event) => { setRulesText(event.target.value); setReport(null); setNotice(''); setError('') }} placeholder="Вставьте сюда правила акции, конкурса или розыгрыша целиком…" maxLength={80_000} disabled={loading} />
        <footer><span>{rulesText.length.toLocaleString('ru-RU')} / 80 000</span><div>{rulesText && <button type="button" className="btn btn--secondary" onClick={() => downloadPromotionRulesAsWord(rulesText, draft.name)}>Скачать Word</button>}<button type="button" className="btn btn--primary" disabled={loading || !rulesText.trim()} onClick={checkRules}>{loading ? 'Проверяем…' : report ? 'Проверить повторно' : 'Проверить правила'}</button></div></footer>
        {loading && <div className="loading"><div className="spinner" /><div><b>Проверяем правила акции</b><span>Квалифицируем механику, сроки, призы, данные участников и опасные условия…</span></div></div>}
        {notice && <div className="promotion-notice" role="status">✓ {notice}</div>}
        {error && <div className="error" role="alert">{error}</div>}
      </section>}

      {report && <section className="promotion-report"><div className="section-head"><div><span>ЮРИДИЧЕСКОЕ ЗАКЛЮЧЕНИЕ</span><h2>Риски и рекомендации</h2></div><b>{report.findings.length}</b></div><ReportView report={report} /></section>}
    </>
  )
}
