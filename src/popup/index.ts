import { VocabularyStorageManager } from '../utils'
import type { VocabularyWord } from '../types'
import './styles.css'

/**
 * Popup 页面入口
 */

// DOM 元素
let wordListElement: HTMLElement
let searchInput: HTMLInputElement

/**
 * 初始化
 */
document.addEventListener('DOMContentLoaded', async () => {
  initElements()
  setupEventListeners()
  await loadVocabulary()
})

/**
 * 初始化 DOM 元素引用
 */
function initElements(): void {
  wordListElement = document.getElementById('word-list')!
  searchInput = document.getElementById('search-input') as HTMLInputElement
}

/**
 * 设置事件监听器
 */
function setupEventListeners(): void {
  // 搜索功能
  searchInput?.addEventListener('input', () => {
    filterWords(searchInput.value.toLowerCase())
  })

  // 清空所有
  document.getElementById('clear-all')?.addEventListener('click', handleClearAll)

  // 清空缓存
  document.getElementById('clear-cache')?.addEventListener('click', handleClearCache)

  // 导出
  document.getElementById('export-btn')?.addEventListener('click', handleExport)

  // 设置
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })
}

/**
 * 加载生词列表
 */
async function loadVocabulary(): Promise<void> {
  try {
    const words = await VocabularyStorageManager.getWords()
    renderWordList(words)
  } catch (error) {
    console.error('加载生词列表失败:', error)
    showEmptyState('加载失败，请重试')
  }
}

/**
 * 渲染生词列表
 */
function renderWordList(words: VocabularyWord[]): void {
  if (words.length === 0) {
    showEmptyState()
    return
  }

  // 按添加时间倒序
  const sortedWords = [...words].sort((a, b) => b.addedAt - a.addedAt)

  wordListElement.innerHTML = sortedWords.map((word) => createWordItemHTML(word)).join('')

  // 绑定删除事件
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wordId = btn.getAttribute('data-word-id')
      if (wordId) handleDeleteWord(wordId)
    })
  })
}

/**
 * 创建单词项 HTML
 */
function createWordItemHTML(word: VocabularyWord): string {
  const date = new Date(word.addedAt).toLocaleDateString('zh-CN')

  return `
    <div class="word-item" data-word="${word.word.toLowerCase()}">
      <div class="word-info">
        <span class="word">${word.word}</span>
        <span class="word-meta">
          ${word.proficiency !== 'new' ? `<span class="proficiency ${word.proficiency}">${getProficiencyLabel(word.proficiency)}</span>` : ''}
          <span class="date">${date}</span>
        </span>
      </div>
      <button class="delete-btn" data-word-id="${word.id}" title="删除">
        <svg viewBox="0 0 24 24">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
        </svg>
      </button>
    </div>
  `
}

/**
 * 获取熟练度标签
 */
function getProficiencyLabel(proficiency: VocabularyWord['proficiency']): string {
  const labels: Record<VocabularyWord['proficiency'], string> = {
    new: '新词',
    learning: '学习中',
    familiar: '熟悉',
    mastered: '掌握',
  }
  return labels[proficiency]
}

/**
 * 显示空状态
 */
function showEmptyState(message?: string): void {
  wordListElement.innerHTML = `
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24">
          <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
        </svg>
      </div>
      <div class="empty-title">${message || '生词本为空'}</div>
      <div class="empty-subtitle">
        ${message ? '' : '在网页上遇到生词时，选中文本点击添加按钮<br>即可添加到生词本中进行学习'}
      </div>
    </div>
  `
}

/**
 * 过滤单词
 */
function filterWords(searchTerm: string): void {
  const wordItems = document.querySelectorAll('.word-item')
  wordItems.forEach((item) => {
    const word = item.getAttribute('data-word') || ''
    const display = word.includes(searchTerm) ? 'flex' : 'none'
    ;(item as HTMLElement).style.display = display
  })
}

/**
 * 处理删除单词
 */
async function handleDeleteWord(wordId: string): Promise<void> {
  try {
    await VocabularyStorageManager.removeWord(wordId)
    await loadVocabulary()
    await notifyContentScriptToUpdate()
  } catch (error) {
    console.error('删除单词失败:', error)
  }
}

/**
 * 处理清空所有
 */
async function handleClearAll(): Promise<void> {
  if (!confirm('确定要清空所有生词吗？')) return

  try {
    await VocabularyStorageManager.saveWords([])
    await loadVocabulary()
    await notifyContentScriptToUpdate()
  } catch (error) {
    console.error('清空生词失败:', error)
  }
}

/**
 * 处理清空缓存
 */
async function handleClearCache(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ action: 'clearCache' })
  } catch (error) {
    console.error('清空缓存失败:', error)
  }
}

/**
 * 处理导出
 */
async function handleExport(): Promise<void> {
  try {
    const words = await VocabularyStorageManager.getWords()
    const content = words.map((w) => w.word).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `vocabulary_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
  }
}

/**
 * 通知内容脚本更新高亮
 */
async function notifyContentScriptToUpdate(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      await chrome.tabs.sendMessage(tabs[0].id, { action: 'updateHighlight' })
    }
  } catch {
    // 忽略内容脚本未加载的情况
  }
}
