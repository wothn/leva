/**
 * 高亮功能模块
 * 负责在网页中查找和高亮显示生词，以及移除高亮
 */

import { getTextNodes } from './utils.js';

// 应用高亮
export function applyHighlights() {
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
export function highlightWords(wordsArray, highlightEnabled = true) {
  if (!highlightEnabled || wordsArray.length === 0) return;

  const pattern = new RegExp(`\\b(${wordsArray.map(escapeRegExp).join('|')})\\b`, 'gi');

  const textNodes = getTextNodes(document.body);
  textNodes.forEach(node => {
    const text = node.nodeValue;
    
    // 检查节点是否已经被处理过或是否在已高亮的元素内
    if (!text || node.parentNode.classList.contains('vocabulary-highlight')) return;
    
    // 跳过通知元素中的文本节点
    if (isInNotification(node)) return;

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
      // 添加自定义事件
      span.dataset.isVocabularyHighlight = 'true';

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

// 检查节点是否在通知元素内
function isInNotification(node) {
  let current = node.parentNode;
  while (current) {
    // 检查是否是通知元素或其子元素
    if (current.classList && 
        (current.classList.contains('vocabulary-notification') || 
         current.classList.contains('audio-error-notification'))) {
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
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& 表示匹配到的整个字符串
}