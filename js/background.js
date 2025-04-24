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
  chrome.storage.local.get(['vocabulary', 'highlightEnabled'], (result) => {
    if (!result.vocabulary) {
      chrome.storage.local.set({ vocabulary: {} });
    }
    
    if (result.highlightEnabled === undefined) {
      chrome.storage.local.set({ highlightEnabled: true });
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
  chrome.storage.local.get(['vocabulary'], (result) => {
    const vocabulary = result.vocabulary || {};
    
    // 检查单词是否已存在
    if (vocabulary[word]) {
      // 显示已存在通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '生词本提示',
        message: `"${word}" 已经在您的生词本中`,
        priority: 0
      });
      return;
    }
    
    // 添加单词，使用单词本身作为键
    vocabulary[word] = {
      addedAt: new Date().toISOString()
      // 这里可以保存更多信息，如翻译、例句等
    };
    
    chrome.storage.local.set({ vocabulary: vocabulary }, () => {
      // 通知当前标签页重新高亮
      chrome.tabs.sendMessage(tabId, { action: 'refreshHighlights' });
      
      // 显示通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '生词本',
        message: `"${word}" 已添加到您的生词本`,
        priority: 0
      });
    });
  });
}