/**
 * 后台脚本主入口模块
 * 负责初始化各模块和中央消息处理
 */

import { initMenu, createContextMenu } from './menu.js';
import { addWordToVocabulary, initVocabularyStorage } from './vocabulary.js';
import { handleWordDefinitionRequest, initDictionaryCache } from './dictionary.js';
import { handleAudioPlaybackRequest } from './audio.js';
import { ensureOffscreenDocument } from './offscreen-manager.js';

// 初始化
function initialize() {
  console.log('生词本扩展: 初始化后台服务...');
  
  // 初始化各模块
  initMenu();
  initVocabularyStorage();
  initDictionaryCache();
  
  // 设置高亮默认值
  chrome.storage.local.get(['highlightEnabled'], (result) => {
    if (result.highlightEnabled === undefined) {
      chrome.storage.local.set({ highlightEnabled: true });
    }
  });
}

// 添加消息监听器
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 处理单词定义请求
    if (request.action === 'fetchWordDefinition') {
      const word = request.word.trim();
      handleWordDefinitionRequest(word, sender.tab?.id);
      return true; // 表示将异步发送响应
    } 
    // 处理音频播放请求
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
    // 处理音频播放错误报告
    else if (request.action === 'audioPlaybackError') {
      console.error('Background: Offscreen 报告音频播放错误:', request.error);
    }
    
    return false; // 对于非异步消息或未处理的消息
  });
}

// 设置右键菜单点击处理程序
function setupContextMenuListener() {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "addToVocabulary" && info.selectionText) {
      const word = info.selectionText.trim();
      if (word) {
        addWordToVocabulary(word, tab.id);
      }
    }
  });
}

// 初始化扩展
initialize();
setupMessageListeners();
setupContextMenuListener();

// 导出这些函数以便可能的测试
export { initialize, setupMessageListeners, setupContextMenuListener };