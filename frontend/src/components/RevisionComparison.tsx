import { useMemo, useState } from 'react'
import type { ReviewVersion } from '../workspace'

interface DiffPart {
  type: 'same' | 'added' | 'removed'
  value: string
}

function tokenize(value: string) {
  return value.split(/(\s+|[.,!?;:()«»“”"—–-]+)/).filter(Boolean)
}

function wordDiff(before: string, after: string): DiffPart[] {
  const left = tokenize(before)
  const right = tokenize(after)
  const result: DiffPart[] = []
  let i = 0
  let j = 0
  const push = (type: DiffPart['type'], value: string) => {
    const previous = result[result.length - 1]
    if (previous?.type === type) previous.value += value
    else result.push({ type, value })
  }

  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      push('same', left[i]); i += 1; j += 1; continue
    }
    if (i >= left.length) { push('added', right[j]); j += 1; continue }
    if (j >= right.length) { push('removed', left[i]); i += 1; continue }

    let leftMatch = -1
    let rightMatch = -1
    for (let offset = 1; offset <= 16; offset += 1) {
      if (leftMatch === -1 && i + offset < left.length && left[i + offset] === right[j]) leftMatch = offset
      if (rightMatch === -1 && j + offset < right.length && right[j + offset] === left[i]) rightMatch = offset
    }
    if (leftMatch !== -1 && (rightMatch === -1 || leftMatch <= rightMatch)) {
      push('removed', left.slice(i, i + leftMatch).join('')); i += leftMatch
    } else if (rightMatch !== -1) {
      push('added', right.slice(j, j + rightMatch).join('')); j += rightMatch
    } else {
      push('removed', left[i]); push('added', right[j]); i += 1; j += 1
    }
  }
  return result
}

export function RevisionComparison({ versions, currentText }: { versions: ReviewVersion[]; currentText: string }) {
  const defaultLeft = versions.length > 1 ? versions[versions.length - 2].id : versions[0]?.id ?? 'editor'
  const [leftId, setLeftId] = useState(defaultLeft)
  const [rightId, setRightId] = useState('editor')
  const choices = [...versions.map((version) => ({ id: version.id, label: `v${version.number}`, text: version.text })), { id: 'editor', label: 'Текущий редактор', text: currentText }]
  const before = choices.find((item) => item.id === leftId)?.text ?? ''
  const after = choices.find((item) => item.id === rightId)?.text ?? currentText
  const parts = useMemo(() => wordDiff(before, after), [before, after])
  const changed = parts.filter((part) => part.type !== 'same').reduce((sum, part) => sum + part.value.length, 0)

  return <section className="revision-comparison">
    <header><div><p className="eyebrow">СРАВНЕНИЕ РЕДАКЦИЙ</p><h2>Что изменилось в тексте</h2></div><span>{changed.toLocaleString('ru-RU')} изменённых знаков</span></header>
    <div className="revision-selectors">
      <label>Исходная версия<select value={leftId} onChange={(event) => setLeftId(event.target.value)}>{choices.map((item) => <option key={`left-${item.id}`} value={item.id}>{item.label}</option>)}</select></label>
      <span>→</span>
      <label>Новая версия<select value={rightId} onChange={(event) => setRightId(event.target.value)}>{choices.map((item) => <option key={`right-${item.id}`} value={item.id}>{item.label}</option>)}</select></label>
    </div>
    <div className="diff-legend"><span><i className="added" />Добавлено</span><span><i className="removed" />Удалено</span></div>
    <div className="diff-view">{parts.map((part, index) => <span key={`${part.type}-${index}`} className={`diff-${part.type}`}>{part.value}</span>)}</div>
  </section>
}
