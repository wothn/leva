// 创建右键菜单的函数
function createContextMenu() {
  // 确保删除之前可能存在的菜单，避免重复
  chrome.contextMenus.removeAll(() => {
    // 创建右键菜单项
    chrome.contextMenus.create({
      id: "addToVocabulary",
      title: '添加"%s"到生词本',
      contexts: ["selection"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("创建右键菜单失败:", chrome.runtime.lastError);
      } else {
        console.log("成功创建右键菜单");
      }
    });
  });
}

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  createContextMenu();

  // 初始化存储
  chrome.storage.local.get(['vocabulary', 'highlightEnabled', 'wordDefinitions'], (result) => { // 添加 wordDefinitions
    if (!result.vocabulary) {
      chrome.storage.local.set({ vocabulary: {} });
    }

    if (result.highlightEnabled === undefined) {
      chrome.storage.local.set({ highlightEnabled: true });
    }

    // 初始化单词定义缓存
    if (!result.wordDefinitions) {
      chrome.storage.local.set({ wordDefinitions: {} });
    }
  });
});

// 确保在浏览器启动时也创建右键菜单
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addToVocabulary" && info.selectionText) {
    const word = info.selectionText.trim();

    if (word) {
      addWordToVocabulary(word, tab.id);
    }
  }
});

// 添加单词到词汇表
function addWordToVocabulary(word, tabId) {
  console.log(`尝试添加单词 "${word}" 到生词本，来自标签页 ${tabId}`);
  chrome.storage.local.get(['vocabulary'], (result) => {
    const vocabulary = result.vocabulary || {};

    // 检查单词是否已存在
    if (vocabulary[word]) {
      console.log(`单词 "${word}" 已存在于生词本中，显示已存在通知`);
      // 显示已存在通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: '生词本提示',
        message: `"${word}" 已经在您的生词本中`,
        priority: 0
      }, (notificationId) => {
        console.log(`已显示"单词已存在"通知，ID: ${notificationId}`);
      });
      return;
    }

    // 添加单词，使用单词本身作为键
    vocabulary[word] = {
      addedAt: new Date().toISOString()
      // 这里可以保存更多信息，如翻译、例句等
    };

    chrome.storage.local.set({ vocabulary: vocabulary }, () => {
      console.log(`成功将单词 "${word}" 添加到生词本`);
      // 通知当前标签页重新高亮
      if (tabId) { // 确保 tabId 有效
        console.log(`发送 refreshHighlights 消息到标签页 ${tabId}`);
        chrome.tabs.sendMessage(tabId, { action: 'refreshHighlights' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`向 tab ${tabId} 发送 refreshHighlights 失败: ${chrome.runtime.lastError.message}`);
          } else {
            console.log(`成功向标签页 ${tabId} 发送刷新高亮指令，响应:`, response);
          }
        });
      }

      // 显示通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: '生词本',
        message: `"${word}" 已添加到您的生词本`,
        priority: 0
      }, (notificationId) => {
        console.log(`已显示"单词添加成功"通知，ID: ${notificationId}`);
      });

      // 尝试获取单词定义并存储 (可选：添加单词时预缓存定义)
      // fetchWordDefinition(word); // 取消注释以启用预缓存
    });
  });
}

// 监听来自内容脚本或弹出窗口的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchWordDefinition') {
    console.log(`接收到获取单词定义请求: "${request.word}"，来自标签页 ${sender.tab?.id}`);
    const word = request.word.trim();
    if (!word) {
        console.warn(`请求的单词为空，无法获取定义`);
        // 如果单词为空，直接返回错误
         if (sender.tab?.id) {
             chrome.tabs.sendMessage(sender.tab.id, {
                action: 'wordDefinitionResult',
                word: request.word,
                definition: { error: true, message: '无效的单词' }
            });
            console.log(`已发送无效单词错误消息到标签页 ${sender.tab.id}`);
         }
        return false; // 无需异步响应
    }

    // 检查缓存中是否已有此单词的定义
    chrome.storage.local.get(['wordDefinitions'], (result) => {
      const wordDefinitions = result.wordDefinitions || {};
      const lowerCaseWord = word.toLowerCase();
      const cacheDuration = 7 * 24 * 60 * 60 * 1000; // 7天缓存

      // 如果缓存中有定义且未过期
      if (wordDefinitions[lowerCaseWord] && wordDefinitions[lowerCaseWord].timestamp > Date.now() - cacheDuration) {
        console.log(`单词 "${word}" 的定义已在缓存中，直接返回`);
        // 发送缓存的定义回内容脚本
         if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'wordDefinitionResult',
                word: request.word, // 返回原始大小写的单词
                definition: wordDefinitions[lowerCaseWord].data
            });
            console.log(`已发送缓存的单词定义到标签页 ${sender.tab.id}`);
         }
      } else {
        // 否则获取新的定义
        fetchWordDefinition(word, sender.tab?.id);
      }
    });
    return true; // 表示将异步发送响应
  }
  // 处理来自 content.js 的音频播放请求
  else if (request.action === 'requestAudioPlayback') {
    console.log('Background: 收到音频播放请求:', request.audioPath);
    handleAudioPlaybackRequest(request.audioPath)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Background: 处理音频播放请求失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  // 处理来自 offscreen.js 的音频播放错误报告 (可选)
  else if (request.action === 'audioPlaybackError') {
     console.error('Background: Offscreen 报告音频播放错误:', request.error);
     // 可以选择将错误转发给内容脚本
     // if (sender.origin && sender.origin.startsWith('chrome-extension://')) {
     //   // 查找可能需要通知的标签页... 比较复杂，暂时只记录日志
     // }
  }
  // 保留其他可能的监听器逻辑
  // else if (request.action === '...') { ... }

   return false; // 对于非异步消息或未处理的消息
});

// --- 新增函数：处理音频播放请求 ---
async function handleAudioPlaybackRequest(audioPath) {
  if (!audioPath) {
    throw new Error('音频路径无效');
  }
  
  // 如果路径不是以/开头，添加/
  const cleanPath = audioPath.startsWith('/') ? audioPath : '/' + audioPath;
  // 构建完整的URL
  const audioUrl = 'https://dictionary.cambridge.org' + cleanPath;

  try {
    console.log('Background: 正在准备音频播放:', audioUrl);
    
    // 确保 Offscreen 文档存在
    await ensureOffscreenDocument();

    // 发送音频URL到 Offscreen 文档进行播放，而不是发送二进制数据
    chrome.runtime.sendMessage({
      target: 'offscreen', // 目标标识符
      action: 'playAudioOffscreen',
      audioUrl: audioUrl    // 发送URL而不是二进制数据
    });

  } catch (error) {
    console.error('Background: 准备音频播放失败:', error);
    throw error; // 重新抛出错误，以便调用者知道失败了
  }
}

// --- 新增或修改：确保 Offscreen 文档存在的函数 ---
let creatingOffscreenPromise = null; // 防止并发创建

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl] // 查找特定 URL 的文档
  });

  if (existingContexts.length > 0) {
    console.log('Background: Offscreen 文档已存在');
    return;
  }

  // 如果正在创建，则等待现有 Promise 完成
  if (creatingOffscreenPromise) {
    console.log('Background: 等待正在进行的 Offscreen 文档创建...');
    await creatingOffscreenPromise;
    return;
  }

  console.log('Background: 创建 Offscreen 文档...');
  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: [chrome.offscreen.Reason.DOM_PARSER, chrome.offscreen.Reason.AUDIO_PLAYBACK], // 添加 AUDIO_PLAYBACK 原因
    justification: '解析词典 HTML 和播放音频'
  });

  try {
    await creatingOffscreenPromise;
    console.log('Background: Offscreen 文档创建成功');
  } catch (error) {
    console.error('Background: 创建 Offscreen 文档失败:', error);
    throw error; // 抛出错误
  } finally {
    creatingOffscreenPromise = null; // 重置 Promise 状态
  }
}

// 获取单词定义
async function fetchWordDefinition(word, tabId = null) {
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

// 解析剑桥词典HTML - 通过 offscreen 文档
async function parseCambridgeDictionaryHTML(html, word, dictionaryType) {
  try {
    console.log(`开始解析${dictionaryType}词典HTML，单词: ${word}`);

    // 检查 offscreen 文档是否已创建
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    
    // 如果 offscreen 文档不存在，则创建一个
    if (!existingContexts.some(c => c.documentUrl === offscreenUrl)) {
      console.log('创建 offscreen 文档');
      await chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: '解析词典 HTML 需要 DOMParser'
      });
    }
    
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

// 提取释义和例句的辅助函数 - 使用 offscreen 文档解析 HTML
async function extractDefinitionsAndExamplesFromHTML(html, dictionaryType) {
  console.log('准备使用 offscreen API 解析 HTML');
  
  try {
    // 检查 offscreen 文档是否已创建
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    
    // 如果 offscreen 文档不存在，则创建一个
    if (!existingContexts.some(c => c.documentUrl === offscreenUrl)) {
      console.log('创建 offscreen 文档');
      await chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: '解析词典 HTML 需要 DOMParser'
      });
    }
    
    // 创建一个 Promise，等待解析结果
    return new Promise((resolve, reject) => {
      // 设置一个监听器，用于接收来自 offscreen 文档的解析结果
      const messageListener = (message) => {
        if (message.action === 'parseHTMLResult') {
          // 移除监听器，避免内存泄漏
          chrome.runtime.onMessage.removeListener(messageListener);
          
          if (message.success) {
            console.log('成功从 offscreen 文档接收到解析结果');
            resolve(message.result.definitions || []);
          } else {
            console.error('offscreen 文档解析失败:', message.error);
            resolve([]);
          }
        }
      };
      
      // 添加监听器
      chrome.runtime.onMessage.addListener(messageListener);
      
      // 发送 HTML 到 offscreen 文档进行解析
      chrome.runtime.sendMessage({
        action: 'parseHTML',
        html,
        word: '',  // 这里可以传入单词，但由于我们只需要解析部分，可以留空
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
    console.error('使用 offscreen API 解析 HTML 时出错:', error);
    return [];
  }
}

// 清理HTML标签和多余字符
function cleanupHTML(text) {
  return text
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&nbsp;/g, ' ') // 替换HTML空格编码
    .replace(/&amp;/g, '&')  // 替换HTML & 编码
    .replace(/&#39;/g, "'")   // 替换HTML单引号编码
    .replace(/&quot;/g, '"')  // 替换HTML双引号编码
    .trim(); // 去除前后空格
}
