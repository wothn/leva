/**
 * 发音信息
 */
export interface Pronunciation {
  /** 音标文本 */
  text: string
  /** 地区 (UK/US) */
  region: 'UK' | 'US'
  /** 音频 URL */
  audio?: string
  /** 词性 */
  partOfSpeech?: string
}

/**
 * 例句
 */
export interface Example {
  /** 英文例句 */
  eng: string
  /** 中文翻译 */
  chi: string
}

/**
 * 释义条目
 */
export interface Definition {
  /** 词性 */
  partOfSpeech: string
  /** 英文定义 */
  definition: string
  /** 中文翻译 */
  chinese?: string
  /** 例句列表 */
  examples: Example[]
  /** 排序 */
  order: number
}

/**
 * 词典查询结果
 */
export interface DictionaryResult {
  /** 查询单词 */
  word: string
  /** 词典来源 */
  dictionary: 'cambridge'
  /** 发音列表 */
  pronunciations: Pronunciation[]
  /** 释义列表 */
  definitions: Definition[]
}

/**
 * 词典配置
 */
export interface DictionaryConfig {
  name: string
  url: (word: string) => string
  baseUrl: string
  description: string
}

/**
 * 剑桥词典配置
 */
export const CAMBRIDGE_CONFIG: DictionaryConfig = {
  name: '剑桥词典',
  url: (word: string) =>
    `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${word}`,
  baseUrl: 'https://dictionary.cambridge.org',
  description: '提供中英文双语定义和例句',
}

/**
 * 缓存数据
 */
export interface DefinitionCache {
  word: string
  data: DictionaryResult
  fetchedAt: number
  expiresAt: number
  source: 'cambridge'
}
