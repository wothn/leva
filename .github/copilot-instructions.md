
# Copilot 指南

## 项目架构

这是一个基于 Manifest V3 的**Chrome 扩展**，用于英语生词学习，支持单词收集、高亮和词典释义查询。扩展在多个上下文中运行，各组件之间有明确的协作。

### 核心组件

- **后台 Service Worker**（`js/background.js`）：管理右键菜单、快捷键、通知和跨标签通信
- **内容脚本**（`js/content.js`）：负责网页上的单词高亮、悬浮释义和用户交互
- **Offscreen 隔离文档**（`js/offscreen.js`）：用于剑桥词典解析，绕过 CORS 限制
- **弹窗界面**（`popup.html` + `js/popup.js`）：单词管理、搜索、导出和批量操作
- **设置页面**（`settings.html` + `js/settings.js`）：用户偏好设置，支持全局实时同步

### 关键工作流

**词典解析流程：**
1. 内容脚本通过 `chrome.runtime.sendMessage` 请求释义
2. 后台脚本按需创建 offscreen 文档
3. offscreen 文档抓取并解析剑桥词典 HTML（用特定选择器）
4. 解析结果经消息链返回，最终在 tooltip 展示

**存储策略：**
- `vocabulary`：已收集单词数组
- `definitionCache`：单词到解析释义的映射对象
- 设置对象，所有上下文通过 `chrome.storage.onChanged` 实时同步

**主题系统：**
使用 CSS 变量，自动检测暗色模式。tooltip 和 popup 共享 `:root` 设计令牌。

## 开发模式

### CSS 架构
- **设计系统**：`popup.css` 中的 CSS 变量作为设计令牌
- **命名规范**：BEM 风格，带语义前缀（如 `tooltip-`、`word-`、`empty-`）
- **响应式断点**：仅用 `@media (max-width: 350px)` 控制弹窗宽度
- **主题变量**：亮/暗主题变量名一致，仅值不同

### 消息通信
```javascript
// 跨上下文通信标准写法
chrome.runtime.sendMessage({
  target: "offscreen",
  action: "parseDefinition", 
  word: selectedWord
});
```

### 错误处理
- 所有操作前都需检查 `chrome.runtime` 是否可用
- 异步操作（如词典解析）需加超时保护（30 秒）
- 权限或 API 不可用时需优雅降级

### 剑桥词典解析
基于 `example.html` 的真实 DOM 结构，使用如下选择器：
- 单词：`.hw.dhw`
- 音标：`.pron.dpron .ipa.dipa`
- 音频：`audio source[src]`
- 释义：`.def.ddef_d`
- 例句：`.eg.deg`

## 文件组织模式

- **CSS 文件**：按组件分（`popup.css`、`content.css`、`settings.css`）
- **HTML 模板**：结构静态，内容由 JS 动态注入
- **图标资源**：多尺寸（16/48/128px）适配不同 UI
- **测试文件**：`example.html` 用于本地解析逻辑测试

## 集成点

- **Chrome Storage API**：全扩展上下文同步设置
- **Chrome Notifications**：单词操作用户反馈
- **Chrome Tabs API**：生词变动时跨标签高亮同步
- **Web Audio API**：发音播放，带多 URL 兜底
- **Cambridge Dictionary**：直接解析 HTML，无需 API

## 设计风格

=**简洁现代**的设计风格：

### 设计特点
- **极简主义**：去除多余装饰，突出内容本身
- **现代扁平化**：使用圆角边框、简洁线条和现代色彩
- **分层清晰**：通过背景色和边框区分不同内容区域
- **响应式适配**：支持亮色和暗色主题自动切换

### 色彩方案
- **亮色主题**：白色背景 `#ffffff`，浅灰蓝标题区 `#f8fafc`，深灰文字 `#1f2937`
- **暗色主题**：深蓝灰背景 `#1f2937`，更深标题区 `#111827`，浅色文字 `#f3f4f6`
- **强调色**：现代蓝紫色 `#6366f1` 用于交互元素
