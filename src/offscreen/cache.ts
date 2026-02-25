import type { DictionaryResult, DefinitionCache } from '../types'

/**
 * 从缓存获取数据
 * 注意：过期检查已在 CacheStorageManager.get() 中处理
 */
export async function getFromCache(word: string): Promise<DefinitionCache | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getFromCache',
      word: word.toLowerCase(),
    })

    if (response?.data) {
      console.log(`使用"${word}"的缓存数据`)
      return response.data
    }

    return null
  } catch (error) {
    console.error('从缓存获取数据时出错:', error)
    return null
  }
}

/**
 * 保存数据到缓存
 */
export async function saveToCache(word: string, data: DictionaryResult): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      action: 'saveToCache',
      word: word.toLowerCase(),
      data,
    })
    console.log(`"${word}"的释义已缓存`)
  } catch (error) {
    console.error('保存到缓存时出错:', error)
  }
}
