import { VocabularyStorageManager } from '../utils'
import type { ExtensionSettings } from '../types'

/**
 * 高亮渲染模块
 */

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'TEXTAREA',
  'INPUT',
  'CODE',
  'PRE',
  'NOSCRIPT',
])

const SKIP_SELECTOR = '#vocabulary-tooltip, #vocabulary-toolbar, .vocabulary-highlight'

let cachedWordsKey = ''
let cachedWords: string[] = []
let cachedRegexes: { testRegex: RegExp; splitRegex: RegExp } | null = null

/**
 * 更新高亮显示
 */
export async function updateHighlight(settings: ExtensionSettings): Promise<void> {
  const words = await VocabularyStorageManager.getWords()
  const wordList = words.map((w) => w.word)
  highlightWords(wordList, settings)
}

/**
 * 高亮显示生词
 */
export function highlightWords(words: string[], settings: ExtensionSettings): void {
  const normalizedWords = normalizeWords(words)

  if (!settings.highlightEnabled || normalizedWords.length === 0) {
    removeAllHighlights()
    cachedWordsKey = ''
    cachedWords = []
    cachedRegexes = null
    return
  }

  const wordsKey = normalizedWords.join('\u0001')
  if (wordsKey !== cachedWordsKey) {
    cachedWordsKey = wordsKey
    cachedWords = normalizedWords
    cachedRegexes = buildRegexes(normalizedWords)
  }

  if (!cachedRegexes) {
    removeAllHighlights()
    return
  }

  highlightTextInNode(document.body, cachedRegexes.testRegex, cachedRegexes.splitRegex, settings)
}

/**
 * 移除所有高亮
 */
export function removeAllHighlights(): void {
  const highlights = document.querySelectorAll('.vocabulary-highlight')
  highlights.forEach((span) => {
    const parent = span.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent || ''), span)
      parent.normalize()
    }
  })
}

/**
 * 在指定节点中高亮文本
 */
function highlightTextInNode(
  node: Node,
  testRegex: RegExp,
  splitRegex: RegExp,
  settings: ExtensionSettings
): void {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode: (textNode) => {
      if (shouldSkipTextNode(textNode as Text)) {
        return NodeFilter.FILTER_REJECT
      }
      // 排除已经在高亮中的节点
      if (textNode.parentElement?.classList.contains('vocabulary-highlight')) {
        return NodeFilter.FILTER_REJECT
      }
      return testRegex.test(textNode.textContent || '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  const textNodes: Text[] = []
  let currentNode: Node | null
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode as Text)
  }

  textNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment()
    const parts = (textNode.textContent || '').split(splitRegex)

    parts.forEach((part, index) => {
      if (index % 2 === 0) {
        // 普通文本
        if (part) fragment.appendChild(document.createTextNode(part))
      } else {
        // 匹配的单词
        const span = createHighlightSpan(part, settings)
        fragment.appendChild(span)
      }
    })

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode)
    }
  })
}

/**
 * 创建高亮 span 元素
 */
function createHighlightSpan(word: string, settings: ExtensionSettings): HTMLElement {
  const span = document.createElement('span')
  span.className = 'vocabulary-highlight'
  span.textContent = word
  span.dataset.word = word.toLowerCase()

  // 应用样式
  switch (settings.highlightStyle) {
    case 'solid':
      span.classList.add('solid')
      span.style.textDecorationColor = settings.highlightColor
      break
    case 'dotted':
      span.classList.add('dotted')
      span.style.borderColor = settings.highlightColor
      break
    case 'dashed':
      span.classList.add('dashed')
      span.style.borderColor = settings.highlightColor
      break
    case 'background':
      span.classList.add('background')
      span.style.backgroundColor = settings.highlightColor
      break
  }

  return span
}

/**
 * 创建 MutationObserver 监听 DOM 变化
 */
export function createHighlightObserver(
  settings: ExtensionSettings
): MutationObserver {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const observer = new MutationObserver((mutations) => {
    // 防抖处理
    if (timeoutId) clearTimeout(timeoutId)

    timeoutId = setTimeout(() => {
      const needsUpdate = mutations.some(
        (mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0
      )

      if (needsUpdate) {
        if (cachedWords.length > 0) {
          highlightWords(cachedWords, settings)
        } else {
          updateHighlight(settings)
        }
      }
    }, 100)
  })

  return observer
}

function normalizeWords(words: string[]): string[] {
  const normalized = words
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 0)

  const unique = Array.from(new Set(normalized))
  unique.sort((a, b) => b.length - a.length)
  return unique
}

function buildRegexes(words: string[]): { testRegex: RegExp; splitRegex: RegExp } | null {
  if (words.length === 0) return null

  const escapedWords = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const body = escapedWords.join('|')

  const unicodeBoundaryStart = '(?<![\\p{L}\\p{N}_])'
  const unicodeBoundaryEnd = '(?![\\p{L}\\p{N}_])'
  const unicodePattern = `${unicodeBoundaryStart}(${body})${unicodeBoundaryEnd}`

  try {
    return {
      testRegex: new RegExp(unicodePattern, 'iu'),
      splitRegex: new RegExp(unicodePattern, 'giu'),
    }
  } catch {
    const fallbackPattern = `\\b(${body})\\b`
    return {
      testRegex: new RegExp(fallbackPattern, 'i'),
      splitRegex: new RegExp(fallbackPattern, 'gi'),
    }
  }
}

function shouldSkipTextNode(textNode: Text): boolean {
  const parent = textNode.parentElement
  if (!parent) return true

  if (parent.closest(SKIP_SELECTOR)) return true
  if (parent.isContentEditable) return true

  const tagName = parent.tagName
  if (SKIP_TAGS.has(tagName)) return true

  const closestSkippable = parent.closest(
    'script, style, textarea, input, code, pre, noscript, [contenteditable="true"]'
  )
  return Boolean(closestSkippable)
}
