import { useEffect, useState } from 'react'
import { analyzeImage, analyzeText, analyzeUrl, getHealth } from './api'
import type { Report } from './types'
import { InputPanel } from './components/InputPanel'
import { ReportView } from './components/ReportView'

export default function App() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    getHealth()
      .then((h) => setLlmEnabled(h.llm_enabled))
      .catch(() => setLlmEnabled(null))
  }, [])

  async function run(fn: () => Promise<Report>) {
    setLoading(true)
    setError(null)
    try {
      setReport(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <span className="header__logo">⚖️</span>
          <div>
            <h1 className="header__title">ПравоРеклама</h1>
            <p className="header__subtitle">
              Проверка рекламных коммуникаций на правовые риски по законодательству РФ
            </p>
          </div>
        </div>
        {llmEnabled === false && (
          <div className="header__badge header__badge--warn">
            Режим «только правила» · ИИ-анализ выключен
          </div>
        )}
        {llmEnabled === true && (
          <div className="header__badge header__badge--ok">Гибрид: правила + ИИ</div>
        )}
      </header>

      <main className="main">
        <InputPanel
          loading={loading}
          onAnalyzeText={(t) => run(() => analyzeText(t))}
          onAnalyzeUrl={(u) => run(() => analyzeUrl(u))}
          onAnalyzeImage={(f) => run(() => analyzeImage(f))}
        />

        {error && <div className="error">❌ {error}</div>}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            Анализирую рекламу на правовые риски…
          </div>
        )}

        {report && !loading && <ReportView report={report} />}
      </main>

      <footer className="footer">
        Инструмент поддержки решений. Не является юридической консультацией.
      </footer>
    </div>
  )
}
