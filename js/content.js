// 全局变量
let highlightEnabled = true;

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