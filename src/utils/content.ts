/**
 * 获取选中文本的上下文
 * @returns 包含选中文本的句子，最大长度200字符
 */
export function getSelectedTextContext(): string | undefined {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return undefined

  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer.parentElement

  if (container) {
    const text = container.textContent || ''
    const selectedText = selection.toString()

    // 简单的句子提取逻辑
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]+/g) || [text]
    for (const sentence of sentences) {
      if (sentence.includes(selectedText)) {
        return sentence.trim().substring(0, 200) // 限制长度
      }
    }
  }

  return undefined
}

/**
 * 发送通知到标签页
 * @param tabId 标签页ID
 * @param notification 通知内容
 */
export async function sendNotificationToTab(
  tabId: number,
  notification: { message: string; type: 'success' | 'info' | 'error' }
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      ...notification,
    })
  } catch {
    // 忽略内容脚本未加载的情况
  }
}
