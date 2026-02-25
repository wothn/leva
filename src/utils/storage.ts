import type {
  VocabularyStorage,
  VocabularyWord,
  LegacyVocabulary,
  DefinitionCache,
  ExtensionSettings,
} from '../types'
import { DEFAULT_SETTINGS } from '../types'

/**
 * 存储键名常量
 */
export const STORAGE_KEYS = {
  VOCABULARY: 'vocabulary_v2',
  LEGACY_VOCABULARY: 'vocabulary',
  SETTINGS: 'settings',
  CACHE_PREFIX: 'definition_',
} as const

/**
 * 当前数据版本
 */
const CURRENT_DATA_VERSION = 2

/**
 * 生词本存储管理
 */
export class VocabularyStorageManager {
  /**
   * 获取生词列表
   */
  static async getWords(): Promise<VocabularyWord[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VOCABULARY)
    const storage = result[STORAGE_KEYS.VOCABULARY] as VocabularyStorage | undefined

    if (storage && Array.isArray(storage.words)) {
      return storage.words
    }

    // 尝试迁移旧数据
    return this.migrateFromLegacy()
  }

  /**
   * 保存生词列表
   */
  static async saveWords(words: VocabularyWord[]): Promise<void> {
    const storage: VocabularyStorage = {
      words,
      version: CURRENT_DATA_VERSION,
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.VOCABULARY]: storage })
  }

  /**
   * 添加生词
   */
  static async addWord(word: VocabularyWord): Promise<boolean> {
    const words = await this.getWords()

    // 检查是否已存在
    if (words.some((w) => w.word.toLowerCase() === word.word.toLowerCase())) {
      return false
    }

    words.push(word)
    await this.saveWords(words)
    return true
  }

  /**
   * 删除生词
   */
  static async removeWord(wordId: string): Promise<void> {
    const words = await this.getWords()
    const filtered = words.filter((w) => w.id !== wordId)
    await this.saveWords(filtered)
  }

  /**
   * 更新生词
   */
  static async updateWord(updatedWord: VocabularyWord): Promise<void> {
    const words = await this.getWords()
    const index = words.findIndex((w) => w.id === updatedWord.id)

    if (index !== -1) {
      words[index] = updatedWord
      await this.saveWords(words)
    }
  }

  /**
   * 从旧版数据迁移
   */
  private static async migrateFromLegacy(): Promise<VocabularyWord[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LEGACY_VOCABULARY)
    const legacyWords = (result[STORAGE_KEYS.LEGACY_VOCABULARY] || []) as LegacyVocabulary

    if (!Array.isArray(legacyWords) || legacyWords.length === 0) {
      return []
    }

    // 转换为新格式
    const now = Date.now()
    const words: VocabularyWord[] = legacyWords.map((word) => ({
      id: `${now}_${Math.random().toString(36).substring(2, 11)}`,
      word: word.toLowerCase(),
      addedAt: now,
      reviewCount: 0,
      proficiency: 'new',
      tags: [],
    }))

    // 保存为新格式
    await this.saveWords(words)

    // 可选：删除旧数据
    // await chrome.storage.local.remove(STORAGE_KEYS.LEGACY_VOCABULARY)

    return words
  }
}

/**
 * 设置存储管理
 */
export class SettingsStorageManager {
  /**
   * 获取设置
   */
  static async getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
    const savedSettings = result[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
    return { ...DEFAULT_SETTINGS, ...savedSettings }
  }

  /**
   * 保存设置
   */
  static async saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings()
    const updated = { ...current, ...settings }
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated })
  }

  /**
   * 重置设置
   */
  static async resetSettings(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS })
  }
}

/**
 * 缓存存储管理
 */
export class CacheStorageManager {
  /**
   * 缓存过期时间 (24小时)
   */
  private static readonly CACHE_EXPIRATION = 24 * 60 * 60 * 1000

  /**
   * 获取缓存键
   */
  private static getCacheKey(word: string): string {
    return `${STORAGE_KEYS.CACHE_PREFIX}${word.toLowerCase()}`
  }

  /**
   * 从缓存获取释义
   */
  static async get(word: string): Promise<DefinitionCache | null> {
    const key = this.getCacheKey(word)
    const result = await chrome.storage.local.get(key)
    const cache = result[key] as DefinitionCache | undefined

    if (!cache) return null

    // 检查是否过期
    if (Date.now() > cache.expiresAt) {
      await this.remove(word)
      return null
    }

    return cache
  }

  /**
   * 保存到缓存
   */
  static async save(word: string, data: DefinitionCache['data']): Promise<void> {
    const now = Date.now()
    const cache: DefinitionCache = {
      word: word.toLowerCase(),
      data,
      fetchedAt: now,
      expiresAt: now + this.CACHE_EXPIRATION,
      source: 'cambridge',
    }

    await chrome.storage.local.set({ [this.getCacheKey(word)]: cache })
  }

  /**
   * 从缓存删除
   */
  static async remove(word: string): Promise<void> {
    await chrome.storage.local.remove(this.getCacheKey(word))
  }

  /**
   * 清除所有缓存
   */
  static async clearAll(): Promise<number> {
    const allData = await chrome.storage.local.get(null)
    const cacheKeys = Object.keys(allData).filter((key) =>
      key.startsWith(STORAGE_KEYS.CACHE_PREFIX)
    )

    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys)
    }

    return cacheKeys.length
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
