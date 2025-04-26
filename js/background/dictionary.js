/**
 * 词典查询模块
 * 负责处理单词查询请求和管理单词定义缓存
 */

import { ensureOffscreenDocument } from './offscreen-manager.js';

// 获取单词定义
export async function fetchWordDefinition(word, tabId = null) {
  console.log(`开始获取单词 "${word}" 的定义，目标标签页: ${tabId || '无'}`);
  const cleanWord = word.trim();
  const lowerCaseWord = cleanWord.toLowerCase();
  if (!cleanWord) {
    console.warn(`请求获取的单词为空，已停止处理`);
    return;
  }

  // 构建剑桥词典URL (简明英汉)
  const url = `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${encodeURIComponent(cleanWord)}`;
  console.log(`请求英汉词典 URL: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // 如果简明英汉词典找不到，尝试只用英文词典
      console.log(`'${cleanWord}' not found in English-Chinese Simplified, trying English dictionary...`);
      const englishUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord)}`;
      console.log(`请求英文词典 URL: ${englishUrl}`);
      const englishResponse = await fetch(englishUrl);
      if (!englishResponse.ok) {
        throw new Error(`HTTP error! status: ${englishResponse.status} for both dictionaries`);
      }
      const html = await englishResponse.text();
      // 解析英文词典HTML
      const definition = await parseCambridgeDictionaryHTML(html, cleanWord, 'en');
      handleFetchSuccess(word, lowerCaseWord, definition, tabId);
    } else {
      const html = await response.text();
      // 解析英汉词典HTML
      const definition = await parseCambridgeDictionaryHTML(html, cleanWord, 'en-zh');
      handleFetchSuccess(word, lowerCaseWord, definition, tabId);
    }
  } catch (error) {
    console.error(`获取单词 ${word} 的定义失败:`, error);
    handleFetchError(word, tabId, error.message);
  }
}

// 处理获取成功的情况
function handleFetchSuccess(originalWord, lowerCaseWord, definition, tabId) {
  console.log(`成功获取单词 "${originalWord}" 的定义:`, definition);
  // 将定义存入缓存
  chrome.storage.local.get(['wordDefinitions'], (result) => {
    const wordDefinitions = result.wordDefinitions || {};
    wordDefinitions[lowerCaseWord] = {
      timestamp: Date.now(),
      data: definition
    };
    chrome.storage.local.set({ wordDefinitions: wordDefinitions }, () => {
      console.log(`已将 "${lowerCaseWord}" 的定义缓存到本地存储`);
    });
  });

  // 如果有Tab ID，则发送结果回内容脚本
  if (tabId) {
    console.log(`发送单词定义结果到标签页 ${tabId}`);
    chrome.tabs.sendMessage(tabId, {
      action: 'wordDefinitionResult',
      word: originalWord, // 返回原始大小写的单词
      definition: definition
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(`向 tab ${tabId} 发送 wordDefinitionResult (成功) 失败: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`成功向标签页 ${tabId} 发送单词定义结果，响应:`, response);
      }
    });
  }
}

// 处理获取失败的情况
function handleFetchError(originalWord, tabId, errorMessage) {
  console.error(`获取单词 "${originalWord}" 的定义失败: ${errorMessage}`);
  // 如果有Tab ID，发送错误信息回内容脚本
  if (tabId) {
    console.log(`发送单词定义错误信息到标签页 ${tabId}`);
    chrome.tabs.sendMessage(tabId, {
      action: 'wordDefinitionResult',
      word: originalWord,
      definition: { error: true, message: `无法获取单词定义 (${errorMessage})` }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(`向 tab ${tabId} 发送 wordDefinitionResult (失败) 失败: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`成功向标签页 ${tabId} 发送单词定义错误信息，响应:`, response);
      }
    });
  }
}

// 检查并从缓存返回单词定义
export function getWordDefinitionFromCache(word, tabId = null) {
  const lowerCaseWord = word.toLowerCase();
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['wordDefinitions'], (result) => {
      const wordDefinitions = result.wordDefinitions || {};
      const cacheDuration = 7 * 24 * 60 * 60 * 1000; // 7天缓存
      
      // 如果缓存中有定义且未过期
      if (wordDefinitions[lowerCaseWord] && 
          wordDefinitions[lowerCaseWord].timestamp > Date.now() - cacheDuration) {
        console.log(`单词 "${word}" 的定义已在缓存中，直接返回`);
        resolve({
          found: true,
          data: wordDefinitions[lowerCaseWord].data
        });
      } else {
        resolve({ found: false });
      }
    });
  });
}

// 处理单词定义请求
export async function handleWordDefinitionRequest(word, tabId) {
  if (!word || !word.trim()) {
    handleEmptyWordError(tabId, word);
    return;
  }

  const cacheResult = await getWordDefinitionFromCache(word, tabId);
  
  if (cacheResult.found) {
    // 发送缓存的定义
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'wordDefinitionResult',
        word: word,
        definition: cacheResult.data
      });
    }
  } else {
    // 获取新的定义
    fetchWordDefinition(word, tabId);
  }
}

// 处理空单词错误
function handleEmptyWordError(tabId, originalWord) {
  console.warn(`请求的单词为空，无法获取定义`);
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: 'wordDefinitionResult',
      word: originalWord,
      definition: { error: true, message: '无效的单词' }
    });
  }
}

// 初始化词典缓存
export function initDictionaryCache() {
  chrome.storage.local.get(['wordDefinitions'], (result) => {
    if (!result.wordDefinitions) {
      chrome.storage.local.set({ wordDefinitions: {} });
    }
  });
}

// 解析剑桥词典HTML - 通过 offscreen 文档
export async function parseCambridgeDictionaryHTML(html, word, dictionaryType) {
  try {
    console.log(`开始解析${dictionaryType}词典HTML，单词: ${word}`);
    
    // 确保offscreen文档已创建，现在使用静态导入
    await ensureOffscreenDocument();
    
    // 创建一个 Promise，等待解析结果
    return new Promise((resolve, reject) => {
      // 设置一个监听器，用于接收来自 offscreen 文档的解析结果
      const messageListener = (message) => {
        if (message.action === 'parseHTMLResult') {
          // 移除监听器，避免内存泄漏
          chrome.runtime.onMessage.removeListener(messageListener);
          
          if (message.success) {
            console.log('成功从 offscreen 文档接收到解析结果');
            resolve(message.result);
          } else {
            console.error('offscreen 文档解析失败:', message.error);
            resolve({
              error: true,
              message: message.error || '解析词典内容失败',
              word: word
            });
          }
        }
      };
      
      // 添加监听器
      chrome.runtime.onMessage.addListener(messageListener);
      
      // 发送 HTML 到 offscreen 文档进行解析
      chrome.runtime.sendMessage({
        action: 'parseHTML',
        html,
        word,
        dictionaryType
      }).catch(error => {
        chrome.runtime.onMessage.removeListener(messageListener);
        console.error('发送 HTML 到 offscreen 文档时出错:', error);
        reject(error);
      });
      
      // 设置超时，避免永久等待
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error('解析 HTML 超时'));
      }, 10000);  // 10秒超时
    });
  } catch (error) {
    console.error(`解析单词'${word}'的HTML时出错:`, error);
    return {
      error: true,
      message: '解析词典内容失败',
      details: error.message,
      word: word
    };
  }
}