# 生词本浏览器扩展

这是一个Chrome扩展，可以帮助用户收集和管理在浏览网页时遇到的生词。

## 功能特点

1. **生词收集**：
   - 通过右键菜单选项添加生词
   - 支持快捷键（Ctrl+Shift+A）快速添加选中的单词
   - 支持浮动工具栏，在选中文本时出现添加按钮

2. **高亮显示**：
   - 自动高亮显示网页上的生词
   - 支持多种高亮样式（下划线、背景色、边框）
   - 支持自定义高亮颜色

3. **生词管理**：
   - 在弹出窗口中展示收集的所有生词
   - 提供搜索过滤功能
   - 支持删除单个生词
   - 支持一键清空所有生词
   - 支持清空单词释义缓存
   - 提供导出生词列表功能

4. **设置功能**：
   - 提供用户友好的设置界面
   - 支持开启/关闭划词工具栏
   - 支持自定义高亮样式和颜色
   - 支持开启/关闭悬浮释义功能
   - 支持开启/关闭深色模式
   - 支持开启/关闭自动发音功能

5. **悬浮释义**：
   - 当用户鼠标悬停在高亮单词上时显示释义
   - 通过Cambridge Dictionary获取单词的英汉/英英释义
   - 显示包含音标、多个释义和例句的悬浮提示框
   - 支持单词发音功能

## 词典解析系统

当前版本使用 **Cambridge Dictionary** 作为唯一词典来源，提供英汉双语释义与例句。

### 支持特性
- **英文定义**：完整英文定义
- **中文翻译**：中文释义与例句翻译（视页面内容而定）
- **例句展示**：英文例句 + 中文翻译（可选）
- **音标发音**：英式/美式音标与发音

## 安装和使用

### 开发模式（推荐）
1. 安装依赖：`npm install`
2. 启动开发构建：`npm run dev`
3. 在 Chrome 中打开 `chrome://extensions/`
4. 启用"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择项目的 `dist/` 目录

### 生产构建
1. 运行：`npm run build`
2. 在 Chrome 中加载 `dist/` 目录

## 测试

### 运行测试
- 交互模式（监听文件变化）：`npm run test`
- 单次运行（适合 CI）：`npm run test:run`
- 生成覆盖率报告：`npm run test:coverage`

### 说明
- 测试框架使用 **Vitest**
- 测试文件位于 `src/**/*.test.ts`
- 已内置 Chrome Storage 的内存 mock，便于测试存储逻辑

## 快捷键

- `Ctrl+Shift+V`：打开生词本弹窗
- `Ctrl+Shift+A`：添加选中的单词到生词本

## 技术实现

### 核心文件
- `src/offscreen/parser.ts` - 剑桥词典解析器
- `src/offscreen/index.ts` - Offscreen 入口与缓存调度
- `src/content/highlight.ts` - 页面高亮渲染
- `src/background/messageHandler.ts` - 消息路由与缓存/音频代理

### 数据格式
所有词典解析结果统一为以下格式：
```javascript
{
  word: "apple",
  dictionary: "cambridge",
  pronunciations: [...],
  definitions: [{
    partOfSpeech: "noun",
    definition: "英文定义",
    chinese: "中文翻译",
    examples: [{
      eng: "英文例句",
      chi: "中文翻译"
    }]
  }]
}
```

- 使用Chrome Extensions API
- 使用Chrome Storage API存储生词数据
- 使用Offscreen API解析词典网页
- 使用正则表达式匹配和高亮生词
- 使用MutationObserver监视DOM变化以处理动态内容