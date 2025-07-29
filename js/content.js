// 从Chrome Storage获取设置
let settings = {
  highlightEnabled: true,
  highlightStyle: 'solid',
  highlightColor: '#FFD700',
  toolbarEnabled: true,
  tooltipEnabled: true,
  darkMode: false,
  autoPronounce: false
};

// 加载设置
chrome.storage.local.get(settings, (result) => {
  settings = { ...settings, ...result };
  updateHighlight();
});

// 监听设置变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    let shouldUpdateTooltipTheme = false;
    
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
      if (settings.hasOwnProperty(key)) {
        settings[key] = newValue;
        
        // 检查深色模式设置是否变化
        if (key === 'darkMode' && oldValue !== newValue) {
          shouldUpdateTooltipTheme = true;
        }
      }
    }
    
    updateHighlight();
    
    // 如果深色模式设置变化，更新tooltip主题
    if (shouldUpdateTooltipTheme && tooltipElement) {
      applyTooltipTheme();
    }
  }
});

// 监听来自background script的消息
// 检查扩展上下文是否仍然有效
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 检查扩展上下文是否仍然有效
    if (!chrome.runtime) {
      return;
    }
    
    if (message.action === "updateHighlight") {
      updateHighlight();
    } else if (message.action === "getSettings") {
      sendResponse(settings);
    }
    // Return true to indicate we will send a response asynchronously
    return true;
  });
}

// 更新高亮显示
function updateHighlight() {
  getVocabularyData((result) => {
    highlightWords(result.vocabulary);
  });
}

// 高亮显示生词
function highlightWords(vocabulary) {
  if (!settings.highlightEnabled || vocabulary.length === 0) {
    // 移除现有高亮
    removeAllHighlights();
    return;
  }

  // 创建正则表达式匹配所有生词
  const wordsRegex = new RegExp('\\b(' + vocabulary.map(word => 
    word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') // 转义特殊字符
  ).join('|') + ')\\b', 'gi');
  
  // 处理整个文档
  highlightTextInNode(document.body, wordsRegex);
}

// 移除所有高亮
function removeAllHighlights() {
  const highlights = document.querySelectorAll('.vocabulary-highlight');
  highlights.forEach(span => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    // Normalize to merge adjacent text nodes
    parent.normalize();
  });
}

// 在指定节点中高亮文本
function highlightTextInNode(node, wordsRegex) {
  // 创建文档片段以避免重复处理
  const walker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (textNode) => {
        // 排除已经在高亮span中的文本节点
        if (textNode.parentElement.classList.contains('vocabulary-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        // 只处理包含生词的文本节点
        return wordsRegex.test(textNode.textContent) ? 
          NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const textNodes = [];
  let currentNode;
  while (currentNode = walker.nextNode()) {
    textNodes.push(currentNode);
  }
  
  // 对匹配的文本节点进行高亮处理
  textNodes.forEach(node => {
    const fragment = document.createDocumentFragment();
    const parts = node.textContent.split(wordsRegex);
    
    parts.forEach((part, index) => {
      if (index % 2 === 0) {
        // 普通文本部分
        if (part) fragment.appendChild(document.createTextNode(part));
      } else {
        // 匹配的单词部分
        const span = document.createElement('span');
        span.className = 'vocabulary-highlight';
        span.textContent = part;
        span.dataset.word = part.toLowerCase();
        
        // 根据设置应用样式
        switch (settings.highlightStyle) {
          case 'solid':
            span.classList.add('solid');
            span.style.textDecorationColor = settings.highlightColor;
            break;
          case 'dotted':
            span.classList.add('dotted');
            span.style.borderColor = settings.highlightColor;
            break;
          case 'dashed':
            span.classList.add('dashed');
            span.style.borderColor = settings.highlightColor;
            break;
          case 'background':
            span.classList.add('background');
            span.style.backgroundColor = settings.highlightColor;
            break;
        }
        
        fragment.appendChild(span);
      }
    });
    
    node.parentNode.replaceChild(fragment, node);
  });
}

// 创建浮动工具栏
function createFloatingToolbar() {
  if (!settings.toolbarEnabled) return;
  
  const toolbar = document.createElement('div');
  toolbar.id = 'vocabulary-toolbar';
  toolbar.innerHTML = `
    <button id="add-word-btn" title="添加到生词本">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  `;
  
  document.body.appendChild(toolbar);
  toolbarElement = toolbar; // 缓存元素
  
  // 添加点击事件
  document.getElementById('add-word-btn').addEventListener('click', () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        action: "addWord",
        word: selectedText.toLowerCase()
      });
    }
  });
  
  // 监听选择变化事件
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.toString().trim() && settings.toolbarEnabled) {
      showToolbar(selection);
    } else {
      hideToolbar();
    }
  });
}

// 缓存DOM元素
let toolbarElement = null;
let tooltipElement = null;

// 显示工具栏
function showToolbar(selection) {
  if (!toolbarElement) return;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  toolbarElement.style.display = 'flex';
  toolbarElement.style.top = `${rect.top + window.scrollY - 40}px`;
  toolbarElement.style.left = `${rect.left + window.scrollX}px`;
}

// 隐藏工具栏
function hideToolbar() {
  if (toolbarElement) {
    toolbarElement.style.display = 'none';
  }
}

// 创建悬浮释义框
function createTooltip() {
  if (!settings.tooltipEnabled) return;
  
  // 如果已经存在tooltip元素，先移除它
  if (tooltipElement) {
    tooltipElement.remove();
  }
  
  const tooltip = document.createElement('div');
  tooltip.id = 'vocabulary-tooltip';
  tooltip.className = settings.darkMode ? 'dark' : '';
  document.body.appendChild(tooltip);
  tooltipElement = tooltip;
  
  // 统一的延迟时间
  const TOOLTIP_DELAY = 300;
  let showTimer = null;
  let hideTimer = null;
  
  // 防抖函数
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }
  
  // 跟踪当前悬停的元素
  let currentHoveredElement = null;
  let isTooltipHovered = false;
  
  // 处理高亮单词的鼠标事件
  document.body.addEventListener('mouseover', (event) => {
    if (event.target.classList.contains('vocabulary-highlight')) {
      // 清除隐藏定时器
      if (hideTimer) clearTimeout(hideTimer);
      
      // 如果当前悬停的元素不同，则显示tooltip
      if (currentHoveredElement !== event.target) {
        currentHoveredElement = event.target;
        const word = event.target.dataset.word;
        
        // 清除之前的显示定时器
        if (showTimer) clearTimeout(showTimer);
        
        // 设置显示定时器（防抖）
        showTimer = setTimeout(() => {
          showTooltip(event.target, word);
        }, TOOLTIP_DELAY);
      }
    }
  }, true);
  
  document.body.addEventListener('mouseout', (event) => {
    if (event.target.classList.contains('vocabulary-highlight')) {
      // 清除显示定时器
      if (showTimer) clearTimeout(showTimer);
      
      // 设置隐藏定时器
      hideTimer = setTimeout(() => {
        // 只有当tooltip和高亮元素都没有被悬停时才隐藏
        if (!isTooltipHovered) {
          hideTooltip();
          currentHoveredElement = null;
        }
      }, TOOLTIP_DELAY);
    }
  }, true);
  
  // 监听鼠标进入和离开tooltip
  tooltip.addEventListener('mouseenter', () => {
    isTooltipHovered = true;
    if (hideTimer) clearTimeout(hideTimer);
  });
  
  tooltip.addEventListener('mouseleave', () => {
    isTooltipHovered = false;
    // 当鼠标离开tooltip时，延迟隐藏
    hideTimer = setTimeout(() => {
      hideTooltip();
      currentHoveredElement = null;
    }, TOOLTIP_DELAY);
  });
}

// 应用深色模式主题
function applyTooltipTheme() {
  if (!tooltipElement) return;
  
  if (settings.darkMode) {
    tooltipElement.classList.add('dark');
  } else {
    tooltipElement.classList.remove('dark');
  }
}

// 显示释义框
function showTooltip(element, word) {
  // 检查扩展上下文是否仍然有效
  if (!chrome.runtime || !tooltipElement) {
    return;
  }
  
  // 确保深色模式类名正确应用
  applyTooltipTheme();
  
  // 显示加载状态
  tooltipElement.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
  `;
  tooltipElement.style.display = 'block';
  
  // 设置位置
  setPosition(element);
  
  // 请求释义
  chrome.runtime.sendMessage({
    action: "getDefinition",
    word: word
  }, (response) => {
    if (chrome.runtime.lastError) {
      tooltipElement.innerHTML = '<div class="error-container"><div class="error">获取释义时出错</div></div>';
      // 确保深色模式在错误状态下也正确应用
      applyTooltipTheme();
      setPosition(element);
      return;
    }
    
    if (response && response.definition) {
      tooltipElement.innerHTML = response.definition;
      
      // 确保深色模式在内容更新后保持正确
      applyTooltipTheme();
      
      // 重新设置位置，因为内容可能改变了tooltip的尺寸
      setPosition(element);
      
      // 添加发音功能
      const audioButtons = tooltipElement.querySelectorAll('.audio-btn');
      audioButtons.forEach(button => {
        // 防止重复添加事件监听器
        if (!button.hasAttribute('data-listener-added')) {
          button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const audioSrc = button.dataset.audio;
            if (!audioSrc) return;
            
            // 添加视觉反馈
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span>⏸️</span>';
            button.disabled = true;
            
            try {
              const audio = new Audio(audioSrc);
              
              const resetButton = () => {
                button.innerHTML = originalHTML;
                button.disabled = false;
              };
              
              audio.addEventListener('ended', resetButton);
              audio.addEventListener('error', resetButton);
              
              await audio.play();
            } catch (error) {
              button.innerHTML = originalHTML;
              button.disabled = false;
            }
          });
          button.setAttribute('data-listener-added', 'true');
        }
      });
    } else {
      tooltipElement.innerHTML = '<div class="error-container"><div class="error">未找到释义</div></div>';
      // 确保深色模式在错误状态下也正确应用
      applyTooltipTheme();
      setPosition(element);
    }
  });
}

// 隐藏释义框
function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.style.display = 'none';
  }
}

// 智能设置tooltip位置
function setPosition(element) {
  if (!tooltipElement) return;
  
  // 获取元素和屏幕尺寸信息
  const elementRect = element.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // 计算默认位置（元素下方）
  let top = elementRect.bottom + window.scrollY + 5;
  let left = elementRect.left + window.scrollX;
  
  // 检查是否需要调整位置
  // 如果tooltip会超出屏幕右边界，则向左调整
  if (left + tooltipRect.width > screenWidth + window.scrollX) {
    left = screenWidth + window.scrollX - tooltipRect.width - 5;
  }
  
  // 如果tooltip会超出屏幕左边界，则向右调整
  if (left < window.scrollX) {
    left = window.scrollX + 5;
  }
  
  // 检查垂直方向是否需要调整
  // 如果元素在屏幕底部附近，且tooltip会超出屏幕底部，则显示在元素上方
  const spaceBelow = screenHeight - elementRect.bottom;
  const spaceAbove = elementRect.top;
  
  if (spaceBelow < tooltipRect.height + 10 && spaceAbove > tooltipRect.height + 10) {
    // 显示在元素上方
    top = elementRect.top + window.scrollY - tooltipRect.height - 5;
  } else if (spaceBelow < tooltipRect.height + 10 && spaceAbove < tooltipRect.height + 10) {
    // 如果上下空间都不足，选择空间较大的一方
    if (spaceBelow > spaceAbove) {
      // 显示在下方，但需要调整以适应空间
      top = elementRect.bottom + window.scrollY + 5;
    } else {
      // 显示在上方，但需要调整以适应空间
      top = elementRect.top + window.scrollY - tooltipRect.height - 5;
    }
  }
  
  // 应用最终位置
  tooltipElement.style.top = `${top}px`;
  tooltipElement.style.left = `${left}px`;
}

// 统一的词汇数据获取函数
function getVocabularyData(callback) {
  chrome.storage.local.get({ vocabulary: [] }, callback);
}

// 初始化 - 确保在各种情况下都能正确初始化
function initializeExtension() {
  createFloatingToolbar();
  createTooltip();
  updateHighlight();
}

// 简化的初始化 - 只使用一种可靠的初始化方式
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// 监听DOM变化以处理动态内容
const observer = new MutationObserver((mutations) => {
  // 防抖处理，避免过于频繁的更新
  if (observer.timeoutId) {
    clearTimeout(observer.timeoutId);
  }
  
  observer.timeoutId = setTimeout(() => {
    // 检查是否有新添加的元素需要高亮
    const needsUpdate = mutations.some(mutation => 
      mutation.type === 'childList' && mutation.addedNodes.length > 0
    );
    
    if (needsUpdate) {
      getVocabularyData((result) => {
        highlightWords(result.vocabulary);
      });
    }
  }, 100); // 100ms 防抖延迟
});

// 开始观察DOM变化
observer.observe(document.body, {
  childList: true,
  subtree: true
});
