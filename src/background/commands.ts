import { VocabularyStorageManager, generateId, getSelectedTextContext, sendNotificationToTab } from '../utils'
import type { VocabularyWord } from '../types'

/**
 * 处理快捷键命令
 */
export function handleCommand(command: string, tab?: chrome.tabs.Tab): void {
  if (command === 'add_selected_word' && tab?.id) {
    addSelectedWord(tab)
  }
}

/**
 * 添加选中的单词
 */
async function addSelectedWord(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return

  try {
    // 获取选中的文本
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || '',
    })

    const selectedText = results[0]?.result?.trim().toLowerCase()
    if (!selectedText) return

    // 尝试获取上下文
    let context: string | undefined
    try {
      const contextResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getSelectedTextContext,
      })
      context = contextResults[0]?.result as string | undefined
    } catch (error) {
      console.warn('获取上下文失败:', error)
    }

    const word: VocabularyWord = {
      id: generateId(),
      word: selectedText,
      addedAt: Date.now(),
      sourceUrl: tab.url,
      sourceTitle: tab.title,
      context,
      reviewCount: 0,
      proficiency: 'new',
      tags: [],
    }

    const added = await VocabularyStorageManager.addWord(word)

    // 发送通知
    await sendNotificationToTab(tab.id, {
      message: added ? `已添加单词: ${selectedText}` : `单词已在生词本中: ${selectedText}`,
      type: added ? 'success' : 'info',
    })

    // 更新高亮
    if (added) {
      await chrome.tabs.sendMessage(tab.id, { action: 'updateHighlight' })
    }
  } catch (error) {
    console.error('快捷键添加单词失败:', error)
  }
}
