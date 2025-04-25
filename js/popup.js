document.addEventListener('DOMContentLoaded', () => {
  const wordsList = document.getElementById('wordsList');
  const searchInput = document.getElementById('searchInput');
  const toggleHighlightBtn = document.getElementById('toggleHighlight');
  const exportWordsBtn = document.getElementById('exportWords');
  const clearWordsBtn = document.getElementById('clearWords');
  const clearCacheBtn = document.getElementById('clearCache');
  
  // 加载所有保存的生词
  loadVocabulary();
  
  // 搜索功能
  searchInput.addEventListener('input', () => {
    loadVocabulary(searchInput.value);
  });
  
  // 切换高亮功能
  toggleHighlightBtn.addEventListener('click', () => {
    chrome.storage.local.get(['highlightEnabled'], (result) => {
      const isEnabled = !(result.highlightEnabled === true);
      chrome.storage.local.set({ highlightEnabled: isEnabled }, () => {
        // 更新按钮文本
        toggleHighlightBtn.textContent = isEnabled ? '关闭高亮' : '开启高亮';
        
        // 向当前标签页发送消息（添加错误处理）
        sendMessageToCurrentTab({ action: 'toggleHighlight', state: isEnabled });
      });
    });
  });
  
  // 导出生词
  exportWordsBtn.addEventListener('click', () => {
    chrome.storage.local.get(['vocabulary'], (result) => {
      const vocabulary = result.vocabulary || {};
      const wordsText = Object.keys(vocabulary).join('\n');
      
      const blob = new Blob([wordsText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = '生词本_' + new Date().toLocaleDateString() + '.txt';
      a.click();
      
      URL.revokeObjectURL(url);
    });
  });
  
  // 清空生词
  clearWordsBtn.addEventListener('click', () => {
    if (confirm('确定要清空所有生词吗？')) {
      chrome.storage.local.set({ vocabulary: {} }, () => {
        loadVocabulary();
        // 向当前标签页发送消息（添加错误处理）
        sendMessageToCurrentTab({ action: 'refreshHighlights' });
      });
    }
  });
  
  // 清除释义缓存
  clearCacheBtn.addEventListener('click', () => {
    if (confirm('确定要清除所有单词释义的缓存吗？这不会删除您的生词，但会重置所有单词释义的缓存数据。')) {
      chrome.storage.local.set({ wordDefinitions: {} }, () => {
        // 显示清除成功的消息
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = '释义缓存已清除';
        document.body.appendChild(notification);
        
        // 2秒后移除通知
        setTimeout(() => {
          notification.classList.add('fade-out');
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }, 2000);
        
        // 通知当前页面刷新（添加错误处理）
        sendMessageToCurrentTab({ action: 'definitionCacheCleared' });
      });
    }
  });
  
  // 更新高亮按钮状态
  chrome.storage.local.get(['highlightEnabled'], (result) => {
    const isEnabled = result.highlightEnabled === true;
    toggleHighlightBtn.textContent = isEnabled ? '关闭高亮' : '开启高亮';
  });
  
  // 安全地向当前标签页发送消息的函数
  function sendMessageToCurrentTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // 检查是否有活动标签页
      if (tabs.length === 0) {
        console.log('没有找到活动标签页');
        return;
      }
      
      const tab = tabs[0];
      
      // 检查标签页是否可以接收消息
      // 排除扩展页面、chrome://页面等
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log('当前页面无法接收消息:', tab.url);
        return;
      }
      
      // 尝试发送消息，并处理可能的错误
      try {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.log('消息发送失败:', chrome.runtime.lastError.message);
            // 不抛出错误，静默处理
          } else if (response) {
            console.log('消息发送成功，收到响应:', response);
          }
        });
      } catch (err) {
        console.log('发送消息时出错:', err);
      }
    });
  }
  
  // 加载生词列表
  function loadVocabulary(searchTerm = '') {
    chrome.storage.local.get(['vocabulary'], (result) => {
      const vocabulary = result.vocabulary || {};
      wordsList.innerHTML = '';
      
      const words = Object.keys(vocabulary).filter(word => 
        !searchTerm || word.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (words.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = searchTerm ? '没有找到匹配的生词' : '还没有添加生词';
        wordsList.appendChild(emptyMessage);
        return;
      }
      
      words.sort().forEach(word => {
        const li = document.createElement('li');
        
        const wordItem = document.createElement('div');
        wordItem.className = 'word-item';
        
        const wordText = document.createElement('span');
        wordText.textContent = word;
        
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-word';
        deleteBtn.textContent = '×';
        deleteBtn.title = '删除此生词';
        deleteBtn.addEventListener('click', () => deleteWord(word));
        
        wordItem.appendChild(wordText);
        wordItem.appendChild(deleteBtn);
        li.appendChild(wordItem);
        wordsList.appendChild(li);
      });
    });
  }
  
  // 删除单个生词
  function deleteWord(word) {
    chrome.storage.local.get(['vocabulary'], (result) => {
      const vocabulary = result.vocabulary || {};
      delete vocabulary[word];
      
      chrome.storage.local.set({ vocabulary: vocabulary }, () => {
        loadVocabulary(searchInput.value);
        // 向当前标签页发送消息（添加错误处理）
        sendMessageToCurrentTab({ action: 'refreshHighlights' });
      });
    });
  }
});