/**
 * 生词熟练度等级
 */
export type ProficiencyLevel = 'new' | 'learning' | 'familiar' | 'mastered'

/**
 * 生词数据结构
 */
export interface VocabularyWord {
  /** 唯一标识 */
  id: string
  /** 单词文本 */
  word: string
  /** 添加时间戳 */
  addedAt: number
  /** 来源网页 URL */
  sourceUrl?: string
  /** 来源网页标题 */
  sourceTitle?: string
  /** 上下文句子 */
  context?: string
  /** 复习次数 */
  reviewCount: number
  /** 最后复习时间 */
  lastReviewedAt?: number
  /** 熟练度等级 */
  proficiency: ProficiencyLevel
  /** 标签 */
  tags: string[]
  /** 个人笔记 */
  notes?: string
}

/**
 * 存储数据结构 (v2)
 */
export interface VocabularyStorage {
  /** 生词列表 */
  words: VocabularyWord[]
  /** 数据版本 */
  version: number
}

/**
 * 旧版数据结构 (v1) - 用于迁移
 */
export type LegacyVocabulary = string[]

/**
 * 生词过滤器
 */
export interface VocabularyFilter {
  searchTerm?: string
  proficiency?: ProficiencyLevel[]
  tags?: string[]
  sortBy?: 'word' | 'addedAt' | 'lastReviewedAt' | 'reviewCount'
  sortOrder?: 'asc' | 'desc'
}
