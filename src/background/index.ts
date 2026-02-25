import { createContextMenu, handleContextMenuClick } from './contextMenu'
import { handleCommand } from './commands'
import { handleMessage } from './messageHandler'

/**
 * Background Script 入口
 */

// 安装/更新时初始化
chrome.runtime.onInstalled.addListener(() => {
  createContextMenu()
})

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(handleContextMenuClick)

// 监听快捷键命令
chrome.commands.onCommand.addListener(handleCommand)

// 监听消息
chrome.runtime.onMessage.addListener(handleMessage)

console.log('Vocabulary Extension Background Script loaded')
