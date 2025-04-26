/**
 * 内容脚本主入口模块
 * 负责初始化各模块和处理消息通信
 */

import { applyHighlights, removeHighlights } from './highlight.js';
import { setupHighlightEvents, hideTooltip, updateTooltipContent, getTooltipElement } from './tooltip.js';
import { showAudioErrorNotification } from './audio-ui.js';

// 全局高亮状态
let highlightEnabled = true;

// 初始化高亮功能
function initializeHighlight() {
  console.log('生词本扩展: 初始化高亮功能...');
  // 获取高亮状态并应用
  chrome.storage.local.get(['highlightEnabled', 'vocabulary'], (result) => {
    console.log('生词本扩展: 获取存储数据', result);
    highlightEnabled = result.highlightEnabled !== false; // 默认为 true
    const vocabulary = result.vocabulary || {};
    const wordsArray = Object.keys(vocabulary);
    
    console.log(`生词本扩展: 高亮状态=${highlightEnabled}, 生词数量=${wordsArray.length}`);
    
    if (highlightEnabled && wordsArray.length > 0) {
      // 确保在DOM准备好后应用高亮
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          applyHighlights();
        });
      } else {
        applyHighlights();
      }
    }
  });
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
  } else {
    removeHighlights();
  }
}

// 处理刷新高亮的请求
function handleRefreshHighlights() {
  // 收到刷新请求时，如果高亮是开启的，则重新应用高亮
  console.log('生词本扩展: 刷新高亮');
  if (highlightEnabled) {
    applyHighlights();
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
    });
  } else {
    initializeHighlight();
    initializeListeners();
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
  handleWordAlreadyExists
};