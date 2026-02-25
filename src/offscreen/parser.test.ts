// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseCambridgeHtml, generateResultHTML } from './parser'
import type { DictionaryResult } from '../types'
import { CAMBRIDGE_CONFIG } from '../types'

describe('parser', () => {
  it('parses pronunciations and definitions from Cambridge HTML', () => {
    const html = `
      <div class="entry">
        <div class="uk dpron-i">
          <span class="ipa dipa">/tɛst/</span>
          <audio>
            <source type="audio/mpeg" src="/media/english/uk_pron.mp3" />
          </audio>
        </div>
        <div class="us dpron-i">
          <span class="ipa dipa">/tɛst/</span>
          <audio>
            <source src="//media/english/us_pron.mp3" />
          </audio>
        </div>
        <span class="pos dpos">noun</span>
        <div class="def-block ddef_block">
          <div class="def ddef_d">a &lt; trial</div>
          <span class="trans dtrans dtrans-se">测试</span>
          <div class="examp dexamp">
            <span class="eg deg">This is a test example.</span>
            <span class="trans dtrans dtrans-se">这是一个例句。</span>
          </div>
        </div>
      </div>
    `

    const result = parseCambridgeHtml(html, 'test')

    expect(result).not.toBeNull()
    expect(result?.pronunciations.length).toBe(2)
    expect(result?.pronunciations[0]?.audio).toBe(
      `${CAMBRIDGE_CONFIG.baseUrl}/media/english/uk_pron.mp3`
    )
    expect(result?.definitions[0]?.definition).toBe('a < trial')
    expect(result?.definitions[0]?.examples.length).toBe(1)
  })

  it('returns null when no-result is present', () => {
    const html = '<div class="no-result"></div>'
    expect(parseCambridgeHtml(html, 'test')).toBeNull()
  })

  it('escapes HTML when generating result HTML', () => {
    const result: DictionaryResult = {
      word: '<b>test</b>',
      dictionary: 'cambridge',
      pronunciations: [
        {
          text: 'tɛst',
          region: 'UK',
          audio: 'https://example.com/audio".mp3',
        },
      ],
      definitions: [
        {
          partOfSpeech: '<script>',
          definition: 'a < b',
          chinese: '测&试',
          examples: [
            {
              eng: 'hello < world',
              chi: '<你好>',
            },
          ],
          order: 1,
        },
      ],
    }

    const html = generateResultHTML(result)

    expect(html).toContain('&lt;b&gt;test&lt;/b&gt;')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &lt; b')
    expect(html).toContain('测&amp;试')
    expect(html).toContain('&lt;你好&gt;')
    expect(html).toContain('audio&quot;.mp3')
  })
})
