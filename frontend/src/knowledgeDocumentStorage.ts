export interface KnowledgeDocumentRecord {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  blob: Blob
}

const DATABASE_NAME = 'pravoreklama-knowledge-documents'
const DATABASE_VERSION = 1
const STORE_NAME = 'documents'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Браузер не поддерживает сохранение документов'))
      return
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть хранилище документов'))
  })
}

export async function saveKnowledgeDocument(id: string, file: File): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const record: KnowledgeDocumentRecord = {
        id,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        blob: file,
      }
      transaction.objectStore(STORE_NAME).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Не удалось сохранить документ'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Сохранение документа прервано'))
    })
  } finally {
    database.close()
  }
}

async function getKnowledgeDocument(id: string): Promise<KnowledgeDocumentRecord | null> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve((request.result as KnowledgeDocumentRecord | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Не удалось получить документ'))
    })
  } finally {
    database.close()
  }
}

export async function downloadKnowledgeDocument(id: string): Promise<void> {
  const record = await getKnowledgeDocument(id)
  if (!record) throw new Error('Файл не найден в этом браузере')

  const url = URL.createObjectURL(record.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = record.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function formatDocumentSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} Б`
  if (bytes < 1_048_576) return `${Math.round(bytes / 1_024)} КБ`
  return `${(bytes / 1_048_576).toFixed(1)} МБ`
}
