import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  CacheStorageManager,
  SettingsStorageManager,
  VocabularyStorageManager,
} from './storage'
import { DEFAULT_SETTINGS } from '../types'
import type { VocabularyWord } from '../types'

const EXPIRATION_MS = 24 * 60 * 60 * 1000

describe('storage managers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds vocabulary words and prevents duplicates', async () => {
    const word: VocabularyWord = {
      id: 'word-1',
      word: 'Test',
      addedAt: Date.now(),
      reviewCount: 0,
      proficiency: 'new',
      tags: [],
    }

    const first = await VocabularyStorageManager.addWord(word)
    const second = await VocabularyStorageManager.addWord({ ...word, id: 'word-2' })

    expect(first).toBe(true)
    expect(second).toBe(false)

    const words = await VocabularyStorageManager.getWords()
    expect(words).toHaveLength(1)
    expect(words[0]?.word).toBe('Test')
  })

  it('merges settings with defaults when saving', async () => {
    await SettingsStorageManager.saveSettings({ darkMode: true })
    const settings = await SettingsStorageManager.getSettings()

    expect(settings.darkMode).toBe(true)
    expect(settings.highlightColor).toBe(DEFAULT_SETTINGS.highlightColor)
  })

  it('expires cached definitions after 24 hours', async () => {
    const now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    await CacheStorageManager.save('Test', {
      word: 'test',
      dictionary: 'cambridge',
      pronunciations: [],
      definitions: [],
    })

    const fresh = await CacheStorageManager.get('Test')
    expect(fresh).not.toBeNull()

    vi.spyOn(Date, 'now').mockReturnValue(now + EXPIRATION_MS + 1)
    const expired = await CacheStorageManager.get('Test')
    expect(expired).toBeNull()
  })
})
