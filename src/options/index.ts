import { SettingsStorageManager } from '../utils'
import { type ExtensionSettings, type HighlightStyle } from '../types'
import './styles.css'

/**
 * Options 页面入口
 */

// DOM 元素映射
const elements: Partial<Record<keyof ExtensionSettings, HTMLInputElement | HTMLSelectElement>> = {}

/**
 * 初始化
 */
document.addEventListener('DOMContentLoaded', async () => {
  initElements()
  await loadSettings()
  setupEventListeners()
})

/**
 * 初始化 DOM 元素引用
 */
function initElements(): void {
  const elementIds: (keyof ExtensionSettings)[] = [
    'highlightEnabled',
    'highlightStyle',
    'highlightColor',
    'toolbarEnabled',
    'tooltipEnabled',
    'darkMode',
    'autoPronounce',
  ]

  elementIds.forEach((id) => {
    const element = document.getElementById(id.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))
    if (element) {
      elements[id] = element as HTMLInputElement | HTMLSelectElement
    }
  })
}

/**
 * 加载设置
 */
async function loadSettings(): Promise<void> {
  try {
    const settings = await SettingsStorageManager.getSettings()

    // 设置复选框
    const checkboxIds: (keyof ExtensionSettings)[] = [
      'highlightEnabled',
      'toolbarEnabled',
      'tooltipEnabled',
      'darkMode',
      'autoPronounce',
    ]

    checkboxIds.forEach((id) => {
      const element = elements[id] as HTMLInputElement | undefined
      if (element) {
        element.checked = settings[id] as boolean
      }
    })

    // 设置高亮样式
    const styleElement = elements.highlightStyle as HTMLSelectElement | undefined
    if (styleElement) {
      styleElement.value = settings.highlightStyle
    }

    // 设置高亮颜色
    const colorElement = elements.highlightColor as HTMLInputElement | undefined
    if (colorElement) {
      colorElement.value = settings.highlightColor
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners(): void {
  // 所有设置项的变化监听
  const settingIds: (keyof ExtensionSettings)[] = [
    'highlightEnabled',
    'highlightStyle',
    'highlightColor',
    'toolbarEnabled',
    'tooltipEnabled',
    'darkMode',
    'autoPronounce',
  ]

  settingIds.forEach((id) => {
    const element = elements[id]
    if (element) {
      element.addEventListener('change', handleSettingChange)
    }
  })

  // 重置按钮
  document.getElementById('reset-settings')?.addEventListener('click', handleReset)
}

/**
 * 处理设置变化
 */
async function handleSettingChange(): Promise<void> {
  const settings: Partial<ExtensionSettings> = {}

  // 获取复选框值
  const checkboxIds: (keyof ExtensionSettings)[] = [
    'highlightEnabled',
    'toolbarEnabled',
    'tooltipEnabled',
    'darkMode',
    'autoPronounce',
  ]

  checkboxIds.forEach((id) => {
    const element = elements[id] as HTMLInputElement | undefined
    if (element) {
      ;(settings as Record<string, boolean>)[id] = element.checked
    }
  })

  // 获取高亮样式
  const styleElement = elements.highlightStyle as HTMLSelectElement | undefined
  if (styleElement) {
    settings.highlightStyle = styleElement.value as HighlightStyle
  }

  // 获取高亮颜色
  const colorElement = elements.highlightColor as HTMLInputElement | undefined
  if (colorElement) {
    settings.highlightColor = colorElement.value
  }

  try {
    await SettingsStorageManager.saveSettings(settings)
    await notifyAllTabsToUpdate()
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}

/**
 * 处理重置
 */
async function handleReset(): Promise<void> {
  if (!confirm('确定要重置所有设置吗？')) return

  try {
    await SettingsStorageManager.resetSettings()
    await loadSettings()
    await notifyAllTabsToUpdate()
    showNotification('设置已重置')
  } catch (error) {
    console.error('重置设置失败:', error)
  }
}

/**
 * 通知所有标签页更新
 */
async function notifyAllTabsToUpdate(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({})
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'updateHighlight' })
          } catch {
            // 忽略内容脚本未加载的标签页
          }
        }
      })
    )
  } catch (error) {
    console.error('通知标签页更新失败:', error)
  }
}

/**
 * 显示通知
 */
function showNotification(message: string): void {
  // 创建临时通知元素
  const notification = document.createElement('div')
  notification.className = 'notification'
  notification.textContent = message
  document.body.appendChild(notification)

  // 动画显示
  requestAnimationFrame(() => {
    notification.classList.add('show')
  })

  // 自动隐藏
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => notification.remove(), 300)
  }, 2000)
}
