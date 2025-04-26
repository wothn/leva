/**
 * 菜单管理模块
 * 负责创建和管理右键菜单
 */

// 创建右键菜单的函数
export function createContextMenu() {
  // 确保删除之前可能存在的菜单，避免重复
  chrome.contextMenus.removeAll(() => {
    // 创建右键菜单项
    chrome.contextMenus.create({
      id: "addToVocabulary",
      title: '添加"%s"到生词本',
      contexts: ["selection"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("创建右键菜单失败:", chrome.runtime.lastError);
      } else {
        console.log("成功创建右键菜单");
      }
    });
  });
}

// 初始化菜单
export function initMenu() {
  // 创建右键菜单
  createContextMenu();
  
  // 确保在浏览器启动时也创建右键菜单
  chrome.runtime.onStartup.addListener(createContextMenu);
}