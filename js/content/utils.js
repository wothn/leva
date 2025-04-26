/**
 * 工具函数模块
 * 包含网页内容操作、DOM遍历、位置计算等通用功能
 */

// 获取所有文本节点
export function getTextNodes(element) {
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

// 计算和设置tooltip的位置
export function positionTooltip(targetElement, tooltip) {
  if (!tooltip) return;

  let rect;
  if (targetElement) {
    rect = targetElement.getBoundingClientRect();
  } else {
    // 如果没有目标元素（例如更新内容后重新定位），尝试基于当前位置调整
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