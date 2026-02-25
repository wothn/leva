import { beforeEach } from 'vitest'

type StorageItems = Record<string, unknown>

type StorageKey = string | string[] | null | undefined

interface MockStorageArea {
  get: (keys?: StorageKey) => Promise<StorageItems>
  set: (items: StorageItems) => Promise<void>
  remove: (keys: string | string[]) => Promise<void>
  clear: () => Promise<void>
}

class MemoryStorageArea implements MockStorageArea {
  private store = new Map<string, unknown>()

  async get(keys?: StorageKey): Promise<StorageItems> {
    if (keys == null) {
      return Object.fromEntries(this.store)
    }

    if (typeof keys === 'string') {
      return this.store.has(keys) ? { [keys]: this.store.get(keys) } : {}
    }

    const result: StorageItems = {}
    for (const key of keys) {
      if (this.store.has(key)) {
        result[key] = this.store.get(key)
      }
    }
    return result
  }

  async set(items: StorageItems): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.store.set(key, value)
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys]
    for (const key of list) {
      this.store.delete(key)
    }
  }

  async clear(): Promise<void> {
    this.store.clear()
  }
}

const storageArea = new MemoryStorageArea()

const chromeMock = {
  storage: {
    local: storageArea,
  },
}

globalThis.chrome = chromeMock as unknown as typeof chrome

beforeEach(async () => {
  await storageArea.clear()
})
