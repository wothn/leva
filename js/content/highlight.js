/**
 * 高亮功能模块
 * 负责在网页中查找和高亮显示生词，以及移除高亮
 */

import { getTextNodes } from './utils.js';

// 检测页面是否为暗黑模式
function isDarkMode() {
  // 方法1：通过页面背景颜色检测（最优先，因为这直接反映了网页的实际颜色）
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  
  // 优先使用body背景，如果是透明则使用html背景
  let bgColor = bodyBg;
  if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
    bgColor = htmlBg;
  }
  
  const rgb = bgColor.match(/\d+/g);
  let isDarkBg = false;
  
  if (rgb && rgb.length >= 3) {
    // 计算亮度 - 使用加权平均值以符合人眼感知
    // 公式：(0.299*R + 0.587*G + 0.114*B)
    const brightness = (0.299 * parseInt(rgb[0]) + 0.587 * parseInt(rgb[1]) + 0.114 * parseInt(rgb[2]));
    isDarkBg = brightness < 128;
  }
  
  // 方法2：检查常见暗黑模式类名
  const hasDarkClass = document.documentElement.classList.contains('dark') || 
                       document.documentElement.classList.contains('darkmode') || 
                       document.documentElement.classList.contains('dark-mode') ||
                       document.documentElement.classList.contains('dark-theme') ||
                       document.body.classList.contains('dark') || 
                       document.body.classList.contains('darkmode') || 
                       document.body.classList.contains('dark-mode') ||
                       document.body.classList.contains('dark-theme');
  
  // 方法3：通过CSS媒体查询检测系统偏好（最低优先级）
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // 检查主要文本颜色
  const textColor = getComputedStyle(document.body).color;
  const textRgb = textColor.match(/\d+/g);
  let isLightText = false;
  
  if (textRgb && textRgb.length >= 3) {
    const textBrightness = (0.299 * parseInt(textRgb[0]) + 0.587 * parseInt(textRgb[1]) + 0.114 * parseInt(textRgb[2]));
    isLightText = textBrightness > 128; // 亮色文本通常意味着深色背景
  }
  
  // 主要依赖背景颜色判断，其次是类名
  // 只有当背景颜色无法判断且没有明确的暗黑类名时，才参考系统偏好
  if (isDarkBg || isLightText || hasDarkClass) {
    return true;
  }
  
  // 如果通过主要方法无法确定，则检查其他页面元素
  // 尝试获取一些主要内容区域的背景色
  const mainElements = document.querySelectorAll('main, article, .content, #content, .main, #main');
  for (const el of mainElements) {
    const elBg = getComputedStyle(el).backgroundColor;
    if (elBg && elBg !== 'rgba(0, 0, 0, 0)' && elBg !== 'transparent') {
      const elRgb = elBg.match(/\d+/g);
      if (elRgb && elRgb.length >= 3) {
        const elBrightness = (0.299 * parseInt(elRgb[0]) + 0.587 * parseInt(elRgb[1]) + 0.114 * parseInt(elRgb[2]));
        if (elBrightness < 128) {
          return true;
        }
      }
    }
  }
  
  // 作为最后的判断依据，如果系统处于暗黑模式，且页面背景非明显的白色，则可能是暗黑模式
  if (prefersDark) {
    // 检查背景是否是明显的白色（排除明确的浅色背景）
    if (rgb && rgb.length >= 3) {
      const r = parseInt(rgb[0]);
      const g = parseInt(rgb[1]);
      const b = parseInt(rgb[2]);
      // 如果RGB都很高（接近白色），则不视为暗黑模式
      if (r > 240 && g > 240 && b > 240) {
        return false;
      }
      return true;
    }
    return true;
  }
  
  return false;
}

// 应用高亮
export function applyHighlights() {
  // 先移除旧的高亮，避免重复
  removeHighlights();
  chrome.storage.local.get(['vocabulary'], (result) => {
    const vocabulary = result.vocabulary || {};
    const wordsArray = Object.keys(vocabulary);
    if (wordsArray.length > 0) {
      highlightWords(wordsArray, true, document.body);
    }
  });
}

// 高亮网页中的生词
// 添加 rootElement 参数，可以指定高亮的范围
export function highlightWords(wordsArray, highlightEnabled = true, rootElement = document.body) {
  if (!highlightEnabled || wordsArray.length === 0) return;

  const pattern = new RegExp(`\\b(${wordsArray.map(escapeRegExp).join('|')})\\b`, 'gi');
  
  // 检测是否为暗黑模式
  const darkModeEnabled = isDarkMode();

  // 只获取指定元素内的文本节点
  const textNodes = getTextNodes(rootElement);
  textNodes.forEach(node => {
    const text = node.nodeValue;
    
    // 检查节点是否已经被处理过或是否在已高亮的元素内
    if (!text || (node.parentNode && node.parentNode.classList && node.parentNode.classList.contains('vocabulary-highlight'))) return;
    
    // 跳过通知元素中的文本节点
    if (isInNotification(node)) return;

    if (!pattern.test(text)) return;
    
    pattern.lastIndex = 0; // 重置正则匹配索引

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }

      const span = document.createElement('span');
      span.className = 'vocabulary-highlight';
      
      // 根据暗黑模式添加适当的类名
      if (darkModeEnabled) {
        span.classList.add('dark-mode');
      } else {
        span.classList.add('light-mode');
      }
      
      span.textContent = match[0];
      // 添加自定义事件
      span.dataset.isVocabularyHighlight = 'true';

      fragment.appendChild(span);
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    // 替换前检查父节点是否存在且节点仍在文档中
    if (node.parentNode && document.contains(node)) {
      try {
        node.parentNode.replaceChild(fragment, node);
      } catch (error) {
        console.warn("无法替换节点:", error);
      }
    }
  });
}

// 检查节点是否在通知元素或悬浮提示框内
function isInNotification(node) {
  let current = node;
  while (current && current !== document.body) {
    // 检查是否是通知元素、悬浮提示框或其子元素
    if (current.nodeType === Node.ELEMENT_NODE && current.classList && 
        (current.classList.contains('vocabulary-notification') || 
         current.classList.contains('audio-error-notification') ||
         current.classList.contains('vocabulary-tooltip'))) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

// 移除所有高亮
export function removeHighlights() {
  const highlights = document.querySelectorAll('.vocabulary-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    if (!parent) return; // 如果没有父节点，则跳过

    const textNode = document.createTextNode(highlight.textContent || '');

    // 尝试替换节点
    try {
      parent.replaceChild(textNode, highlight);
      // 规范化父节点，合并相邻的文本节点
      parent.normalize();
    } catch (error) {
      console.error("移除高亮时出错:", error);
    }
  });
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& 表示匹配到的整个字符串
}

// 导出函数供其他模块使用
export { isInNotification, isDarkMode };