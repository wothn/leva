// 全局变量
let highlightEnabled = true;
let tooltipElement = null; // 用于存储tooltip元素引用
let tooltipTimeout = null; // 用于控制tooltip显示延时

// 初始化：获取高亮状态并应用
chrome.storage.local.get(['highlightEnabled'], (result) => {
  highlightEnabled = result.highlightEnabled !== false; // 默认为 true
  if (highlightEnabled) {
    applyHighlights();
  }
});

// 处理来自 popup 或 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleHighlight') {
    highlightEnabled = request.state;
    if (highlightEnabled) {
      applyHighlights();
    } else {
      removeHighlights();
    }
  } else if (request.action === 'refreshHighlights') {
    // 收到刷新请求时，如果高亮是开启的，则重新应用高亮
    if (highlightEnabled) {
      applyHighlights();
    }
  } else if (request.action === 'wordDefinitionResult') {
    // 接收来自后台的词典查询结果
    if (tooltipElement && request.word === tooltipElement.dataset.word) {
      updateTooltipContent(tooltipElement, request.definition);
    }
  } else if (request.action === 'definitionCacheCleared') {
    // 当释义缓存被清除时，如果当前正在显示tooltip，则关闭它
    hideTooltip();
    
    // 如果用户需要，可以显示一个临时通知
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
});

// 应用高亮
function applyHighlights() {
  // 先移除旧的高亮，避免重复
  removeHighlights();
  chrome.storage.local.get(['vocabulary'], (result) => {
    const vocabulary = result.vocabulary || {};
    const wordsArray = Object.keys(vocabulary);
    if (wordsArray.length > 0) {
      highlightWords(wordsArray);
    }
  });
}

// 高亮网页中的生词
function highlightWords(wordsArray) {
  if (!highlightEnabled || wordsArray.length === 0) return;

  const pattern = new RegExp(`\\b(${wordsArray.map(escapeRegExp).join('|')})\\b`, 'gi');

  const textNodes = getTextNodes(document.body);
  textNodes.forEach(node => {
    const text = node.nodeValue;
    // 检查节点是否已经被处理过或是否在已高亮的元素内
    if (!text || node.parentNode.classList.contains('vocabulary-highlight')) return;

    if (!text.match(pattern)) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    pattern.lastIndex = 0; // 重置正则表达式的lastIndex

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }

      const span = document.createElement('span');
      span.className = 'vocabulary-highlight';
      span.textContent = match[0];
      // 添加鼠标事件监听器
      span.addEventListener('mouseenter', handleWordHover);
      span.addEventListener('mouseleave', handleWordLeave);

      fragment.appendChild(span);
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    // 替换前检查父节点是否存在
    if (node.parentNode) {
       node.parentNode.replaceChild(fragment, node);
    } else {
       console.warn("无法替换节点，因为父节点不存在:", node);
    }
  });
}

// 处理鼠标悬浮在单词上的事件
function handleWordHover(event) {
  const word = event.target.textContent.trim();

  // 清除之前的延时
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
  }

  // 添加延时，避免鼠标快速经过时频繁请求
  tooltipTimeout = setTimeout(() => {
    showTooltip(event.target, word);
    // 发送消息到背景脚本请求查询单词
    chrome.runtime.sendMessage({
      action: 'fetchWordDefinition',
      word: word
    });
  }, 300); // 300毫秒的延迟
}

// 处理鼠标离开单词的事件
function handleWordLeave() {
  // 清除显示延时
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }

  // 添加一个短暂延迟后隐藏提示框，允许鼠标移动到提示框上
  setTimeout(() => {
    // 检查tooltip是否存在并且鼠标没有悬浮在tooltip上
    if (tooltipElement && !tooltipElement.matches(':hover')) {
      hideTooltip();
    }
  }, 100); // 缩短延迟以便更快隐藏
}

// 显示单词提示框
function showTooltip(element, word) {
  // 如果已有tooltip，先移除
  hideTooltip();

  // 创建tooltip元素
  tooltipElement = document.createElement('div');
  tooltipElement.className = 'vocabulary-tooltip';
  tooltipElement.dataset.word = word; // 存储当前单词，用于后续更新
  tooltipElement.innerHTML = `<div class="tooltip-loading">正在加载 "${word}" 的释义...</div>`; // 初始显示加载状态

  // 添加鼠标进入和离开事件，以便鼠标可以移入tooltip
  tooltipElement.addEventListener('mouseenter', () => {
    // 如果鼠标进入tooltip，清除隐藏它的计时器
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
  });
  tooltipElement.addEventListener('mouseleave', hideTooltip);

  // 添加到文档
  document.body.appendChild(tooltipElement);

  // 计算并设置位置
  positionTooltip(element, tooltipElement);
}

// 更新tooltip内容
function updateTooltipContent(tooltip, definition) {
  if (!tooltip) return;

  if (!definition || definition.error) {
    tooltip.innerHTML = `<div class="tooltip-error">${definition?.message || '无法获取释义'}</div>`;
    return;
  }

  // 构建新的tooltip HTML结构
  let html = `
    <div class="tooltip-header">
      <span class="tooltip-word">${definition.word}</span>
      <div class="tooltip-meta">`;
  
  // 添加词性信息
  if (definition.partOfSpeech) {
    html += `<span class="tooltip-pos">${definition.partOfSpeech}</span>`;
  }
  
  // 添加语法形式信息 (如可数/不可数)
  if (definition.grammaticalForm) {
    html += `<span class="tooltip-gram">${definition.grammaticalForm}</span>`;
  }
  
  // 添加词汇级别 (如 B2, C1)
  if (definition.level) {
    html += `<span class="tooltip-level">${definition.level}</span>`;
  }
  
  html += `</div>
    </div>
  `;
  
  // 添加音标和发音按钮
  if (definition.phonetics) {
    html += '<div class="tooltip-phonetics">';
    
    // 添加美式音标和发音按钮
    if (definition.phonetics.us) {
      html += '<div class="phonetic-item">';
      html += `<span class="phonetic-us">美 /${definition.phonetics.us}/</span>`;
      
      // 如果有美式发音音频，添加播放按钮
      if (definition.audio && definition.audio.us) {
        html += `<span class="audio-btn audio-us" data-audio="${definition.audio.us}">🔊</span>`;
      }
      
      html += '</div>';
    }
    
    // 添加英式音标和发音按钮
    if (definition.phonetics.uk) {
      html += '<div class="phonetic-item">';
      html += `<span class="phonetic-uk">英 /${definition.phonetics.uk}/</span>`;
      
      // 如果有英式发音音频，添加播放按钮
      if (definition.audio && definition.audio.uk) {
        html += `<span class="audio-btn audio-uk" data-audio="${definition.audio.uk}">🔊</span>`;
      }
      
      html += '</div>';
    }
    
    html += '</div>';
  }

  // 添加定义和例句
  if (definition.definitions && definition.definitions.length > 0) {
    html += '<div class="tooltip-body">';
    html += '<ul class="tooltip-definitions">';
    
    // 展示所有定义（最多5个）
    definition.definitions.slice(0, 5).forEach((defItem, index) => {
      html += '<li>';
      
      // 添加该定义的级别（如果与总体级别不同）
      if (defItem.level && defItem.level !== definition.level) {
        html += `<span class="def-level">${defItem.level}</span>`;
      }
      
      // 添加英文定义
      if (defItem.text) {
        html += `<div class="def-text">${index + 1}. ${defItem.text}</div>`;
      }
      
      // 添加中文翻译（如果有）
      if (defItem.translation) {
        html += `<div class="def-trans">${defItem.translation}</div>`;
      }
      
      // 添加例句（最多显示2个例句）
      if (defItem.examples && defItem.examples.length > 0) {
        html += '<div class="tooltip-examples">';
        defItem.examples.slice(0, 2).forEach(example => {
          html += '<div class="tooltip-example">';
          html += `<div class="eg-text">• ${example.text}</div>`;
          if (example.translation) {
            html += `<div class="eg-trans">${example.translation}</div>`;
          }
          html += '</div>';
        });
        html += '</div>';
      }
      
      html += '</li>';
    });
    
    html += '</ul>';
    html += '</div>';
  } else {
    html += '<div class="tooltip-no-def">未找到释义</div>';
  }

  // 添加来源信息
  html += `
    <div class="tooltip-footer">
      <span class="tooltip-source">数据来源: Cambridge Dictionary</span>
    </div>
  `;

  tooltip.innerHTML = html;
  
  // 为音频按钮添加点击事件
  if (tooltip) {
    const audioButtons = tooltip.querySelectorAll('.audio-btn');
    audioButtons.forEach(button => {
      button.addEventListener('click', function(event) {
        event.stopPropagation(); // 阻止事件冒泡
        const audioUrl = this.getAttribute('data-audio');
        if (audioUrl) {
          playAudio(audioUrl);
        }
      });
    });
  }

  // 内容更新后重新定位
  positionTooltip(null, tooltip);
}

// 播放音频的函数
function playAudio(url) {
  // 检查URL是否为Cambridge Dictionary的路径
  if (url.startsWith('/') || !url.startsWith('http')) {
    // 这是一个相对路径，需要通过background脚本代理获取和播放
    console.log('请求背景脚本播放音频:', url);
    chrome.runtime.sendMessage({
      action: 'requestAudioPlayback', // 新的 action 名称
      audioPath: url
    }, response => {
      // 可以选择性地处理来自 background 的响应，例如播放失败的通知
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
function showAudioErrorNotification() {
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
    z-index: 10000;
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

// 定位tooltip
function positionTooltip(targetElement, tooltip) {
    if (!tooltip) return;

    let rect;
    if (targetElement) {
        rect = targetElement.getBoundingClientRect();
    } else {
        // 如果没有目标元素（例如更新内容后重新定位），尝试基于当前位置调整
        // 这部分逻辑可能需要根据实际效果调整
        rect = tooltip.getBoundingClientRect();
        // 保持当前水平位置，只调整垂直位置以防遮挡
         tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
         tooltip.style.top = `${rect.top + window.scrollY - 10}px`; // 尝试放在上方
         // 重新获取更新后的位置信息
         rect = tooltip.getBoundingClientRect();

    }

    const tooltipHeight = tooltip.offsetHeight;
    const tooltipWidth = tooltip.offsetWidth;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    let top, left;

    // 优先放在上方
    if (spaceAbove > tooltipHeight + 10) {
        top = rect.top + window.scrollY - tooltipHeight - 10;
        tooltip.style.transform = 'translateX(-50%)'; // 移除 translateY(-100%)
        // 调整箭头方向（如果需要的话，通过添加/移除class）
    }
    // 其次放在下方
    else if (spaceBelow > tooltipHeight + 10) {
        top = rect.bottom + window.scrollY + 10;
         tooltip.style.transform = 'translateX(-50%)';
         // 调整箭头方向
    }
    // 如果上下空间都不够，放在默认上方（可能会被遮挡）
    else {
        top = rect.top + window.scrollY - tooltipHeight - 10;
        tooltip.style.transform = 'translateX(-50%)';
    }

    left = rect.left + window.scrollX + rect.width / 2;

    // 防止tooltip超出屏幕左右边界
    if (left - tooltipWidth / 2 < window.scrollX) {
        left = window.scrollX + tooltipWidth / 2 + 5; // 增加一点边距
    } else if (left + tooltipWidth / 2 > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - tooltipWidth / 2 - 5;
    }

     // 防止tooltip超出屏幕上方边界
    if (top < window.scrollY) {
        top = window.scrollY + 5;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

// 隐藏tooltip
function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
   // 清除可能存在的隐藏计时器
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
}

// 获取所有文本节点
function getTextNodes(element) {
  const all = [];
  const ignoreTags = ['script', 'style', 'textarea', 'noscript', 'iframe'];

  function getNodes(node) {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
      all.push(node);
    } else if (node.nodeType === Node.ELEMENT_NODE && 
              !ignoreTags.includes(node.tagName.toLowerCase())) {
      for (let child of node.childNodes) {
        getNodes(child);
      }
    }
  }

  getNodes(element);
  return all;
}

// 移除所有高亮
function removeHighlights() {
  const highlights = document.querySelectorAll('.vocabulary-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    if (!parent) return; // 如果没有父节点，则跳过

    // 移除事件监听器
    highlight.removeEventListener('mouseenter', handleWordHover);
    highlight.removeEventListener('mouseleave', handleWordLeave);

    const textNode = document.createTextNode(highlight.textContent);

    // 尝试替换节点
    try {
        parent.replaceChild(textNode, highlight);
        // 规范化父节点，合并相邻的文本节点
        parent.normalize();
    } catch (error) {
        console.error("移除高亮时出错:", error, highlight);
    }
  });

  // 隐藏任何可能存在的tooltip
  hideTooltip();
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& 表示匹配到的整个字符串
}