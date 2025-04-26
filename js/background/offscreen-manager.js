/**
 * Offscreen API 管理模块
 * 负责创建和管理Offscreen文档，用于HTML解析和音频播放
 */

// 防止并发创建
let creatingOffscreenPromise = null;

// 确保Offscreen文档存在
export async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl] // 查找特定 URL 的文档
    });

    // 如果已存在，直接返回
    if (existingContexts.length > 0) {
      console.log('Background: Offscreen 文档已存在');
      return;
    }

    // 如果正在创建，则等待现有 Promise 完成
    if (creatingOffscreenPromise) {
      console.log('Background: 等待正在进行的 Offscreen 文档创建...');
      await creatingOffscreenPromise;
      return;
    }

    console.log('Background: 创建 Offscreen 文档...');
    creatingOffscreenPromise = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.DOM_PARSER, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: '解析词典 HTML 和播放音频'
    });

    await creatingOffscreenPromise;
    console.log('Background: Offscreen 文档创建成功');
  } catch (error) {
    console.error('Background: 创建 Offscreen 文档失败:', error);
    throw error; // 抛出错误
  } finally {
    creatingOffscreenPromise = null; // 重置 Promise 状态
  }
}

// 移除Offscreen文档
export async function removeOffscreenDocument() {
  try {
    console.log('Background: 尝试移除 Offscreen 文档');
    await chrome.offscreen.closeDocument();
    console.log('Background: Offscreen 文档已关闭');
  } catch (error) {
    console.error('Background: 关闭 Offscreen 文档失败:', error);
    // 此处可以选择是否抛出错误
  }
}