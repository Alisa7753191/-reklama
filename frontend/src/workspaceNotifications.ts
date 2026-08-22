import type { WorkspaceData, WorkspaceView } from './workspace'

export interface WorkspaceNotification {
  id: string
  tone: 'green' | 'amber' | 'red' | 'blue'
  title: string
  text: string
  reviewId?: string
  view?: WorkspaceView
}

export function getWorkspaceNotifications(data: WorkspaceData): WorkspaceNotification[] {
  const now = Date.now()
  const currentUser = data.settings.signatory.split(',')[0].trim()
  const items: WorkspaceNotification[] = []

  for (const review of data.reviews) {
    if (review.status === 'lawyer_review' && (!review.reviewer || review.reviewer.includes(currentUser))) {
      items.push({ id: `assignment-${review.id}`, tone: 'blue', title: review.reviewer ? 'Проверка назначена вам' : 'Новая проверка ждёт назначения', text: `${review.number} · ${review.title}`, reviewId: review.id })
    }
    if (review.context.publishDate && review.status !== 'approved') {
      const days = Math.ceil((new Date(review.context.publishDate).getTime() - now) / 86_400_000)
      if (days >= 0 && days <= 5) items.push({ id: `deadline-${review.id}`, tone: days <= 1 ? 'red' : 'amber', title: days === 0 ? 'Публикация запланирована сегодня' : `До публикации ${days} дн.`, text: `${review.number} · ${review.title}`, reviewId: review.id })
    }
  }

  const dueMonitors = data.monitors.filter((item) => item.active && (!item.nextCheck || new Date(item.nextCheck).getTime() <= now)).length
  if (dueMonitors) items.push({ id: 'monitoring-due', tone: 'amber', title: 'Пора перепроверить публикации', text: `${dueMonitors} материалов требуют мониторинга`, view: 'monitoring' })
  return items.slice(0, 20)
}
