// 创建右键菜单
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: "addWord",
    title: "添加到生词本",
    contexts: ["selection"]
  });
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "addWord" && info.selectionText) {
    const word = info.selectionText.trim().toLowerCase();
    
    // 存储单词到Chrome Storage
    chrome.storage.local.get({ vocabulary: [] }, (result) => {
      const vocabulary = result.vocabulary;
      
      // 检查单词是否已存在
      if (!vocabulary.includes(word)) {
        vocabulary.push(word);
        chrome.storage.local.set({ vocabulary }, () => {
          // 显示通知
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "生词本",
            message: `已添加单词: ${word}`
          });
          
          // 发送消息到内容脚本以更新高亮
          chrome.tabs.sendMessage(tab.id, { action: "updateHighlight" });
        });
      } else {
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon48.png"),
          title: "生词本",
          message: `单词已在生词本中: ${word}`
        });
      }
    });
  }
});

// 监听快捷键
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "add_selected_word") {
    // 获取当前标签页选中的文本
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const word = results[0].result.trim().toLowerCase();
        
        if (word) {
          // 存储单词到Chrome Storage
          chrome.storage.local.get({ vocabulary: [] }, (result) => {
            const vocabulary = result.vocabulary;
            
            // 检查单词是否已存在
            if (!vocabulary.includes(word)) {
              vocabulary.push(word);
              chrome.storage.local.set({ vocabulary }, () => {
                // 显示通知
                chrome.notifications.create({
                  type: "basic",
                  iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                  title: "生词本",
                  message: `已添加单词: ${word}`
                });
                
                // 发送消息到内容脚本以更新高亮
                chrome.tabs.sendMessage(tab.id, { action: "updateHighlight" });
              });
            } else {
              chrome.notifications.create({
                type: "basic",
                iconUrl: chrome.runtime.getURL("icons/icon48.png"),
                title: "生词本",
                message: `单词已在生词本中: ${word}`
              });
            }
          });
        }
      }
    });
  }
});

// 处理词典查询请求和缓存操作
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getDefinition") {
    // 创建离屏文档用于解析词典页面
    createOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({
        target: "offscreen",
        action: "parseDefinition",
        word: request.word
      }).then(response => {
        sendResponse(response);
      }).catch(error => {
        console.error("Error sending message to offscreen document:", error);
        sendResponse({ definition: null, error: error.message });
      });
    }).catch(error => {
      console.error("Error creating offscreen document:", error);
      sendResponse({ definition: null, error: error.message });
    });
    return true; // 保持消息通道开放以异步响应
  } else if (request.action === "getFromCache") {
    // 从缓存中获取数据
    const key = `definition_${request.word}`;
    chrome.storage.local.get(key, (result) => {
      sendResponse({ data: result[key] || null });
    });
    return true; // 保持消息通道开放以异步响应
  } else if (request.action === "saveToCache") {
    // 将数据保存到缓存
    const key = `definition_${request.word}`;
    const cacheData = {
      data: request.data,
      timestamp: Date.now()
    };
    chrome.storage.local.set({ [key]: cacheData }, () => {
      sendResponse({ success: true });
    });
    return true; // 保持消息通道开放以异步响应
  } else if (request.action === "removeFromCache") {
    // 从缓存中删除数据
    const key = `definition_${request.word}`;
    chrome.storage.local.remove(key, () => {
      sendResponse({ success: true });
    });
    return true; // 保持消息通道开放以异步响应
  }
  // 必须返回 undefined 或 false，除非我们明确要异步响应
  return false;
});

// 创建离屏文档用于解析词典页面
async function createOffscreenDocument() {
  try {
    // 检查是否已经存在离屏文档
    if (await chrome.offscreen.hasDocument()) {
      return;
    }
    
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['DOM_PARSER'],
      justification: 'Parse dictionary page for word definitions'
    });
  } catch (error) {
    // 如果离屏文档已经存在，则忽略错误
    if (!error.message.includes('Only a single offscreen') && !error.message.includes('document is already created')) {
      console.error('Error creating offscreen document:', error);
      throw error;
    }
  }
}