import {
  CAMBRIDGE_CONFIG,
  type DictionaryResult,
  type Pronunciation,
  type Definition,
  type Example,
} from '../types'

/**
 * 词典解析配置
 */
const PARSER_CONFIG = {
  maxExamplesPerDefinition: 5,
  requestTimeout: 10000,
}

/**
 * 通用请求头
 */
const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
}

/**
 * 解析单词释义
 */
export async function parseDefinition(word: string): Promise<string | null> {
  try {
    if (!word?.trim()) {
      return generateErrorHTML('请输入要查询的单词')
    }

    const cleanWord = word.trim().toLowerCase()
    const result = await fetchFromCambridge(cleanWord)

    if (result && result.definitions && result.definitions.length > 0) {
      return generateResultHTML(result)
    }

    return generateErrorHTML(`未能从剑桥词典找到"${cleanWord}"的释义`)
  } catch (error) {
    console.error('解析定义时发生错误:', error)
    return generateErrorHTML(`解析错误: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 从 HTML 字符串解析剑桥词典内容（用于测试）
 */
export function parseCambridgeHtml(html: string, word: string): DictionaryResult | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  if (doc.querySelector('parsererror')) {
    return null
  }

  return parseCambridgeDocument(doc, word)
}

/**
 * 从剑桥词典获取数据
 */
async function fetchFromCambridge(word: string): Promise<DictionaryResult | null> {
  const url = CAMBRIDGE_CONFIG.url(word)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PARSER_CONFIG.requestTimeout)

    const response = await fetch(url, {
      headers: COMMON_HEADERS,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP错误! 状态码: ${response.status}`)
    }

    const html = await response.text()
    if (!html) {
      throw new Error('获取到的页面内容为空')
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    if (doc.querySelector('parsererror')) {
      throw new Error('HTML解析失败')
    }

    return parseCambridgeDocument(doc, word)
  } catch (error) {
    console.error('获取剑桥词典数据失败:', error)
    throw error
  }
}

/**
 * 解析剑桥词典文档
 */
function parseCambridgeDocument(doc: Document, word: string): DictionaryResult | null {
  // 检查是否找到单词
  if (doc.querySelector('.no-result, .not-found')) {
    return null
  }

  const result: DictionaryResult = {
    word,
    dictionary: 'cambridge',
    pronunciations: [],
    definitions: [],
  }

  // 提取发音
  result.pronunciations = extractPronunciations(doc)

  // 提取词性
  const partOfSpeech = doc.querySelector('.pos.dpos')?.textContent?.trim() || ''

  // 提取释义
  result.definitions = extractDefinitions(doc, partOfSpeech)

  return result.definitions.length > 0 ? result : null
}

/**
 * 提取发音信息
 */
function extractPronunciations(doc: Document): Pronunciation[] {
  const pronunciations: Pronunciation[] = []

  // 英式发音
  const ukContainer = doc.querySelector('.uk.dpron-i')
  if (ukContainer) {
    const phonetic = ukContainer.querySelector('.ipa.dipa')?.textContent?.trim()
    const audio = extractAudioUrl(ukContainer)

    if (phonetic) {
      pronunciations.push({
        text: phonetic,
        region: 'UK',
        audio,
      })
    }
  }

  // 美式发音
  const usContainer = doc.querySelector('.us.dpron-i')
  if (usContainer) {
    const phonetic = usContainer.querySelector('.ipa.dipa')?.textContent?.trim()
    const audio = extractAudioUrl(usContainer)

    if (phonetic) {
      pronunciations.push({
        text: phonetic,
        region: 'US',
        audio,
      })
    }
  }

  return pronunciations
}

/**
 * 提取音频 URL
 */
function extractAudioUrl(container: Element): string | undefined {
  const audioElement = container.querySelector('audio')
  if (!audioElement) return undefined

  const source =
    audioElement.querySelector('source[type="audio/mpeg"]') ||
    audioElement.querySelector('source')

  const src = source?.getAttribute('src')
  return src ? fixAudioUrl(src) : undefined
}

/**
 * 修复音频 URL
 */
function fixAudioUrl(url: string): string {
  if (url.startsWith('http')) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `${CAMBRIDGE_CONFIG.baseUrl}${url}`
  return `${CAMBRIDGE_CONFIG.baseUrl}/${url}`
}

/**
 * 提取释义
 */
function extractDefinitions(doc: Document, partOfSpeech: string): Definition[] {
  const definitions: Definition[] = []
  const defBlocks = doc.querySelectorAll('.def-block.ddef_block')

  defBlocks.forEach((block, index) => {
    const defElement = block.querySelector('.def.ddef_d')
    const defText = defElement?.textContent?.trim()

    const chineseElement = block.querySelector('.trans.dtrans.dtrans-se')
    const chineseText = chineseElement?.textContent?.trim()

    if (defText) {
      const examples = extractExamples(block)

      definitions.push({
        partOfSpeech: partOfSpeech || '未知',
        definition: defText,
        chinese: chineseText,
        examples: examples.slice(0, PARSER_CONFIG.maxExamplesPerDefinition),
        order: index + 1,
      })
    }
  })

  return definitions
}

/**
 * 提取例句
 */
function extractExamples(block: Element): Example[] {
  const examples: Example[] = []
  const exampleBlocks = block.querySelectorAll('.examp.dexamp')

  exampleBlocks.forEach((exampleBlock) => {
    const engExample =
      exampleBlock.querySelector('.eg.deg')?.textContent?.trim() ||
      exampleBlock.querySelector('.eg')?.textContent?.trim()

    const chiExample =
      exampleBlock.querySelector('.trans.dtrans.dtrans-se')?.textContent?.trim() ||
      exampleBlock.querySelector('.trans.dtrans')?.textContent?.trim()

    if (engExample && engExample.length > 5 && engExample.length < 200) {
      examples.push({
        eng: engExample,
        chi: chiExample || '',
      })
    }
  })

  return examples
}

/**
 * 生成结果 HTML
 */
export function generateResultHTML(result: DictionaryResult): string {
  return `
    <div class="simple-tooltip">
      ${generateHeader(result)}
      <div class="tooltip-content">
        ${generatePronunciations(result.pronunciations)}
        ${generateDefinitions(result.definitions)}
      </div>
    </div>
  `
}

/**
 * 生成头部
 */
function generateHeader(result: DictionaryResult): string {
  return `
    <div class="tooltip-header">
      <span class="word-title">${escapeHtml(result.word)}</span>
      <span class="dictionary-name">${escapeHtml(CAMBRIDGE_CONFIG.name)}</span>
    </div>
  `
}

/**
 * 生成发音部分
 */
function generatePronunciations(pronunciations: Pronunciation[]): string {
  if (!pronunciations.length) return ''

  const items = pronunciations
    .map(
      (pron) => `
      <div class="pronunciation-item">
        <span class="region-label">${escapeHtml(pron.region)}</span>
        <span class="phonetic-text">/${escapeHtml(pron.text)}/</span>
        ${pron.audio ? generateAudioButton(pron.audio) : ''}
      </div>
    `
    )
    .join('')

  return `<div class="pronunciation-section">${items}</div>`
}

/**
 * 生成音频按钮
 */
function generateAudioButton(audioUrl: string): string {
  return `
    <button class="audio-btn" data-audio="${escapeHtml(audioUrl)}" title="播放发音">
      <svg class="audio-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
    </button>
  `
}

/**
 * 生成释义部分
 */
function generateDefinitions(definitions: Definition[]): string {
  if (!definitions.length) return ''

  const items = definitions
    .map(
      (def) => `
      <div class="definition-item">
        ${def.partOfSpeech ? `<span class="pos-tag">${escapeHtml(def.partOfSpeech)}</span>` : ''}
        <div class="definition-content">
          <p class="definition-text">${escapeHtml(def.definition)}</p>
          ${def.chinese ? `<p class="definition-translation">${escapeHtml(def.chinese)}</p>` : ''}
        </div>
        ${generateExamples(def.examples)}
      </div>
    `
    )
    .join('')

  return `<div class="definitions-section">${items}</div>`
}

/**
 * 生成例句部分
 */
function generateExamples(examples: Example[]): string {
  if (!examples.length) return ''

  const items = examples
    .map(
      (example) => `
      <div class="example-item">
        <p class="example-text">"${escapeHtml(example.eng)}"</p>
        ${example.chi ? `<p class="example-translation">${escapeHtml(example.chi)}</p>` : ''}
      </div>
    `
    )
    .join('')

  return `<div class="examples-container">${items}</div>`
}

/**
 * 生成错误 HTML
 */
function generateErrorHTML(message: string): string {
  return `<div class="error-container"><div class="error">${escapeHtml(message)}</div></div>`
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
