// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理解析 HTML 的请求
  if (message.action === 'parseHTML') {
    console.log('Offscreen: 收到解析 HTML 请求');
    try {
      const result = parseCambridgeDictionaryHTML(message.html, message.word, message.dictionaryType);
      
      // 向 background 脚本发送解析结果
      chrome.runtime.sendMessage({
        action: 'parseHTMLResult',
        success: true,
        result: result
      }).catch(error => {
        console.error('Offscreen: 发送解析结果时出错:', error);
      });
    } catch (error) {
      console.error('Offscreen: 解析 HTML 时出错:', error);
      
      // 向 background 脚本发送错误信息
      chrome.runtime.sendMessage({
        action: 'parseHTMLResult',
        success: false,
        error: error.message
      }).catch(sendError => {
        console.error('Offscreen: 发送解析错误时出错:', sendError);
      });
    }
    return false; // 不需要异步响应
  }
  
  // 处理播放音频的请求 - 支持直接播放 URL
  else if (message.action === 'playAudioOffscreen' && message.target === 'offscreen') {
    console.log('Offscreen: 收到播放音频请求');
    try {
      // 如果收到的是音频 URL，则使用新的方法
      if (message.audioUrl) {
        playAudioFromUrl(message.audioUrl);
      }
      // 保留旧方法，以便向后兼容
      else if (message.audioData) {
        playAudioInOffscreen(message.audioData, message.mimeType);
      }
      else {
        throw new Error('请求中未包含音频数据或URL');
      }
    } catch (error) {
      console.error('Offscreen: 播放音频时出错:', error);
      // 向 background 脚本报告错误
      chrome.runtime.sendMessage({
        action: 'audioPlaybackError',
        error: error.message
      }).catch(sendError => {
        console.error('Offscreen: 发送音频播放错误时出错:', sendError);
      });
    }
    return false; // 不需要异步响应
  }

  return false; // 对于其他未处理的消息
});

// 新增：从 URL 直接播放音频
function playAudioFromUrl(audioUrl) {
  if (!audioUrl) {
    throw new Error('音频 URL 无效');
  }
  
  try {
    console.log(`Offscreen: 从 URL 播放音频: ${audioUrl}`);
    
    // 获取或创建音频元素
    let audioElement = document.getElementById('offscreen-audio-player');
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = 'offscreen-audio-player';
      document.body.appendChild(audioElement);
      console.log('Offscreen: 已创建 audio 元素');
    }
    
    // 设置事件监听器
    audioElement.onended = () => {
      console.log('Offscreen: 音频播放完成');
    };
    
    audioElement.onerror = (event) => {
      const error = audioElement.error;
      console.error('Offscreen: 音频播放出错:', event);
      console.error('Offscreen: MediaError code:', error?.code);
      console.error('Offscreen: MediaError message:', error?.message);
      
      // 报告错误给 background 脚本
      chrome.runtime.sendMessage({
        action: 'audioPlaybackError',
        error: `播放出错: Code ${error?.code}, Message: ${error?.message || 'Unknown error'}`
      }).catch(sendError => {
        console.error('Offscreen: 发送音频播放错误时出错:', sendError);
      });
    };
    
    // 修复 CORS 问题，如果存在
    audioElement.crossOrigin = 'anonymous';
    
    // 设置音频源
    audioElement.src = audioUrl;
    
    // 尝试播放
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error('Offscreen: 播放音频 Promise 失败:', error);
        
        // 报告错误给 background 脚本
        chrome.runtime.sendMessage({
          action: 'audioPlaybackError',
          error: error.message
        }).catch(sendError => {
          console.error('Offscreen: 发送音频播放错误时出错:', sendError);
        });
      });
    }
  } catch (error) {
    console.error('Offscreen: 处理音频播放时出错:', error);
    throw error;
  }
}

// 在 Offscreen 文档中播放音频
function playAudioInOffscreen(audioData, mimeType) {
  if (!audioData) {
    throw new Error('音频数据为空');
  }
  
  try {
    console.log(`Offscreen: 准备播放音频 (大小: ${audioData.byteLength} bytes, 传入类型: ${mimeType || '未指定'})`);
    
    // 确定最终使用的 MIME 类型
    const finalMimeType = mimeType || 'audio/mpeg';
    console.log(`Offscreen: 将使用的最终 MIME 类型: ${finalMimeType}`); // 新增日志
    
    // 创建 Blob 和 Blob URL
    const blob = new Blob([audioData], { type: finalMimeType });
    const blobUrl = URL.createObjectURL(blob);
    
    console.log('Offscreen: 已创建 Blob URL:', blobUrl);
    
    // 获取或创建 audio 元素
    let audioElement = document.getElementById('offscreen-audio-player');
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = 'offscreen-audio-player';
      document.body.appendChild(audioElement);
      console.log('Offscreen: 已创建 audio 元素');
    }
    
    // 设置事件监听器
    audioElement.onended = () => {
      console.log('Offscreen: 音频播放完成，释放 Blob URL');
      URL.revokeObjectURL(blobUrl);
    };
    
    audioElement.onerror = (event) => {
      // 修改这里以记录更详细的错误信息
      const error = audioElement.error; // 获取具体的 MediaError 对象
      console.error('Offscreen: 音频播放出错:', event); // 记录整个事件
      console.error('Offscreen: MediaError code:', error?.code); // 记录错误代码
      console.error('Offscreen: MediaError message:', error?.message); // 记录错误消息
      URL.revokeObjectURL(blobUrl);
      
      // 报告错误给 background 脚本
      chrome.runtime.sendMessage({
        action: 'audioPlaybackError',
        // 发送更详细的错误信息
        error: `播放出错: Code ${error?.code}, Message: ${error?.message || 'Unknown error'}`
      }).catch(sendError => {
        console.error('Offscreen: 发送音频播放错误时出错:', sendError);
      });
    };
    
    // 设置音频源并播放
    audioElement.src = blobUrl;
    
    // 播放音频
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error('Offscreen: 播放音频 Promise 失败:', error);
        URL.revokeObjectURL(blobUrl);
        
        // 报告错误给 background 脚本
        chrome.runtime.sendMessage({
          action: 'audioPlaybackError',
          error: error.message
        }).catch(sendError => {
          console.error('Offscreen: 发送音频播放错误时出错:', sendError);
        });
      });
    }
  } catch (error) {
    console.error('Offscreen: 处理音频播放时出错:', error);
    throw error; // 重新抛出错误，以便调用者处理
  }
}

// 解析 HTML 的函数
function parseCambridgeDictionaryHTML(html, word, dictionaryType) {
  console.log('Offscreen: 开始解析 HTML');
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const result = {
    word: word,
    phonetics: {
      uk: '',
      us: ''
    },
    audio: {
      uk: '',
      us: ''
    },
    partOfSpeech: '',
    level: '',
    definitions: []
  };
  
  try {
    const posElement = doc.querySelector('.pos.dpos');
    if (posElement) {
      result.partOfSpeech = posElement.textContent.trim();
      console.log("Offscreen: 找到词性:", result.partOfSpeech);
    }
    
    const gramElement = doc.querySelector('.gram.dgram');
    if (gramElement) {
      result.grammaticalForm = gramElement.textContent.trim();
      console.log("Offscreen: 找到词类型:", result.grammaticalForm);
    }
  } catch (error) {
    console.warn('Offscreen: 提取词性失败:', error);
  }
  
  try {
    const ukPronElement = doc.querySelector('.uk.dpron-i .ipa.dipa');
    if (ukPronElement) {
      result.phonetics.uk = ukPronElement.textContent.trim();
      console.log("Offscreen: 找到英式音标:", result.phonetics.uk);
      
      const ukAudioElement = doc.querySelector('.uk.dpron-i audio source[type="audio/mpeg"]');
      if (ukAudioElement && ukAudioElement.getAttribute('src')) {
        result.audio.uk = ukAudioElement.getAttribute('src');
        console.log("Offscreen: 找到英式音频链接:", result.audio.uk);
      }
    }
    
    const usPronElement = doc.querySelector('.us.dpron-i .ipa.dipa');
    if (usPronElement) {
      result.phonetics.us = usPronElement.textContent.trim();
      console.log("Offscreen: 找到美式音标:", result.phonetics.us);
      
      const usAudioElement = doc.querySelector('.us.dpron-i audio source[type="audio/mpeg"]');
      if (usAudioElement && usAudioElement.getAttribute('src')) {
        result.audio.us = usAudioElement.getAttribute('src');
        console.log("Offscreen: 找到美式音频链接:", result.audio.us);
      }
    }
  } catch (error) {
    console.warn('Offscreen: 提取音标和音频失败:', error);
  }
  
  try {
    const defBlocks = doc.querySelectorAll('.def-block.ddef_block');
    console.log(`Offscreen: 找到 ${defBlocks.length} 个释义块`);
    
    defBlocks.forEach(block => {
      const levelElement = block.querySelector('.def-info.ddef-info .epp-xref.dxref');
      const level = levelElement ? levelElement.textContent.trim() : '';
      
      if (level && !result.level) {
        result.level = level;
        console.log("Offscreen: 找到词汇级别:", result.level);
      }
      
      const defElement = block.querySelector('.def.ddef_d.db');
      if (!defElement) return;
      
      const definitionText = defElement.textContent.trim();
      
      const transElement = block.querySelector('.trans.dtrans.dtrans-se');
      const translation = transElement ? transElement.textContent.trim() : '';
      
      const examples = [];
      const exampleElements = block.querySelectorAll('.examp.dexamp');
      
      exampleElements.forEach(exampleElem => {
        const exampleTextElem = exampleElem.querySelector('.eg.deg');
        const exampleTransElem = exampleElem.querySelector('.trans.dtrans.dtrans-se');
        
        if (exampleTextElem) {
          examples.push({
            text: exampleTextElem.textContent.trim(),
            translation: exampleTransElem ? exampleTransElem.textContent.trim() : ''
          });
        }
      });
      
      if (definitionText) {
        result.definitions.push({
          text: definitionText,
          translation: translation,
          examples: examples,
          level: level
        });
      }
    });
  } catch (error) {
    console.warn('Offscreen: 提取释义和例句失败:', error);
  }
  
  if (result.definitions.length === 0 && !result.phonetics.uk && !result.phonetics.us) {
    console.warn(`Offscreen: 未能解析出'${word}'的有效信息`);
    throw new Error('未找到该单词的释义或音标信息');
  }
  
  return result;
}