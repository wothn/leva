/**
 * 内容脚本主入口模块
 * 负责初始化各模块和处理消息通信
 */

import { applyHighlights, removeHighlights, highlightWords, isInNotification } from './highlight.js';
import { setupHighlightEvents, hideTooltip, updateTooltipContent, getTooltipElement, setupDarkModeListener } from './tooltip.js';
import { showAudioErrorNotification } from './audio-ui.js';

// 全局高亮状态
let highlightEnabled = true;
// 保存单词列表，以便动态加载的内容可以使用
let vocabularyWords = [];
// MutationObserver 实例
let observer = null;

// 初始化高亮功能
function initializeHighlight() {
  console.log('生词本扩展: 初始化高亮功能...');
  // 获取高亮状态并应用
  chrome.storage.local.get(['highlightEnabled', 'vocabulary'], (result) => {
    console.log('生词本扩展: 获取存储数据', result);
    highlightEnabled = result.highlightEnabled !== false; // 默认为 true
    const vocabulary = result.vocabulary || {};
    vocabularyWords = Object.keys(vocabulary);
    
    console.log(`生词本扩展: 高亮状态=${highlightEnabled}, 生词数量=${vocabularyWords.length}`);
    
    if (highlightEnabled && vocabularyWords.length > 0) {
      // 确保在DOM准备好后应用高亮
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          applyHighlights();
          // 设置 MutationObserver 监视新内容
          setupMutationObserver();
        });
      } else {
        applyHighlights();
        // 设置 MutationObserver 监视新内容
        setupMutationObserver();
      }
    }
  });

  // 监听 storage 变化，更新单词列表和高亮状态
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      let needRehighlight = false;
      
      // 检查高亮状态是否改变
      if (changes.highlightEnabled) {
        const newState = changes.highlightEnabled.newValue !== false;
        if (newState !== highlightEnabled) {
          highlightEnabled = newState;
          needRehighlight = true;
          
          if (!highlightEnabled) {
            // 关闭高亮时断开 observer
            disconnectMutationObserver();
          }
        }
      }
      
      // 检查生词列表是否改变
      if (changes.vocabulary) {
        const newVocabulary = changes.vocabulary.newValue || {};
        vocabularyWords = Object.keys(newVocabulary);
        needRehighlight = true;
      }
      
      // 如果需要更新高亮
      if (needRehighlight) {
        console.log(`生词本扩展: 存储变化，重新应用高亮状态=${highlightEnabled}, 生词数量=${vocabularyWords.length}`);
        if (highlightEnabled && vocabularyWords.length > 0) {
          applyHighlights();
          setupMutationObserver(); // 确保观察者使用最新配置
        } else if (!highlightEnabled) {
          removeHighlights();
        }
      }
    }
  });
}

// 设置 MutationObserver 监视动态加载的内容
function setupMutationObserver() {
  // 如果高亮未启用或词表为空，不设置观察者
  if (!highlightEnabled || vocabularyWords.length === 0) {
    disconnectMutationObserver();
    return;
  }
  
  // 如果已有观察者，先断开连接
  disconnectMutationObserver();
  
  console.log('生词本扩展: 设置 MutationObserver 监视动态加载内容');
  
  // 创建新观察者
  observer = new MutationObserver((mutations) => {
    // 保存需要处理的新节点
    const newNodes = new Set();
    
    // 遍历所有变化
    mutations.forEach(mutation => {
      // 只处理节点添加类型的变化
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          // 只处理元素节点，跳过文本节点、脚本、样式等
          if (node.nodeType === Node.ELEMENT_NODE && 
              node.tagName !== 'SCRIPT' && 
              node.tagName !== 'STYLE' && 
              !node.classList.contains('vocabulary-highlight') &&
              !isInNotification(node)) {
            newNodes.add(node);
          }
        });
      }
    });
    
    // 如果有新节点添加，对它们应用高亮
    if (newNodes.size > 0) {
      console.log(`生词本扩展: 检测到 ${newNodes.size} 个新元素加载，应用高亮`);
      newNodes.forEach(node => {
        // 确保节点仍在文档中
        if (document.contains(node)) {
          highlightWords(vocabularyWords, highlightEnabled, node);
        }
      });
    }
  });
  
  // 开始观察 document.body
  observer.observe(document.body, {
    childList: true,  // 监视子节点的添加或移除
    subtree: true     // 监视整个子树的变化
  });
}

// 断开 MutationObserver 连接
function disconnectMutationObserver() {
  if (observer) {
    console.log('生词本扩展: 断开 MutationObserver 连接');
    observer.disconnect();
    observer = null;
  }
}

// 初始化事件监听
function initializeListeners() {
  // 为高亮元素添加事件监听
  setupHighlightEvents();
  
  // 处理来自 popup 或 background 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('生词本扩展: 收到消息', request);
    if (request.action === 'toggleHighlight') {
      handleToggleHighlight(request.state);
      sendResponse({ success: true });
    } 
    else if (request.action === 'refreshHighlights') {
      handleRefreshHighlights();
      sendResponse({ success: true });
    } 
    else if (request.action === 'wordDefinitionResult') {
      handleWordDefinitionResult(request);
      sendResponse({ success: true });
    } 
    else if (request.action === 'definitionCacheCleared') {
      handleDefinitionCacheCleared();
      sendResponse({ success: true });
    }
    else if (request.action === 'wordAdded') {
      handleWordAdded(request.word);
      sendResponse({ success: true });
    }
    else if (request.action === 'wordAlreadyExists') {
      handleWordAlreadyExists(request.word);
      sendResponse({ success: true });
    }
    
    // 注意：不要在这里返回true，因为我们已经同步发送了响应
  });
}

// 处理开关高亮的请求
function handleToggleHighlight(state) {
  highlightEnabled = state;
  console.log(`生词本扩展: 切换高亮状态=${highlightEnabled}`);
  if (highlightEnabled) {
    applyHighlights();
    setupMutationObserver(); // 恢复观察者
  } else {
    removeHighlights();
    disconnectMutationObserver(); // 断开观察者
  }
}

// 处理刷新高亮的请求
function handleRefreshHighlights() {
  // 收到刷新请求时，如果高亮是开启的，则重新应用高亮
  console.log('生词本扩展: 刷新高亮');
  if (highlightEnabled) {
    applyHighlights();
    setupMutationObserver(); // 确保观察者正常工作
  }
}

// 处理词典查询结果
function handleWordDefinitionResult(request) {
  // 接收来自后台的词典查询结果
  const tooltipElement = getTooltipElement();
  if (tooltipElement && request.word === tooltipElement.dataset.word) {
    updateTooltipContent(request.definition);
  }
}

// 处理定义缓存被清除的情况
function handleDefinitionCacheCleared() {
  // 当释义缓存被清除时，如果当前正在显示tooltip，则关闭它
  hideTooltip();
  
  // 显示一个临时通知
  const notification = document.createElement('div');
  notification.className = 'vocabulary-notification';
  notification.textContent = '释义缓存已清除';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(60, 60, 60, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 10000;
    transition: opacity 0.5s ease;
  `;
  document.body.appendChild(notification);
  
  // 2秒后移除通知
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 2000);
}

// 处理单词添加成功的通知
function handleWordAdded(word) {
  // 显示一个临时通知
  const notification = document.createElement('div');
  notification.className = 'vocabulary-notification';
  notification.textContent = `"${word}" 已添加到您的生词本`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(76, 175, 80, 0.9); /* 绿色背景 */
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 10000;
    transition: opacity 0.5s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  `;
  document.body.appendChild(notification);
  
  // 2秒后移除通知
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 2000);
}

// 处理单词已存在的通知
function handleWordAlreadyExists(word) {
  // 显示一个临时通知
  const notification = document.createElement('div');
  notification.className = 'vocabulary-notification';
  notification.textContent = `"${word}" 已经在您的生词本中`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(255, 152, 0, 0.9); /* 橙色背景 */
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 10000;
    transition: opacity 0.5s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  `;
  document.body.appendChild(notification);
  
  // 2秒后移除通知
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 2000);
}

// 初始化内容脚本
function initialize() {
  console.log('生词本扩展: 初始化内容脚本...');
  
  // 确保在DOM准备好后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeHighlight();
      initializeListeners();
      setupDarkModeListener(); // 初始化暗黑模式监听器
    });
  } else {
    initializeHighlight();
    initializeListeners();
    setupDarkModeListener(); // 初始化暗黑模式监听器
  }
}

// 执行初始化
initialize();

// 导出模块方法（方便测试）
export {
  highlightEnabled,
  initialize,
  handleToggleHighlight,
  handleRefreshHighlights,
  handleWordDefinitionResult,
  handleDefinitionCacheCleared,
  handleWordAdded,
  handleWordAlreadyExists,
  setupMutationObserver,
  disconnectMutationObserver
};