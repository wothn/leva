import {
  CacheStorageManager,
  VocabularyStorageManager,
  downloadAudioAsDataUrl,
  generateId,
  getSelectedTextContext,
  sendNotificationToTab,
} from '../utils'
import { createOffscreenDocument } from './offscreen'
import type {
  Message,
  MessageResponseMap,
  GetDefinitionMessage,
  DownloadAudioMessage,
  ShowNotificationMessage,
  ParseDefinitionResponse,
  AddWordMessage,
} from '../types'
import type { VocabularyWord } from '../types'

/**
 * 处理消息
 */
export function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  switch (message.action) {
    case 'getDefinition':
      handleGetDefinition(message as GetDefinitionMessage, sendResponse)
      return true // 保持通道开放

    case 'getFromCache':
      handleGetFromCache(message.word, sendResponse)
      return true

    case 'saveToCache':
      handleSaveToCache(message.word, message.data, sendResponse)
      return true

    case 'removeFromCache':
      handleRemoveFromCache(message.word, sendResponse)
      return true

    case 'downloadAudio':
      handleDownloadAudio(message as DownloadAudioMessage, sendResponse)
      return true

    case 'clearCache':
      handleClearCache(sendResponse)
      return true

    case 'showNotification':
      handleShowNotification(message as ShowNotificationMessage)
      return false

    case 'addWord':
      handleAddWord(message as AddWordMessage, _sender, sendResponse)
      return true

    default:
      return false
  }
}

/**
 * 处理获取释义请求
 */
async function handleGetDefinition(
  message: GetDefinitionMessage,
  sendResponse: (response: MessageResponseMap['getDefinition']) => void
): Promise<void> {
  try {
    await createOffscreenDocument()

    const response = (await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'parseDefinition',
      word: message.word,
    })) as ParseDefinitionResponse

    sendResponse(response)
  } catch (error) {
    console.error('获取释义失败:', error)
    sendResponse({
      definition: null,
      error: error instanceof Error ? error.message : '未知错误',
    })
  }
}

/**
 * 处理从缓存获取
 */
async function handleGetFromCache(
  word: string,
  sendResponse: (response: MessageResponseMap['getFromCache']) => void
): Promise<void> {
  try {
    const data = await CacheStorageManager.get(word)
    sendResponse({ data })
  } catch (error) {
    console.error('从缓存获取失败:', error)
    sendResponse({ data: null })
  }
}

/**
 * 处理保存到缓存
 */
async function handleSaveToCache(
  word: string,
  data: unknown,
  sendResponse: (response: MessageResponseMap['saveToCache']) => void
): Promise<void> {
  try {
    await CacheStorageManager.save(word, data as Parameters<typeof CacheStorageManager.save>[1])
    sendResponse({ success: true })
  } catch (error) {
    console.error('保存到缓存失败:', error)
    sendResponse({ success: false })
  }
}

/**
 * 处理从缓存删除
 */
async function handleRemoveFromCache(
  word: string,
  sendResponse: (response: MessageResponseMap['removeFromCache']) => void
): Promise<void> {
  try {
    await CacheStorageManager.remove(word)
    sendResponse({ success: true })
  } catch (error) {
    console.error('从缓存删除失败:', error)
    sendResponse({ success: false })
  }
}

/**
 * 处理下载音频
 */
async function handleDownloadAudio(
  message: DownloadAudioMessage,
  sendResponse: (response: MessageResponseMap['downloadAudio']) => void
): Promise<void> {
  try {
    const dataUrl = await downloadAudioAsDataUrl(message.audioUrl)
    sendResponse({ dataUrl })
  } catch (error) {
    console.error('下载音频失败:', error)
    sendResponse({
      dataUrl: null,
      error: error instanceof Error ? error.message : '未知错误',
    })
  }
}

/**
 * 处理清除缓存
 */
async function handleClearCache(
  sendResponse: (response: MessageResponseMap['clearCache']) => void
): Promise<void> {
  try {
    const count = await CacheStorageManager.clearAll()

    // 发送通知
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      try {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showNotification',
          message: `已清除 ${count} 个缓存项`,
          type: 'success',
        })
      } catch {
        // 忽略内容脚本未加载的情况
      }
    }

    sendResponse(undefined)
  } catch (error) {
    console.error('清除缓存失败:', error)
    sendResponse(undefined)
  }
}

/**
 * 处理显示通知
 */
async function handleShowNotification(message: ShowNotificationMessage): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      try {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showNotification',
          message: message.message,
          type: message.type,
        })
      } catch {
        // 忽略内容脚本未加载的情况
      }
    }
  } catch (error) {
    console.error('发送通知失败:', error)
  }
}

/**
 * 处理添加单词请求
 */
async function handleAddWord(
  message: AddWordMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponseMap['addWord']) => void
): Promise<void> {
  const tabId = sender.tab?.id
  if (!tabId) {
    sendResponse(undefined)
    return
  }

  const wordText = message.word.trim().toLowerCase()
  if (!wordText) {
    sendResponse(undefined)
    return
  }

  try {
    let context = message.context

    if (!context) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: getSelectedTextContext,
        })
        context = results[0]?.result as string | undefined
      } catch (error) {
        console.warn('获取上下文失败:', error)
      }
    }

    const word: VocabularyWord = {
      id: generateId(),
      word: wordText,
      addedAt: Date.now(),
      sourceUrl: message.sourceUrl ?? sender.tab?.url,
      sourceTitle: message.sourceTitle ?? sender.tab?.title,
      context,
      reviewCount: 0,
      proficiency: 'new',
      tags: [],
    }

    const added = await VocabularyStorageManager.addWord(word)

    await sendNotificationToTab(tabId, {
      message: added ? `已添加单词: ${wordText}` : `单词已在生词本中: ${wordText}`,
      type: added ? 'success' : 'info',
    })

    if (added) {
      await chrome.tabs.sendMessage(tabId, { action: 'updateHighlight' })
    }

    sendResponse(undefined)
  } catch (error) {
    console.error('添加单词失败:', error)
    sendResponse(undefined)
  }
}
