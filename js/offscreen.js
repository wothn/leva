// ==================== 词典解析系统 ====================

// 监听来自主页面的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "offscreen" && message.action === "parseDefinition") {
    // 添加超时保护，防止长时间无响应
    const timeout = setTimeout(() => {
      console.error("解析超时，超过30秒");
      sendResponse({ definition: null, error: "解析超时" });
    }, 30000);

    parseDefinition(message.word).then(definition => {
      clearTimeout(timeout);
      sendResponse({ definition });
    }).catch(error => {
      clearTimeout(timeout);
      console.error("Error parsing definition:", error);
      sendResponse({ definition: null, error: error.message });
    });
    return true; // 保持消息通道开放以异步响应
  }
});

// ==================== 剑桥词典配置 ====================

// 剑桥词典配置
const CAMBRIDGE_CONFIG = {
  name: '剑桥词典',
  url: (word) => `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${word}`,
  baseUrl: 'https://dictionary.cambridge.org',
  description: '提供中英文双语定义和例句'
};

// 解析配置
const PARSER_CONFIG = {
  maxExamplesPerDefinition: 5  // 每个释义最多显示的例句数量
};

// 通用请求头
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache'
};

// ==================== 主解析函数 ====================

async function parseDefinition(word) {
  try {
    if (!word || !word.trim()) {
      return generateErrorHTML('请输入要查询的单词');
    }

    const cleanWord = word.trim().toLowerCase();
    
    // 首先检查缓存
    const cachedResult = await getFromCache(cleanWord);
    if (cachedResult) {
      return generateResultHTML(cachedResult);
    }
    
    console.log(`从剑桥词典获取"${cleanWord}"的释义...`);
    const result = await fetchFromCambridge(cleanWord);
    
    if (result && result.definitions && result.definitions.length > 0) {
      console.log(`成功从剑桥词典获取释义`);
      // 将结果存储到缓存中
      await saveToCache(cleanWord, result);
      return generateResultHTML(result);
    }

    return generateErrorHTML(`未能从剑桥词典找到"${cleanWord}"的释义`);
  } catch (error) {
    console.error('解析定义时发生未预期的错误:', error);
    return generateErrorHTML(`解析错误: ${error.message}`);
  }
}

// ==================== 剑桥词典解析器 ====================

async function fetchFromCambridge(word) {
  const url = CAMBRIDGE_CONFIG.url(word);
  
  try {
    // 使用 fetch 获取页面内容，添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch(url, {
      headers: COMMON_HEADERS,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP错误! 状态码: ${response.status}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('获取到的页面内容为空');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc || doc.querySelector('parsererror')) {
      throw new Error('HTML解析失败');
    }
    
    return parseCambridgeDictionary(doc, word);
  } catch (error) {
    console.error(`获取剑桥词典数据失败:`, error.message);
    throw error;
  }
}

// 修正音频URL的辅助函数
function fixAudioUrl(url, baseUrl) {
  if (!url) return '';
  
  // 如果已经是完整URL，直接返回
  if (url.startsWith('http')) {
    return url;
  }
  
  // 处理协议相对URL
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // 处理绝对路径URL
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  
  // 其他情况，添加到基础URL后面
  return `${baseUrl}/${url}`;
}

function parseCambridgeDictionary(doc, word) {
  // 检查是否找到单词
  if (doc.querySelector('.no-result, .not-found')) {
    return null;
  }

  const result = {
    word: word,
    dictionary: 'cambridge',
    pronunciations: [],
    definitions: []
  };

  // 提取发音信息 - 基于example.html的结构
  try {
    // 英式发音
    const ukPronContainer = doc.querySelector('.uk.dpron-i');
    if (ukPronContainer) {
      const ukPhonetic = ukPronContainer.querySelector('.ipa.dipa')?.textContent?.trim();
      let ukAudio = '';
      
      // 提取音频链接（从audio元素的source子元素中获取）
      const ukAudioElement = ukPronContainer.querySelector('audio');
      if (ukAudioElement) {
        // 优先选择audio/mpeg格式，否则选择第一个可用的
        const preferredSource = ukAudioElement.querySelector('source[type="audio/mpeg"]');
        if (preferredSource) {
          ukAudio = preferredSource.getAttribute('src');
        } else {
          const firstSource = ukAudioElement.querySelector('source');
          if (firstSource) {
            ukAudio = firstSource.getAttribute('src');
          }
        }
        
        // 修正音频URL确保完整
        if (ukAudio) {
          ukAudio = fixAudioUrl(ukAudio, CAMBRIDGE_CONFIG.baseUrl);
          console.log('UK音频链接:', ukAudio);
        }
      }
      
      if (ukPhonetic) {
        result.pronunciations.push({
          text: ukPhonetic,
          region: 'UK',
          audio: ukAudio,
          partOfSpeech: ''
        });
      }
    }
    
    // 美式发音
    const usPronContainer = doc.querySelector('.us.dpron-i');
    if (usPronContainer) {
      const usPhonetic = usPronContainer.querySelector('.ipa.dipa')?.textContent?.trim();
      let usAudio = '';
      
      // 提取音频链接（从audio元素的source子元素中获取）
      const usAudioElement = usPronContainer.querySelector('audio');
      if (usAudioElement) {
        // 优先选择audio/mpeg格式，否则选择第一个可用的
        const preferredSource = usAudioElement.querySelector('source[type="audio/mpeg"]');
        if (preferredSource) {
          usAudio = preferredSource.getAttribute('src');
        } else {
          const firstSource = usAudioElement.querySelector('source');
          if (firstSource) {
            usAudio = firstSource.getAttribute('src');
          }
        }
        
        // 修正音频URL确保完整
        if (usAudio) {
          usAudio = fixAudioUrl(usAudio, CAMBRIDGE_CONFIG.baseUrl);
          console.log('US音频链接:', usAudio);
        }
      }
      
      if (usPhonetic) {
        result.pronunciations.push({
          text: usPhonetic,
          region: 'US',
          audio: usAudio,
          partOfSpeech: ''
        });
      }
    }
  } catch (error) {
    console.warn('提取剑桥词典发音失败:', error);
  }

  // 提取词性信息
  let partOfSpeech = '';
  const posElement = doc.querySelector('.pos.dpos');
  if (posElement) {
    partOfSpeech = posElement.textContent.trim();
  }

  // 提取释义和例句 - 基于example.html的结构
  try {
    const defBlocks = doc.querySelectorAll('.def-block.ddef_block');
    let definitionIndex = 1;
    
    defBlocks.forEach(block => {
      // 提取定义
      const defElement = block.querySelector('.def.ddef_d');
      const defText = defElement ? defElement.textContent.trim() : '';
      
      // 提取中文翻译
      const chineseElement = block.querySelector('.trans.dtrans.dtrans-se');
      const chineseText = chineseElement ? chineseElement.textContent.trim() : '';
      
      if (defText) {
        // 提取例句
        const examples = [];
        const exampleBlocks = block.querySelectorAll('.examp.dexamp');
        
        exampleBlocks.forEach((exampleBlock, index) => {
          try {
            // 尝试使用主要选择器提取英文例句
            let engExample = exampleBlock.querySelector('.eg.deg')?.textContent?.trim();
            
            // 如果主要选择器未找到，尝试备选选择器
            if (!engExample) {
              engExample = exampleBlock.querySelector('.eg')?.textContent?.trim();
            }
            
            // 尝试使用主要选择器提取中文翻译
            let chiExample = exampleBlock.querySelector('.trans.dtrans.dtrans-se')?.textContent?.trim();
            
            // 如果主要选择器未找到，尝试备选选择器
            if (!chiExample) {
              chiExample = exampleBlock.querySelector('.trans.dtrans')?.textContent?.trim();
            }
            
            console.log(`解析例句 ${index + 1}:`, { engExample, chiExample });
            
            if (engExample && engExample.length > 5 && engExample.length < 200) {
              examples.push({
                eng: engExample,
                chi: chiExample || ''
              });
            } else if (engExample) {
              console.warn(`例句 ${index + 1} 不符合长度要求:`, engExample.length);
            }
          } catch (exampleError) {
            console.error(`解析例句 ${index + 1} 时出错:`, exampleError);
          }
        });
        
        result.definitions.push({
          partOfSpeech: partOfSpeech || '未知',
          definition: defText,
          examples: examples.slice(0, PARSER_CONFIG.maxExamplesPerDefinition), // 限制每个释义的例句数量
          chinese: chineseText,
          order: definitionIndex++
        });
      }
    });
  } catch (error) {
    console.warn('提取剑桥词典释义失败:', error);
  }

  return result.definitions.length > 0 ? result : null;
}

// ==================== HTML 结果生成器 ====================

function generateResultHTML(result) {
  return `
    <div class="simple-tooltip">
      ${generateSimpleHeader(result)}
      <div class="tooltip-content">
        ${generateSimplePronunciations(result.pronunciations)}
        ${generateSimpleDefinitions(result.definitions)}
      </div>
    </div>
  `;
}

function generateSimpleHeader(result) {
  return `
    <div class="tooltip-header">
      <span class="word-title">${result.word}</span>
      <span class="dictionary-name">剑桥词典</span>
    </div>
  `;
}

function generateSimplePronunciations(pronunciations) {
  if (!pronunciations || pronunciations.length === 0) return '';
  
  const pronItems = pronunciations
    .map(pron => `
      <div class="pronunciation-item">
        <span class="region-label">${pron.region}</span>
        <span class="phonetic-text">/${pron.text}/</span>
        ${pron.audio ? `<button class="audio-btn" data-audio="${pron.audio}" title="播放发音">
          <svg class="audio-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </button>` : ''}
      </div>
    `)
    .join('');
    
  return `
    <div class="pronunciation-section">
      ${pronItems}
    </div>
  `;
}

function generateSimpleDefinitions(definitions) {
  if (!definitions || definitions.length === 0) return '';
  
  // 显示所有释义
  const limitedDefinitions = definitions;
  
  const defItems = limitedDefinitions
    .map((def, index) => `
      <div class="definition-item">
        ${def.partOfSpeech ? `<span class="pos-tag">${def.partOfSpeech}</span>` : ''}
        <div class="definition-content">
          <p class="definition-text">${def.definition}</p>
          ${def.chinese ? `<p class="definition-translation">${def.chinese}</p>` : ''}
        </div>
        ${generateSimpleExamples(def.examples)}
      </div>
    `)
    .join('');
    
  return `
    <div class="definitions-section">
      ${defItems}
    </div>
  `;
}

function generateSimpleExamples(examples) {
  if (!examples || examples.length === 0) return '';
  
  // 显示所有例句
  const limitedExamples = examples;
  
  const exampleItems = limitedExamples
    .map(example => `
      <div class="example-item">
        <p class="example-text">"${example.eng}"</p>
        ${example.chi ? `<p class="example-translation">${example.chi}</p>` : ''}
      </div>
    `)
    .join('');
    
  return `
    <div class="examples-container">
      ${exampleItems}
    </div>
  `;
}

function generateErrorHTML(message) {
  return `<div class="error-container"><div class="error">${message}</div></div>`;
}

// ==================== 缓存管理 ====================

// 缓存过期时间（1天）
const CACHE_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 1天转换为毫秒

/**
 * 从缓存中获取数据
 * @param {string} word - 要查询的单词
 * @returns {Promise<object|null>} 缓存的数据或null
 */
async function getFromCache(word) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getFromCache",
      word: word.toLowerCase()
    });
    
    if (response && response.data) {
      const { data, timestamp } = response.data;
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - timestamp < CACHE_EXPIRATION_TIME) {
        console.log(`使用"${word}"的缓存数据`);
        return data;
      } else {
        console.log(`"${word}"的缓存已过期`);
        // 请求删除过期的缓存
        await chrome.runtime.sendMessage({
          action: "removeFromCache",
          word: word.toLowerCase()
        });
      }
    }
    
    return null;
  } catch (error) {
    console.error('从缓存获取数据时出错:', error);
    return null;
  }
}

/**
 * 将数据存储到缓存中
 * @param {string} word - 单词
 * @param {object} data - 要缓存的数据
 */
async function saveToCache(word, data) {
  try {
    await chrome.runtime.sendMessage({
      action: "saveToCache",
      word: word.toLowerCase(),
      data: data
    });
    console.log(`"${word}"的释义已缓存`);
  } catch (error) {
    console.error('保存到缓存时出错:', error);
  }
}
