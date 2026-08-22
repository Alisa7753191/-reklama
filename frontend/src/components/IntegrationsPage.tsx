import { useState } from 'react'

const ENDPOINTS = [
  { method: 'POST', path: '/api/analyze', purpose: 'Текст и URL' },
  { method: 'POST', path: '/api/analyze/image', purpose: 'Изображения и OCR' },
  { method: 'POST', path: '/api/analyze/file', purpose: 'PDF, Word, PowerPoint и медиа' },
  { method: 'POST', path: '/api/rewrite', purpose: 'Осторожная редакция' },
]

export function IntegrationsPage() {
  const [notice, setNotice] = useState('')
  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    setNotice('Адрес API скопирован')
    window.setTimeout(() => setNotice(''), 1800)
  }

  return <>
    <div className="workspace-page-head"><div><p className="eyebrow">CONNECTION HUB</p><h1>API и интеграции</h1><p>Работающие каналы экспорта и точки подключения корпоративных систем заказчика.</p></div><a className="btn btn--primary" href="/docs" target="_blank" rel="noreferrer">Открыть документацию API ↗</a></div>
    {notice && <div className="export-notice" role="status">✓ {notice}</div>}
    <section className="integration-grid">
      <article className="workspace-card integration-card integration-card--active"><header><span>W</span><i>РАБОТАЕТ</i></header><h2>Microsoft Word</h2><p>Брендированное заключение выгружается из каждой проверки одним нажатием.</p><footer>Формат отчёта · комментарии · правовые основания</footer></article>
      <article className="workspace-card integration-card integration-card--active"><header><span>@</span><i>РАБОТАЕТ</i></header><h2>Корпоративная почта</h2><p>Передавайте ссылку на дело через установленный почтовый клиент. Серверная отправка подключается через SMTP или Microsoft Graph заказчика.</p><a className="btn btn--secondary" href="mailto:?subject=Материал%20на%20юридическую%20проверку&body=Откройте%20рабочее%20пространство%20ПравоРеклама:%20https://pravoreklama.onrender.com/">Создать письмо</a></article>
      <article className="workspace-card integration-card"><header><span>GD</span><i>НУЖЕН OAUTH</i></header><h2>Google Docs</h2><p>Готовая редакция экспортируется в Word и открывается в Google Docs. Прямая запись в документы включается после выдачи OAuth-доступа домена клиента.</p><footer>Не запрашиваем доступ к документам без подключения заказчика</footer></article>
      <article className="workspace-card integration-card"><header><span>TS</span><i>НУЖЕН WEBHOOK</i></header><h2>Системы задач</h2><p>API позволяет создавать задачу при высоком риске и обновлять её после согласования. Для Jira, Битрикс24, Asana или другой системы понадобится webhook клиента.</p><footer>События: создано · назначено · исправлено · согласовано</footer></article>
    </section>
    <section className="workspace-card api-console"><div className="section-head"><div><span>REST API</span><h2>Точки интеграции</h2></div><b>JSON / multipart</b></div><div className="api-endpoints">{ENDPOINTS.map((endpoint) => <button key={endpoint.path} type="button" onClick={() => copy(`${window.location.origin}${endpoint.path}`)}><span>{endpoint.method}</span><code>{endpoint.path}</code><p>{endpoint.purpose}</p><i>копировать</i></button>)}</div><div className="api-note"><b>Для пилота</b><p>API доступен на домене продукта. Перед промышленным внедрением необходимо добавить корпоративную авторизацию, персональные ключи, лимиты и журнал вызовов.</p></div></section>
  </>
}
