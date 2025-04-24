document.addEventListener('DOMContentLoaded', () => {
  const wordsList = document.getElementById('wordsList');
  const searchInput = document.getElementById('searchInput');
  const toggleHighlightBtn = document.getElementById('toggleHighlight');
  const exportWordsBtn = document.getElementById('exportWords');
  const clearWordsBtn = document.getElementById('clearWords');
  
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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleHighlight', state: isEnabled });
        });
        toggleHighlightBtn.textContent = isEnabled ? '关闭高亮' : '开启高亮';
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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'refreshHighlights' });
        });
      });
    }
  });
  
  // 更新高亮按钮状态
  chrome.storage.local.get(['highlightEnabled'], (result) => {
    const isEnabled = result.highlightEnabled === true;
    toggleHighlightBtn.textContent = isEnabled ? '关闭高亮' : '开启高亮';
  });
  
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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'refreshHighlights' });
        });
      });
    });
  }
});