/**
 * 生词本管理模块
 * 负责添加单词到生词本和管理生词本数据
 */

// 添加单词到词汇表
export function addWordToVocabulary(word, tabId) {
  console.log(`尝试添加单词 "${word}" 到生词本，来自标签页 ${tabId}`);
  chrome.storage.local.get(['vocabulary'], (result) => {
    const vocabulary = result.vocabulary || {};

    // 检查单词是否已存在
    if (vocabulary[word]) {
      // 发送单词已存在消息到内容脚本
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { 
          action: 'wordAlreadyExists', 
          word: word 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`向 tab ${tabId} 发送 wordAlreadyExists 失败: ${chrome.runtime.lastError.message}`);
          }
        });
      }
      return;
    }

    // 添加单词，使用单词本身作为键
    vocabulary[word] = {
      addedAt: new Date().toISOString()
      // 这里可以保存更多信息，如翻译、例句等
    };

    saveVocabulary(vocabulary, word, tabId);
  });
}

// 保存生词本并向内容脚本发送通知
function saveVocabulary(vocabulary, word, tabId) {
  chrome.storage.local.set({ vocabulary: vocabulary }, () => {
    console.log(`成功将单词 "${word}" 添加到生词本`);
    
    // 通知当前标签页重新高亮
    if (tabId) {
      // 发送刷新高亮消息
      chrome.tabs.sendMessage(tabId, { action: 'refreshHighlights' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`向 tab ${tabId} 发送 refreshHighlights 失败: ${chrome.runtime.lastError.message}`);
        } else {
          console.log(`成功向标签页 ${tabId} 发送刷新高亮指令，响应:`, response);
        }
      });
      
      // 发送单词添加成功的消息
      chrome.tabs.sendMessage(tabId, { 
        action: 'wordAdded', 
        word: word 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`向 tab ${tabId} 发送 wordAdded 失败: ${chrome.runtime.lastError.message}`);
        }
      });
    }
  });
}

// 初始化词汇存储
export function initVocabularyStorage() {
  chrome.storage.local.get(['vocabulary'], (result) => {
    if (!result.vocabulary) {
      chrome.storage.local.set({ vocabulary: {} });
    }
  });
}