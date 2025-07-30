// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  loadVocabulary();
  setupEventListeners();
});

// 加载生词本
function loadVocabulary() {
  chrome.storage.local.get({ vocabulary: [], definitions: {} }, (result) => {
    const vocabulary = result.vocabulary;
    const definitions = result.definitions;
    
    const wordList = document.getElementById('word-list');
    wordList.innerHTML = '';
    
    if (vocabulary.length === 0) {
      wordList.innerHTML = `
        <div class="empty">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24">
              <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
            </svg>
          </div>
          <div class="empty-title">生词本为空</div>
          <div class="empty-subtitle">在网页上遇到生词时，选中文本点击添加按钮<br>即可添加到生词本中进行学习</div>
        </div>
      `;
      return;
    }
    
    // 按字母顺序排序
    vocabulary.sort();
    
    vocabulary.forEach(word => {
      const listItem = document.createElement('div');
      listItem.className = 'word-item';
      listItem.innerHTML = `
        <div class="word-info">
          <span class="word">${word}</span>
          ${definitions[word] ? `<span class="definition-preview">${definitions[word].substring(0, 50)}${definitions[word].length > 50 ? '...' : ''}</span>` : ''}
        </div>
        <button class="delete-btn" data-word="${word}" title="删除">
          <svg viewBox="0 0 24 24">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
          </svg>
        </button>
      `;
      wordList.appendChild(listItem);
    });
    
    // 添加删除事件监听器
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', () => {
        const word = button.dataset.word;
        removeWord(word);
      });
    });
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 搜索功能
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    filterWords(searchTerm);
  });
  
  // 删除所有单词
  document.getElementById('clear-all').addEventListener('click', () => {
    if (confirm('确定要清空所有生词吗？')) {
      chrome.storage.local.set({ vocabulary: [], definitions: {} }, () => {
        loadVocabulary();
        // 通知内容脚本更新高亮
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "updateHighlight" }).catch(() => {
              // Ignore errors if content script is not available
            });
          }
        });
      });
    }
  });
  
  // 清空释义缓存
  document.getElementById('clear-cache').addEventListener('click', () => {
    // 向background发送消息清除缓存
    chrome.runtime.sendMessage({
      action: "clearCache"
    });
  });
  
  // 导出功能
  document.getElementById('export-btn').addEventListener('click', () => {
    chrome.storage.local.get({ vocabulary: [] }, (result) => {
      const vocabulary = result.vocabulary;
      const blob = new Blob([vocabulary.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vocabulary.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });
  
  // 设置按钮
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// 过滤单词
function filterWords(searchTerm) {
  const wordItems = document.querySelectorAll('.word-item');
  wordItems.forEach(item => {
    const word = item.querySelector('.word').textContent.toLowerCase();
    if (word.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// 删除单词
function removeWord(word) {
  chrome.storage.local.get({ vocabulary: [], definitions: {} }, (result) => {
    const vocabulary = result.vocabulary;
    const definitions = result.definitions;
    
    const index = vocabulary.indexOf(word);
    if (index > -1) {
      vocabulary.splice(index, 1);
      delete definitions[word];
      
      chrome.storage.local.set({ vocabulary, definitions }, () => {
        loadVocabulary();
        // 通知内容脚本更新高亮
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "updateHighlight" }).catch(() => {
              // Ignore errors if content script is not available
            });
          }
        });
      });
    }
  });
}