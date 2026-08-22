export interface ReviewMaterialRecord {
  id: string
  name: string
  type: string
  size: number
  savedAt: string
  blob: Blob
}

const DATABASE_NAME = 'pravoreklama-review-materials'
const DATABASE_VERSION = 1
const STORE_NAME = 'materials'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Браузер не поддерживает локальное хранилище материалов'))
      return
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть хранилище материалов'))
  })
}

export async function saveReviewMaterial(id: string, file: File): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const record: ReviewMaterialRecord = {
        id,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        savedAt: new Date().toISOString(),
        blob: file,
      }
      transaction.objectStore(STORE_NAME).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Не удалось сохранить материал'))
    })
  } finally {
    database.close()
  }
}

export async function getReviewMaterial(id: string): Promise<ReviewMaterialRecord | null> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve((request.result as ReviewMaterialRecord | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Не удалось получить материал'))
    })
  } finally {
    database.close()
  }
}
