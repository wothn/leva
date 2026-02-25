import { generateAudioFallbackUrls, playAudio } from '../utils'
import type { ExtensionSettings } from '../types'

/**
 * 悬浮释义 Tooltip 模块
 */

let tooltipElement: HTMLElement | null = null
let currentHoveredElement: HTMLElement | null = null
let isTooltipHovered = false
let tooltipRequestId = 0
let lastRequestedWord: string | null = null

const TOOLTIP_DELAY = 300

/**
 * 创建 Tooltip
 */
export function createTooltip(settings: ExtensionSettings): void {
  if (!settings.tooltipEnabled) return

  // 如果已存在，先移除
  if (tooltipElement) {
    tooltipElement.remove()
  }

  tooltipElement = document.createElement('div')
  tooltipElement.id = 'vocabulary-tooltip'
  applyTooltipTheme(settings.darkMode)
  document.body.appendChild(tooltipElement)

  // 绑定事件
  bindTooltipEvents(settings)
}

/**
 * 绑定 Tooltip 事件
 */
function bindTooltipEvents(settings: ExtensionSettings): void {
  let showTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  // 鼠标悬停高亮单词
  document.body.addEventListener(
    'mouseover',
    (event) => {
      const target = event.target as HTMLElement
      if (target.classList?.contains('vocabulary-highlight')) {
        if (hideTimer) clearTimeout(hideTimer)

        if (currentHoveredElement !== target) {
          currentHoveredElement = target
          const word = target.dataset.word

          if (showTimer) clearTimeout(showTimer)

          if (word) {
            showTimer = setTimeout(() => {
              showTooltip(target, word, settings)
            }, TOOLTIP_DELAY)
          }
        }
      }
    },
    true
  )

  // 鼠标离开高亮单词
  document.body.addEventListener(
    'mouseout',
    (event) => {
      const target = event.target as HTMLElement
      if (target.classList?.contains('vocabulary-highlight')) {
        if (showTimer) clearTimeout(showTimer)

        hideTimer = setTimeout(() => {
          if (!isTooltipHovered) {
            hideTooltip()
            currentHoveredElement = null
          }
        }, TOOLTIP_DELAY)
      }
    },
    true
  )

  // Tooltip 鼠标事件
  tooltipElement?.addEventListener('mouseenter', () => {
    isTooltipHovered = true
    if (hideTimer) clearTimeout(hideTimer)
  })

  tooltipElement?.addEventListener('mouseleave', () => {
    isTooltipHovered = false
    hideTimer = setTimeout(() => {
      hideTooltip()
      currentHoveredElement = null
    }, TOOLTIP_DELAY)
  })
}

/**
 * 应用 Tooltip 主题
 */
export function applyTooltipTheme(isDarkMode: boolean): void {
  if (!tooltipElement) return

  if (isDarkMode) {
    tooltipElement.classList.add('dark')
  } else {
    tooltipElement.classList.remove('dark')
  }
}

/**
 * 显示 Tooltip
 */
async function showTooltip(
  element: HTMLElement,
  word: string,
  settings: ExtensionSettings
): Promise<void> {
  if (!chrome.runtime || !tooltipElement) return

  const requestId = ++tooltipRequestId
  lastRequestedWord = word

  applyTooltipTheme(settings.darkMode)

  // 显示加载状态
  tooltipElement.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
  `
  tooltipElement.style.display = 'block'
  setPosition(element)

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getDefinition',
      word,
    })

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message)
    }

    if (
      requestId !== tooltipRequestId ||
      currentHoveredElement !== element ||
      lastRequestedWord !== word
    ) {
      return
    }

    if (response?.definition) {
      tooltipElement.innerHTML = response.definition
      applyTooltipTheme(settings.darkMode)
      setPosition(element)
      bindAudioButtons()

      // 自动发音
      if (settings.autoPronounce) {
        const firstAudioBtn = tooltipElement.querySelector('.audio-btn') as HTMLElement
        if (firstAudioBtn) {
          firstAudioBtn.click()
        }
      }
    } else {
      tooltipElement.innerHTML =
        '<div class="error-container"><div class="error">未找到释义</div></div>'
      applyTooltipTheme(settings.darkMode)
      setPosition(element)
    }
  } catch {
    tooltipElement.innerHTML =
      '<div class="error-container"><div class="error">获取释义时出错</div></div>'
    applyTooltipTheme(settings.darkMode)
    setPosition(element)
  }
}

/**
 * 隐藏 Tooltip
 */
export function hideTooltip(): void {
  if (tooltipElement) {
    tooltipRequestId += 1
    tooltipElement.style.display = 'none'
  }
}

/**
 * 设置 Tooltip 位置
 */
function setPosition(element: HTMLElement): void {
  if (!tooltipElement) return

  const elementRect = element.getBoundingClientRect()
  const tooltipRect = tooltipElement.getBoundingClientRect()
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  // 默认位置（元素下方）
  let top = elementRect.bottom + window.scrollY + 5
  let left = elementRect.left + window.scrollX

  // 水平边界检查
  if (left + tooltipRect.width > screenWidth + window.scrollX) {
    left = screenWidth + window.scrollX - tooltipRect.width - 5
  }
  if (left < window.scrollX) {
    left = window.scrollX + 5
  }

  // 垂直边界检查
  const spaceBelow = screenHeight - elementRect.bottom
  const spaceAbove = elementRect.top

  if (spaceBelow < tooltipRect.height + 10 && spaceAbove > tooltipRect.height + 10) {
    top = elementRect.top + window.scrollY - tooltipRect.height - 5
  }

  tooltipElement.style.top = `${top}px`
  tooltipElement.style.left = `${left}px`
}

/**
 * 绑定音频按钮事件
 */
function bindAudioButtons(): void {
  if (!tooltipElement) return

  const audioButtons = tooltipElement.querySelectorAll('.audio-btn')
  audioButtons.forEach((button) => {
    const btn = button as HTMLElement
    if (btn.hasAttribute('data-listener-added')) return

    btn.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()

      const audioSrc = btn.dataset.audio
      if (!audioSrc) return

      const originalHTML = btn.innerHTML
      btn.innerHTML = '<span>⏸️</span>'
      btn.setAttribute('disabled', 'true')

      try {
        await playAudioViaBackground(audioSrc)
      } catch (error) {
        console.error('音频播放失败:', error)
        showAudioError(btn)
      } finally {
        btn.innerHTML = originalHTML
        btn.removeAttribute('disabled')
      }
    })

    btn.setAttribute('data-listener-added', 'true')
  })
}

/**
 * 通过后台下载音频并播放（带备用源）
 */
async function playAudioViaBackground(audioSrc: string): Promise<void> {
  const fallbackUrls = generateAudioFallbackUrls(audioSrc)
  let lastError: unknown = null

  for (const url of fallbackUrls) {
    try {
      const dataUrl = await downloadAudioDataUrl(url)
      await playAudio(dataUrl)
      return
    } catch (error) {
      lastError = error
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : lastError ? String(lastError) : '未知错误'
  throw new Error(`所有音频源都无法播放: ${message}`)
}

/**
 * 通过后台服务获取音频 data URL
 */
async function downloadAudioDataUrl(audioUrl: string): Promise<string> {
  if (!chrome.runtime?.id) {
    throw new Error('扩展运行时不可用')
  }

  const response = await chrome.runtime.sendMessage({
    action: 'downloadAudio',
    audioUrl,
  })

  if (chrome.runtime.lastError) {
    throw new Error(chrome.runtime.lastError.message)
  }

  if (!response?.dataUrl) {
    throw new Error(response?.error || '下载音频失败')
  }

  return response.dataUrl
}

/**
 * 显示音频播放错误
 */
function showAudioError(button: HTMLElement): void {
  const originalHTML = button.innerHTML
  button.innerHTML = '<span>❌</span>'
  button.title = '音频播放失败，请检查网络连接'

  setTimeout(() => {
    button.innerHTML = originalHTML
    button.title = '播放发音'
  }, 2000)
}

/**
 * 更新 Tooltip 设置
 */
export function updateTooltip(settings: ExtensionSettings): void {
  if (settings.tooltipEnabled) {
    if (!tooltipElement) {
      createTooltip(settings)
    }
    applyTooltipTheme(settings.darkMode)
  } else {
    if (tooltipElement) {
      tooltipElement.remove()
      tooltipElement = null
    }
  }
}
