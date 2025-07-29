// 默认设置
const defaultSettings = {
  highlightEnabled: true,
  highlightStyle: 'solid',
  highlightColor: '#FFD700',
  toolbarEnabled: true,
  tooltipEnabled: true,
  darkMode: false,
  autoPronounce: false
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
});

// 加载设置
function loadSettings() {
  chrome.storage.local.get(defaultSettings, (result) => {
    document.getElementById('highlight-enabled').checked = result.highlightEnabled;
    document.getElementById('highlight-style').value = result.highlightStyle;
    document.getElementById('highlight-color').value = result.highlightColor;
    document.getElementById('toolbar-enabled').checked = result.toolbarEnabled;
    document.getElementById('tooltip-enabled').checked = result.tooltipEnabled;
    document.getElementById('dark-mode').checked = result.darkMode;
    document.getElementById('auto-pronounce').checked = result.autoPronounce;
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 高亮设置
  document.getElementById('highlight-enabled').addEventListener('change', saveSettings);
  document.getElementById('highlight-style').addEventListener('change', saveSettings);
  document.getElementById('highlight-color').addEventListener('change', saveSettings);
  
  // 工具栏设置
  document.getElementById('toolbar-enabled').addEventListener('change', saveSettings);
  
  // 悬浮提示设置
  document.getElementById('tooltip-enabled').addEventListener('change', saveSettings);
  document.getElementById('dark-mode').addEventListener('change', saveSettings);
  document.getElementById('auto-pronounce').addEventListener('change', saveSettings);
  
  // 重置设置
  document.getElementById('reset-settings').addEventListener('click', () => {
    if (confirm('确定要重置所有设置吗？')) {
      chrome.storage.local.set(defaultSettings, () => {
        loadSettings();
        alert('设置已重置');
      });
    }
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    highlightEnabled: document.getElementById('highlight-enabled').checked,
    highlightStyle: document.getElementById('highlight-style').value,
    highlightColor: document.getElementById('highlight-color').value,
    toolbarEnabled: document.getElementById('toolbar-enabled').checked,
    tooltipEnabled: document.getElementById('tooltip-enabled').checked,
    darkMode: document.getElementById('dark-mode').checked,
    autoPronounce: document.getElementById('auto-pronounce').checked
  };
  
  chrome.storage.local.set(settings, () => {
    // 通知所有标签页的内容脚本设置已更新
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: "updateHighlight" }).catch(() => {
          // Ignore errors for tabs where content script is not running
        });
      });
    });
  });
}