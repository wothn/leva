/**
 * 音频处理模块
 * 负责处理音频播放请求和播放功能
 */

// 处理音频播放请求
export async function handleAudioPlaybackRequest(audioPath) {
  if (!audioPath) {
    throw new Error('音频路径无效');
  }
  
  // 如果路径不是以/开头，添加/
  const cleanPath = audioPath.startsWith('/') ? audioPath : '/' + audioPath;
  // 构建完整的URL
  const audioUrl = 'https://dictionary.cambridge.org' + cleanPath;

  try {
    console.log('Background: 正在准备音频播放:', audioUrl);
    
    // 导入offscreen-manager
    const { ensureOffscreenDocument } = await import('./offscreen-manager.js');
    
    // 确保 Offscreen 文档存在
    await ensureOffscreenDocument();

    // 发送音频URL到 Offscreen 文档进行播放
    chrome.runtime.sendMessage({
      target: 'offscreen', // 目标标识符
      action: 'playAudioOffscreen',
      audioUrl: audioUrl    // 发送URL而不是二进制数据
    });

  } catch (error) {
    console.error('Background: 准备音频播放失败:', error);
    throw error; // 重新抛出错误，以便调用者知道失败了
  }
}