/**
 * 悬浮提示模块
 * 负责创建和管理悬浮提示框，处理提示内容和交互
 */

import { positionTooltip } from './utils.js';
import { requestAudioPlayback } from './audio-ui.js';
import { isDarkMode } from './highlight.js'; // 导入暗黑模式检测函数

let tooltipElement = null; // 用于存储tooltip元素引用
let tooltipTimeout = null; // 用于控制tooltip显示延时

// 处理鼠标悬浮在单词上的事件
export function handleWordHover(event) {
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
export function handleWordLeave() {
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
export function showTooltip(element, word) {
  // 如果已有tooltip，先移除
  hideTooltip();

  // 创建tooltip元素
  tooltipElement = document.createElement('div');
  tooltipElement.className = 'vocabulary-tooltip';
  
  // 检测是否为暗黑模式，应用相应的类
  if (isDarkMode()) {
    tooltipElement.classList.add('dark-mode');
  } else {
    tooltipElement.classList.add('light-mode');
  }
  
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

// 隐藏tooltip
export function hideTooltip() {
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

// 更新tooltip内容
export function updateTooltipContent(definition) {
  if (!tooltipElement) return;

  if (!definition || definition.error) {
    tooltipElement.innerHTML = `<div class="tooltip-error">${definition?.message || '无法获取释义'}</div>`;
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

  tooltipElement.innerHTML = html;
  
  // 为音频按钮添加点击事件
  setupAudioButtons();

  // 内容更新后重新定位
  positionTooltip(null, tooltipElement);
}

// 为音频按钮添加点击事件
function setupAudioButtons() {
  if (!tooltipElement) return;
  
  const audioButtons = tooltipElement.querySelectorAll('.audio-btn');
  audioButtons.forEach(button => {
    button.addEventListener('click', function(event) {
      event.stopPropagation(); // 阻止事件冒泡
      const audioUrl = this.getAttribute('data-audio');
      if (audioUrl) {
        requestAudioPlayback(audioUrl);
      }
    });
  });
}

// 为高亮元素添加事件监听
export function setupHighlightEvents() {
  document.body.addEventListener('mouseenter', function(event) {
    // 检查是否是我们的高亮元素
    if (event.target.classList && event.target.classList.contains('vocabulary-highlight')) {
      handleWordHover(event);
    }
  }, true); // 使用捕获阶段

  document.body.addEventListener('mouseleave', function(event) {
    // 检查是否是我们的高亮元素
    if (event.target.classList && event.target.classList.contains('vocabulary-highlight')) {
      handleWordLeave();
    }
  }, true); // 使用捕获阶段
}

// 获取当前tooltip元素
export function getTooltipElement() {
  return tooltipElement;
}

// 添加MutationObserver监听暗黑模式的变化
let darkModeObserver = null;
export function setupDarkModeListener() {
  // 如果已经有了观察器，先断开连接
  if (darkModeObserver) {
    darkModeObserver.disconnect();
  }
  
  // 创建一个新的观察器来监视文档元素上的类名变化
  darkModeObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      // 如果类属性发生变化，检查是否需要更新tooltip的暗黑模式
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        // 如果当前有tooltip，更新其暗黑模式状态
        if (tooltipElement) {
          if (isDarkMode()) {
            tooltipElement.classList.add('dark-mode');
            tooltipElement.classList.remove('light-mode');
          } else {
            tooltipElement.classList.add('light-mode');
            tooltipElement.classList.remove('dark-mode');
          }
        }
      }
    });
  });

  // 开始观察文档元素和body元素的类变化
  darkModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  darkModeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}