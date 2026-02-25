import { SettingsStorageManager } from '../utils'
import { updateHighlight, createHighlightObserver } from './highlight'
import { createFloatingToolbar, updateToolbar } from './toolbar'
import { createTooltip, updateTooltip, applyTooltipTheme } from './tooltip'
import { showNotification } from './notification'
import type { ExtensionSettings } from '../types'

/**
 * Content Script 入口
 */

// 当前设置
let currentSettings: ExtensionSettings = {
  highlightEnabled: true,
  highlightStyle: 'solid',
  highlightColor: '#FFD700',
  toolbarEnabled: true,
  tooltipEnabled: true,
  darkMode: false,
  autoPronounce: false,
}

// MutationObserver 实例
let highlightObserver: MutationObserver | null = null

/**
 * 初始化扩展
 */
async function initialize(): Promise<void> {
  // 加载设置
  currentSettings = await SettingsStorageManager.getSettings()

  // 创建 UI 组件
  createFloatingToolbar(currentSettings)
  createTooltip(currentSettings)

  // 初始高亮
  await updateHighlight(currentSettings)

  // 监听 DOM 变化
  highlightObserver = createHighlightObserver(currentSettings)
  highlightObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })

  console.log('Vocabulary Extension Content Script initialized')
}

/**
 * 监听设置变化
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return

  let settingsChanged = false
  let darkModeChanged = false

  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key in currentSettings) {
      ;(currentSettings as unknown as Record<string, unknown>)[key] = newValue
      settingsChanged = true

      if (key === 'darkMode') {
        darkModeChanged = true
      }
    }
  }

  if (settingsChanged) {
    // 更新高亮
    updateHighlight(currentSettings)

    // 更新工具栏
    updateToolbar(currentSettings)

    // 更新 Tooltip
    updateTooltip(currentSettings)

    // 更新主题
    if (darkModeChanged) {
      applyTooltipTheme(currentSettings.darkMode)
    }
  }
})

/**
 * 监听来自 background 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 检查扩展上下文
  if (!chrome.runtime) {
    return false
  }

  switch (message.action) {
    case 'updateHighlight':
      updateHighlight(currentSettings)
      sendResponse({ success: true })
      break

    case 'getSettings':
      sendResponse(currentSettings)
      break

    case 'showNotification':
      showNotification(message.message, message.type)
      sendResponse({ success: true })
      break

    default:
      return false
  }

  return true
})

/**
 * 页面加载完成后初始化
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}
