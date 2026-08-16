import { useState } from 'react'
import { analyzeText } from '../api'
import {
  buildPromotionRulesReport,
  downloadPromotionRulesAsWord,
  EMPTY_PROMOTION_DRAFT,
  generatePromotionRules,
  getPromotionReadiness,
  PROMOTION_KIND_LABEL,
  PROMOTION_PRESETS,
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

  function changeKind(kind: PromotionDraft['kind']) {
    setDraft((current) => ({ ...current, kind, ...PROMOTION_PRESETS[kind], separateParticipationFee: false }))
  }

  function switchMode(next: Mode) {
    setMode(next); setReport(null); setError(''); setNotice('')
  }

  function composeRules(event?: React.FormEvent) {
    event?.preventDefault()
    if (draft.separateParticipationFee && draft.randomSelection) {
      setError('Нельзя составить безопасный проект: отдельная плата за участие вместе со случайным выигрышем создаёт критический риск незаконной лотереи. Уберите плату или измените способ определения результата.')
      return
    }
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

  const readiness = getPromotionReadiness(draft)
  const criticalQualificationRisk = readiness.some((item) => item.critical)
  const incompleteSections = readiness.filter((item) => !item.ready && !item.critical).length

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

      {mode === 'compose' && !rulesText && <>
        <section className="promotion-method" aria-label="Этапы составления правил">
          <div><span>01</span><b>Квалифицировать</b><small>Покупка, плата, случайность или конкурс</small></div>
          <div><span>02</span><b>Развести сроки</b><small>Акция, заявки, выбор и вручение</small></div>
          <div><span>03</span><b>Зафиксировать механику</b><small>Лимиты, проверка и отказ</small></div>
          <div><span>04</span><b>Закрыть выдачу</b><small>Связь, документы, данные и налоги</small></div>
        </section>

        <section className="promotion-quick-draft">
          <div><b>Можно начать с черновика</b><p>Заполните только то, что уже известно. В остальных местах останутся заметные пометки «указать…» — их можно дополнить прямо в готовом тексте.</p></div>
          <button type="button" className="btn btn--primary" disabled={criticalQualificationRisk} onClick={() => composeRules()}>Создать черновик сейчас →</button>
        </section>

        <form className="promotion-builder" onSubmit={composeRules}>
          <section className="workspace-card promotion-builder__main">
            <div className="section-head"><div><span>КВАЛИФИКАЦИЯ И РОЛИ</span><h2>Кто и что проводит</h2></div><b>1 / 4</b></div>
            <div className="form-grid">
              <label className="form-grid__wide">Название акции<input className="input" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Например: Лето с подарками" /></label>
              <label className="form-grid__wide">Вид мероприятия<select value={draft.kind} onChange={(event) => changeKind(event.target.value as PromotionDraft['kind'])}>{Object.entries(PROMOTION_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small className="field-hint">При смене вида подставляется рекомендуемая механика</small></label>
              <label className="form-grid__wide">Организатор<input className="input" value={draft.organizer} onChange={(event) => update('organizer', event.target.value)} placeholder="Полное наименование юридического лица или ИП" /></label>
              <label className="form-grid__wide">Реквизиты и контакты<textarea className="textarea compact-textarea" value={draft.organizerDetails} onChange={(event) => update('organizerDetails', event.target.value)} placeholder="Адрес, ИНН, ОГРН, e-mail и телефон" /></label>
              <label className="form-grid__wide">Технический оператор — если есть<input className="input" value={draft.technicalOperator} onChange={(event) => update('technicalOperator', event.target.value)} placeholder="Наименование, реквизиты и функции" /></label>
              <label>Территория<input className="input" value={draft.territory} onChange={(event) => update('territory', event.target.value)} /></label>
              <label>Адрес полных правил<input className="input" type="url" value={draft.rulesUrl} onChange={(event) => update('rulesUrl', event.target.value)} placeholder="https://site.ru/rules" /></label>
              <label className="form-grid__wide">Кто может участвовать<textarea className="textarea compact-textarea" value={draft.participants} onChange={(event) => update('participants', event.target.value)} /></label>
            </div>
            <div className="promotion-switches">
              <label><input type="checkbox" checked={draft.purchaseRequired} onChange={(event) => update('purchaseRequired', event.target.checked)} /><span><b>Нужна покупка</b><small>Товар продаётся по обычной цене</small></span></label>
              <label><input type="checkbox" checked={draft.randomSelection} onChange={(event) => update('randomSelection', event.target.checked)} /><span><b>Случайный выбор</b><small>Победитель определяется случайно</small></span></label>
              <label className={draft.separateParticipationFee ? 'is-danger' : ''}><input type="checkbox" checked={draft.separateParticipationFee} onChange={(event) => update('separateParticipationFee', event.target.checked)} /><span><b>Отдельная плата за участие</b><small>Не стоимость обычной покупки</small></span></label>
            </div>
          </section>

          <section className="workspace-card promotion-builder__main">
            <div className="section-head"><div><span>КАЛЕНДАРЬ</span><h2>Все юридически значимые сроки</h2></div><b>2 / 4</b></div>
            <div className="form-grid">
              <label>Начало акции<input className="input" type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} /></label>
              <label>Окончание акции<input className="input" type="date" min={draft.startDate} value={draft.endDate} onChange={(event) => update('endDate', event.target.value)} /></label>
              <label>Начало приёма заявок<input className="input" type="date" min={draft.startDate} max={draft.endDate} value={draft.entryStartDate} onChange={(event) => update('entryStartDate', event.target.value)} /></label>
              <label>Конец приёма заявок<input className="input" type="date" min={draft.entryStartDate || draft.startDate} max={draft.endDate} value={draft.entryEndDate} onChange={(event) => update('entryEndDate', event.target.value)} /></label>
              <label>Дата выбора победителей<input className="input" type="date" min={draft.entryEndDate} max={draft.endDate} value={draft.winnerDate} onChange={(event) => update('winnerDate', event.target.value)} /></label>
              <label>Выдать призы не позднее<input className="input" type="date" min={draft.winnerDate} max={draft.endDate} value={draft.deliveryEndDate} onChange={(event) => update('deliveryEndDate', event.target.value)} /></label>
            </div>
            <div className="promotion-guidance"><b>Почему это важно</b><p>В реальных правилах общий срок включает не только регистрацию, но и определение победителей и выдачу призов. Конструктор проверяет, что период заявок находится внутри общего срока.</p></div>
          </section>

          <section className="workspace-card promotion-builder__main">
            <div className="section-head"><div><span>ЗАЯВКИ И ПРОВЕРКА</span><h2>Что делает участник</h2></div><b>3 / 4</b></div>
            <div className="promotion-long-fields promotion-long-fields--single">
              <label>Действия участника<textarea className="textarea" value={draft.mechanics} onChange={(event) => update('mechanics', event.target.value)} placeholder="По шагам: покупка, регистрация чека, заявка…" /></label>
              <label>Количество заявок и дубли<textarea className="textarea" value={draft.entryLimit} onChange={(event) => update('entryLimit', event.target.value)} /></label>
              <label>Как проверяются заявки или чеки<textarea className="textarea" value={draft.validationProcedure} onChange={(event) => update('validationProcedure', event.target.value)} /></label>
              <label>Исчерпывающие основания отклонения<textarea className="textarea" value={draft.rejectionGrounds} onChange={(event) => update('rejectionGrounds', event.target.value)} /></label>
            </div>
          </section>

          <section className="workspace-card promotion-builder__main">
            <div className="section-head"><div><span>ПОБЕДИТЕЛИ И ПРИЗЫ</span><h2>Как завершить акцию</h2></div><b>4 / 4</b></div>
            <div className="promotion-long-fields promotion-long-fields--single">
              <label>Призовой фонд<textarea className="textarea" value={draft.prizes} onChange={(event) => update('prizes', event.target.value)} placeholder="Название, количество и стоимость каждого вида призов" /></label>
              <label>Определение победителей<textarea className="textarea" value={draft.winnerMethod} onChange={(event) => update('winnerMethod', event.target.value)} /></label>
              <label>Как уведомить победителя<textarea className="textarea" value={draft.notificationMethod} onChange={(event) => update('notificationMethod', event.target.value)} /></label>
              <label>Срок ответа победителя<input className="input" value={draft.responseDeadline} onChange={(event) => update('responseDeadline', event.target.value)} placeholder="Например: 5 рабочих дней" /></label>
              <label>Документы победителя<textarea className="textarea" value={draft.winnerDocuments} onChange={(event) => update('winnerDocuments', event.target.value)} /></label>
              <label>Порядок вручения<textarea className="textarea" value={draft.prizeDelivery} onChange={(event) => update('prizeDelivery', event.target.value)} /></label>
              <label>Невостребованные призы<textarea className="textarea" value={draft.unclaimedPrizes} onChange={(event) => update('unclaimedPrizes', event.target.value)} /></label>
            </div>
            <div className="promotion-switches">
              <label><input type="checkbox" checked={draft.collectsPersonalData} onChange={(event) => update('collectsPersonalData', event.target.checked)} /><span><b>Персональные данные</b><small>Контакты или документы победителя</small></span></label>
              <label><input type="checkbox" checked={draft.sendsMarketing} onChange={(event) => update('sendsMarketing', event.target.checked)} /><span><b>Рекламные рассылки</b><small>Потребуется отдельное согласие</small></span></label>
              <label><input type="checkbox" checked={draft.publishesWinners} onChange={(event) => update('publishesWinners', event.target.checked)} /><span><b>Публикация победителей</b><small>Потребуется согласие на распространение</small></span></label>
            </div>
          </section>

          <section className="workspace-card promotion-readiness promotion-builder__wide">
            <div className="section-head"><div><span>LEGAL READINESS</span><h2>Готовность проекта</h2></div><b>{readiness.filter((item) => item.ready).length} / {readiness.length}</b></div>
            <div className="promotion-readiness__grid">{readiness.map((item) => <article key={item.id} className={item.critical ? 'is-critical' : item.ready ? 'is-ready' : ''}><span>{item.critical ? '!' : item.ready ? '✓' : '○'}</span><div><b>{item.label}</b><small>{item.detail}</small></div></article>)}</div>
            {criticalQualificationRisk && <div className="promotion-danger" role="alert"><b>Критический риск лотереи</b><p>Отдельная плата за участие и случайный выигрыш не могут быть автоматически оформлены как обычная рекламная акция. Генерация заблокирована до изменения механики.</p></div>}
            {error && <div className="error" role="alert">{error}</div>}
            <div className="promotion-builder__submit"><p>{incompleteSections > 0 ? `Можно создать черновик сейчас. Незавершённые разделы (${incompleteSections}) будут отмечены в тексте подсказками «указать…».` : 'Все основные разделы заполнены. После создания проверьте формулировки и запустите юридическую проверку.'}</p><button className="btn btn--primary" disabled={criticalQualificationRisk}>{criticalQualificationRisk ? 'Измените опасную механику' : 'Составить проект правил →'}</button></div>
          </section>
        </form>
      </>}

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
