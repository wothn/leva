import { VocabularyStorageManager, generateId, getSelectedTextContext, sendNotificationToTab } from '../utils'
import type { VocabularyWord } from '../types'

/**
 * 创建右键菜单
 */
export function createContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'addWord',
      title: '添加到生词本',
      contexts: ['selection'],
    })
  })
}

/**
 * 处理右键菜单点击
 */
export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): void {
  if (info.menuItemId === 'addWord' && info.selectionText && tab?.id) {
    const wordText = info.selectionText.trim().toLowerCase()
    addWordFromTab(wordText, tab)
  }
}

/**
 * 从标签页添加单词
 */
async function addWordFromTab(wordText: string, tab: chrome.tabs.Tab): Promise<void> {
  try {
    // 尝试获取选中文本的上下文
    let context: string | undefined
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: getSelectedTextContext,
      })
      context = results[0]?.result as string | undefined
    } catch (error) {
      console.warn('获取上下文失败:', error)
    }

    const word: VocabularyWord = {
      id: generateId(),
      word: wordText,
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
    await sendNotificationToTab(tab.id!, {
      message: added ? `已添加单词: ${wordText}` : `单词已在生词本中: ${wordText}`,
      type: added ? 'success' : 'info',
    })

    // 更新高亮
    if (added) {
      await chrome.tabs.sendMessage(tab.id!, { action: 'updateHighlight' })
    }
  } catch (error) {
    console.error('添加单词失败:', error)
  }
}
