/**
 * 离屏文档管理
 */

const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/index.html'

/**
 * 创建离屏文档
 */
export async function createOffscreenDocument(): Promise<void> {
  try {
    // 检查是否已经存在
    if (await chrome.offscreen.hasDocument()) {
      return
    }

    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
      reasons: ['DOM_PARSER'],
      justification: 'Parse dictionary page for word definitions',
    })
  } catch (error) {
    // 如果文档已存在，忽略错误
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (
      !errorMessage.includes('Only a single offscreen') &&
      !errorMessage.includes('document is already created')
    ) {
      console.error('创建离屏文档失败:', error)
      throw error
    }
  }
}

/**
 * 关闭离屏文档
 */
export async function closeOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument()
  }
}
