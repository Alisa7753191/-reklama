import { useEffect, useState } from 'react'
import { analyzeImage, analyzeText, analyzeUrl, getHealth } from './api'
import type { AnalysisContext, Report } from './types'
import { InputPanel } from './components/InputPanel'
import { ReportView } from './components/ReportView'

type WizardStep = 1 | 2 | 3

const STEP_LABELS = ['Компания', 'Продукт', 'Проверка']

export default function App() {
  const [step, setStep] = useState<WizardStep>(1)
  const [company, setCompany] = useState('')
  const [product, setProduct] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null)

  const context: AnalysisContext = {
    company_description: company.trim(),
    product_description: product.trim(),
  }

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

  function openStep(nextStep: WizardStep) {
    setError(null)
    setStep(nextStep)
  }

  return (
    <div className="app">
      <header className="header">
        <button className="brand" type="button" onClick={() => openStep(1)}>
          <span className="brand__mark" aria-hidden="true">PR</span>
          <span>
            <span className="brand__name">ПравоРеклама</span>
            <span className="brand__caption">LEGAL AD CHECK</span>
          </span>
        </button>

        <div className="header__right">
          <span className="secure-label"><span /> Данные не сохраняются</span>
          {llmEnabled === true && <span className="ai-label">Правила + ИИ</span>}
        </div>
      </header>

      <main className="main">
        <nav className="stepper" aria-label="Этапы проверки">
          {STEP_LABELS.map((label, index) => {
            const number = (index + 1) as WizardStep
            const state = step === number ? 'active' : step > number ? 'done' : 'idle'
            return (
              <button
                key={label}
                type="button"
                className={`stepper__item stepper__item--${state}`}
                onClick={() => number < step && openStep(number)}
                disabled={number > step || loading}
                aria-current={step === number ? 'step' : undefined}
              >
                <span className="stepper__number">{state === 'done' ? '✓' : `0${number}`}</span>
                <span className="stepper__label">{label}</span>
              </button>
            )
          })}
        </nav>

        {step < 3 ? (
          <section className="onboarding">
            <div className="onboarding__story">
              <p className="eyebrow">ЮРИДИЧЕСКИЙ АССИСТЕНТ</p>
              <h1>Проверьте рекламу<br /><span>до публикации.</span></h1>
              <p className="onboarding__lead">
                Найдём риски по законодательству РФ, объясним каждое замечание
                и предложим безопасную формулировку.
              </p>

              <div className="feature-list">
                <div><span>01</span><p><b>Контекстный анализ</b>Учитываем сферу бизнеса и продукт</p></div>
                <div><span>02</span><p><b>Понятные выводы</b>Риск, норма закона и способ исправить</p></div>
                <div><span>03</span><p><b>Три формата</b>Текст, ссылка на лендинг или изображение</p></div>
              </div>
            </div>

            <div className="question-card">
              <div className="question-card__topline">
                <span>ШАГ {step} ИЗ 3</span>
                <span>{Math.round((step / 3) * 100)}%</span>
              </div>
              <div className="progress-track"><span style={{ width: `${(step / 3) * 100}%` }} /></div>

              {step === 1 ? (
                <>
                  <p className="question-card__kicker">Сначала познакомимся</p>
                  <h2>Чем занимается<br />ваша компания?</h2>
                  <p className="question-card__hint">
                    Опишите сферу деятельности в одном–двух предложениях.
                  </p>
                  <textarea
                    autoFocus
                    className="wizard-input"
                    rows={5}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Например: банк для малого бизнеса, сеть медицинских клиник, онлайн-магазин одежды…"
                  />
                  <div className="question-card__actions question-card__actions--end">
                    <button
                      className="btn btn--primary btn--wide"
                      type="button"
                      disabled={!company.trim()}
                      onClick={() => openStep(2)}
                    >
                      Продолжить <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="question-card__kicker">Теперь о рекламе</p>
                  <h2>Какой продукт<br />вы рекламируете?</h2>
                  <p className="question-card__hint">
                    Укажите конкретный товар или услугу и важные особенности предложения.
                  </p>
                  <textarea
                    autoFocus
                    className="wizard-input"
                    rows={5}
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Например: вклад со ставкой до 18% годовых для новых клиентов…"
                  />
                  <div className="question-card__actions">
                    <button className="btn btn--secondary" type="button" onClick={() => openStep(1)}>
                      ← Назад
                    </button>
                    <button
                      className="btn btn--primary"
                      type="button"
                      disabled={!product.trim()}
                      onClick={() => openStep(3)}
                    >
                      К проверке <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="checker">
            <div className="checker__heading">
              <div>
                <p className="eyebrow">ШАГ 3 · ПРОВЕРКА</p>
                <h1>Добавьте рекламу</h1>
                <p>Выберите формат материала — остальное проверим автоматически.</p>
              </div>
              <button className="edit-context" type="button" onClick={() => openStep(1)} disabled={loading}>
                Изменить ответы
              </button>
            </div>

            <div className="context-card">
              <div>
                <span>КОМПАНИЯ</span>
                <p>{company}</p>
              </div>
              <div>
                <span>ПРОДУКТ</span>
                <p>{product}</p>
              </div>
            </div>

            <InputPanel
              loading={loading}
              onAnalyzeText={(text, channel) => run(() => analyzeText(text, channel, context))}
              onAnalyzeUrl={(url, channel) => run(() => analyzeUrl(url, channel, context))}
              onAnalyzeImage={(file, channel) => run(() => analyzeImage(file, channel, context))}
            />

            {error && <div className="error" role="alert">{error}</div>}

            {loading && (
              <div className="loading" aria-live="polite">
                <div className="spinner" />
                <div><b>Проверяем материал</b><span>Сопоставляем рекламу с требованиями закона…</span></div>
              </div>
            )}

            {report && !loading && <ReportView report={report} />}
          </section>
        )}
      </main>

      <footer className="footer">
        <span>© 2026 ПравоРеклама</span>
        <span>Инструмент поддержки решений · Не является юридической консультацией</span>
      </footer>
    </div>
  )
}
