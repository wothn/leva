import { parseDefinition, generateResultHTML } from './parser'
import { getFromCache } from './cache'
import type { ParseDefinitionMessage } from '../types'

/**
 * Offscreen Document 入口
 */

// 监听来自主页面的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const parseMessage = message as ParseDefinitionMessage

  if (parseMessage.target === 'offscreen' && parseMessage.action === 'parseDefinition') {
    // 设置超时保护
    const timeout = setTimeout(() => {
      console.error('解析超时，超过30秒')
      sendResponse({ definition: null, error: '解析超时' })
    }, 30000)

    handleParseRequest(parseMessage.word)
      .then((definition) => {
        clearTimeout(timeout)
        sendResponse({ definition })
      })
      .catch((error) => {
        clearTimeout(timeout)
        console.error('解析定义时出错:', error)
        sendResponse({
          definition: null,
          error: error instanceof Error ? error.message : '未知错误',
        })
      })

    return true // 保持消息通道开放
  }

  return false
})

/**
 * 处理解析请求
 */
async function handleParseRequest(word: string): Promise<string | null> {
  // 首先检查缓存
  const cachedResult = await getFromCache(word)
  if (cachedResult) {
    console.log(`使用"${word}"的缓存数据`)
    return generateResultHTML(cachedResult.data)
  }

  console.log(`从剑桥词典获取"${word}"的释义...`)
  return await parseDefinition(word)
}

console.log('Vocabulary Extension Offscreen Document loaded')
