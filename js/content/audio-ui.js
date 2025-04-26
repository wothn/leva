/**
 * 音频UI处理模块
 * 负责处理音频播放按钮、请求和通知
 */

// 播放音频
export function requestAudioPlayback(url) {
  // 检查URL是否为Cambridge Dictionary的路径
  if (url.startsWith('/') || !url.startsWith('http')) {
    // 这是一个相对路径，需要通过background脚本代理获取和播放
    console.log('请求背景脚本播放音频:', url);
    chrome.runtime.sendMessage({
      action: 'requestAudioPlayback', // 发送到background脚本的action
      audioPath: url
    }, response => {
      // 处理来自 background 的响应
      if (chrome.runtime.lastError) {
        console.error('请求播放音频失败:', chrome.runtime.lastError.message);
        showAudioErrorNotification();
      } else if (response && !response.success) {
        console.error('背景脚本报告音频播放失败:', response.error);
        showAudioErrorNotification();
      } else {
        console.log('音频播放请求已发送');
      }
    });
  } else {
    // 直接URL（理论上不应发生，但保留）
    try {
      const audioElement = new Audio(url);
      audioElement.onerror = function() {
        console.error('直接播放音频失败:', url);
        showAudioErrorNotification();
      };
      audioElement.play().catch(error => {
        console.error('直接播放音频时出错:', error);
        showAudioErrorNotification();
      });
    } catch (error) {
      console.error('创建直接播放的音频元素失败:', error);
      showAudioErrorNotification();
    }
  }
}

// 显示音频错误通知
export function showAudioErrorNotification() {
  const notification = document.createElement('div');
  notification.className = 'audio-error-notification';
  notification.textContent = '音频加载失败';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(211, 47, 47, 0.9);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    z-index: 10001;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(notification);
  
  // 显示并淡出通知
  setTimeout(() => {
    notification.style.opacity = '1';
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 1500);
  }, 0);
}