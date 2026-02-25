import type { ExtensionSettings } from '../types'

/**
 * 浮动工具栏模块
 */

let toolbarElement: HTMLElement | null = null
let lastSelectedText: string | null = null

/**
 * 创建浮动工具栏
 */
export function createFloatingToolbar(settings: ExtensionSettings): void {
  if (!settings.toolbarEnabled) return

  // 如果已存在，先移除
  if (toolbarElement) {
    toolbarElement.remove()
  }

  toolbarElement = document.createElement('div')
  toolbarElement.id = 'vocabulary-toolbar'
  toolbarElement.innerHTML = `
    <button id="add-word-btn" title="添加到生词本" aria-label="添加到生词本"></button>
  `

  document.body.appendChild(toolbarElement)

  // 添加点击事件
  const addButton = document.getElementById('add-word-btn')
  addButton?.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  addButton?.addEventListener('click', handleAddWordClick)

  // 监听选择变化
  document.addEventListener('selectionchange', () => handleSelectionChange(settings))
}

/**
 * 处理添加单词按钮点击
 */
function handleAddWordClick(): void {
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim() || lastSelectedText

  if (selectedText && chrome.runtime) {
    chrome.runtime.sendMessage({
      action: 'addWord',
      word: selectedText.toLowerCase(),
    })
    hideToolbar()
  }
}

/**
 * 处理文本选择变化
 */
function handleSelectionChange(settings: ExtensionSettings): void {
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim()

  if (selectedText && settings.toolbarEnabled) {
    lastSelectedText = selectedText
    showToolbar(selection!)
  } else {
    hideToolbar()
  }
}

/**
 * 显示工具栏
 */
function showToolbar(selection: Selection): void {
  if (!toolbarElement || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const dotSize = 10
  const offset = 4

  toolbarElement.style.display = 'flex'
  toolbarElement.style.top = `${rect.bottom + window.scrollY + offset}px`
  toolbarElement.style.left = `${rect.right + window.scrollX + offset}px`
  toolbarElement.style.width = `${dotSize}px`
  toolbarElement.style.height = `${dotSize}px`
}

/**
 * 隐藏工具栏
 */
export function hideToolbar(): void {
  if (toolbarElement) {
    toolbarElement.style.display = 'none'
  }
  lastSelectedText = null
}

/**
 * 更新工具栏设置
 */
export function updateToolbar(settings: ExtensionSettings): void {
  if (settings.toolbarEnabled) {
    if (!toolbarElement) {
      createFloatingToolbar(settings)
    }
  } else {
    if (toolbarElement) {
      toolbarElement.remove()
      toolbarElement = null
    }
  }
}
