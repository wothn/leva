# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目概述

这是一个 Chrome 浏览器扩展（Manifest V3），名为「生词本」，用于帮助用户在浏览网页时收集和管理生词。项目使用 TypeScript 开发，Vite 构建，CRXJS 插件打包。

主要功能：
- 通过右键菜单、快捷键（Ctrl+Shift+A）或浮动工具栏添加生词
- 在网页上自动高亮显示生词本中的单词
- 鼠标悬停时显示剑桥词典的英汉双语释义
- 生词管理（搜索、删除、导出）
- 可自定义的设置（高亮样式、深色模式等）

## 常用命令

### 开发构建

**安装依赖：**
```bash
npm install
```

**开发模式（热更新）：**
```bash
npm run dev
```
启动 Vite 开发服务器，自动监视文件变化并重新构建。

**生产构建：**
```bash
npm run build
```
先运行 TypeScript 编译器检查类型，然后使用 Vite 构建扩展，输出到 `dist/` 目录。

**代码检查：**
```bash
npm run lint
```
使用 ESLint 检查 `src/` 目录下的 TypeScript 文件。

### 加载扩展到 Chrome

1. 运行 `npm run build` 生成 `dist/` 目录
2. 打开 `chrome://extensions/`
3. 启用「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择项目根目录 `e:/Tools/leva`

### 调试

**调试内容脚本：** 在任意网页打开 DevTools → Sources → Content scripts → 找到 `src/content/index.ts`

**调试后台脚本：** 在 `chrome://extensions/` 找到扩展卡片 → 点击「Service Worker」链接

**调试弹窗：** 点击扩展图标打开弹窗 → 右键点击弹窗空白处 → 选择「检查」

**调试设置页面：** 右键点击扩展图标 → 选择「选项」→ 右键页面空白处 → 选择「检查」

**调试离屏文档：** 在 Service Worker 控制台中查看 `chrome.offscreen` 相关日志

### 核心架构

**1. 权限与存储**

使用 `chrome.storage.local` 持久化数据：
- `vocabulary_v2`：生词列表（包含 word、addedAt、reviewCount、proficiency、tags 等字段）
- `settings`：用户设置对象
- `definition_<word>`：单词释义缓存（24小时过期）

存储管理通过 `src/utils/storage.ts` 中的三个类实现：
- `VocabularyStorageManager`：生词增删改查，支持从旧版数据迁移
- `SettingsStorageManager`：设置读写，合并默认值
- `CacheStorageManager`：缓存读写，自动过期检查

**2. 组件通信模型**

```
content/ (内容脚本，在网页中运行)
    ↕ chrome.runtime.sendMessage
background/ (Service Worker)
    ↕ chrome.runtime.sendMessage (target: 'offscreen')
offscreen/ (离屏文档，用于 DOM 解析)
```

消息类型定义在 `src/types/message.ts`：
- `getDefinition`：请求单词释义
- `getFromCache`/`saveToCache`/`removeFromCache`：缓存操作
- `downloadAudio`：代理下载音频文件（转为 base64 data URL）
- `updateHighlight`：通知内容脚本更新高亮
- `showNotification`：显示浏览器内通知
- `clearCache`：清除所有释义缓存
- `parseDefinition`（target: 'offscreen'）：离屏文档解析请求

**3. 生词收集流程**

用户触发（右键/快捷键/工具栏）→ `background/commands.ts` 或 `contextMenu.ts` 处理 → 检查重复 → 调用 `VocabularyStorageManager.addWord()` → 发送 `showNotification` 消息到 content → 发送 `updateHighlight` 通知所有标签页更新高亮

**4. 高亮渲染机制**

`content/highlight.ts` 使用 `TreeWalker` 遍历 DOM 文本节点，通过正则匹配生词，将匹配文本替换为带样式的 `<span class="vocabulary-highlight">`。使用 `MutationObserver` 监听 DOM 变化处理动态加载内容，带有 100ms 防抖。

高亮样式通过 CSS 类和内联样式组合实现：
- `solid`：下划线（text-decoration）
- `dotted`/`dashed`：边框样式
- `background`：背景色

颜色通过内联 `style` 属性设置，确保用户自定义颜色生效。

**5. 悬浮释义实现**

鼠标悬停高亮单词 → `content/tooltip.ts` 发送 `getDefinition` 消息 → `background/messageHandler.ts` 调用 `createOffscreenDocument()` 确保离屏文档存在 → 转发到 `offscreen/index.ts` → 先查缓存，未命中则 `parser.ts` fetch 剑桥词典页面 → DOM 解析提取音标、释义、例句 → 生成 HTML 返回 → content 渲染 tooltip

Tooltip 定位逻辑会智能检测屏幕边界，自动调整显示位置避免溢出。

**6. 音频播放机制**

剑桥词典音频受 CORS 限制，需通过 background 代理下载：
- content 请求 `downloadAudio` → background `downloadAudioAsDataUrl()` fetch 音频 → ArrayBuffer 转 base64 → 返回 data URL → content 使用 `Audio` 元素播放

**7. 词典解析器 (offscreen/parser.ts)**

基于剑桥词典页面真实 DOM 结构编写，主要解析逻辑：
- 英音/美音音标：`.uk.dpron-i` / `.us.dpron-i` 中的 `.ipa.dipa`
- 音频链接：从 `<audio>` 元素的 `<source>` 中提取
- 词性：`.pos.dpos`
- 释义：`.def-block.ddef_block` 中的 `.def.ddef_d`
- 中文翻译：`.trans.dtrans.dtrans-se`
- 例句：`.examp.dexamp` 中的 `.eg.deg`（英文）和 `.trans.dtrans`（中文）

解析结果通过 `generateResultHTML()` 生成 HTML 字符串返回给 content 渲染。

**8. 设置系统**

默认设置定义在 `src/types/settings.ts` 的 `DEFAULT_SETTINGS` 对象中：
- `highlightEnabled`：是否启用高亮
- `highlightStyle`：高亮样式（solid/dotted/dashed/background）
- `highlightColor`：高亮颜色
- `toolbarEnabled`：是否显示划词工具栏
- `tooltipEnabled`：是否启用悬浮释义
- `darkMode`：深色模式
- `autoPronounce`：自动发音

设置变更通过 `chrome.storage.onChanged` 事件监听，在 `content/index.ts` 中实时同步到所有标签页。

### 关键注意事项

1. **Manifest V3 限制**：后台脚本为 Service Worker，不可直接操作 DOM，需通过 Offscreen API 创建离屏文档进行网页解析
2. **CORS 处理**：剑桥词典音频资源需通过 background.js 代理下载，不能直接在内容脚本中 fetch
3. **缓存过期**：释义缓存默认 24 小时过期，过期后自动清除
4. **消息通道**：异步消息处理需返回 `true` 保持通道开放
5. **扩展上下文检查**：发送消息前需检查 `chrome.runtime` 是否有效，避免扩展更新后出错
6. **TypeScript 严格模式**：项目启用严格类型检查，确保类型安全
7. **禁止Any**：禁止使用 `any` 类型，确保类型安全
