---
name: vocabulary-extension-refactor
overview: 将生词本 Chrome 扩展从原生 JavaScript 重构为 TypeScript + Vite 架构，优化数据结构，采用标准项目目录结构
todos:
  - id: setup-project
    content: 初始化 TypeScript + Vite 项目，配置 CRXJS 插件和目录结构
    status: completed
  - id: define-types
    content: 定义核心类型接口（VocabularyWord、Message 协议、Settings）
    status: completed
    dependencies:
      - setup-project
  - id: migrate-background
    content: 迁移 background.js 到 TypeScript，拆分为模块化结构
    status: completed
    dependencies:
      - define-types
  - id: migrate-content
    content: 迁移 content.js 到 TypeScript，分离高亮、工具栏、悬浮提示逻辑
    status: completed
    dependencies:
      - define-types
  - id: migrate-offscreen
    content: 迁移 offscreen.js 到 TypeScript，优化词典解析器
    status: completed
    dependencies:
      - define-types
  - id: migrate-popup
    content: 迁移 popup.js 和 popup.html 到 TypeScript 组件化结构
    status: completed
    dependencies:
      - define-types
  - id: migrate-settings
    content: 迁移 settings.js 到 options 页面，统一设置管理
    status: completed
    dependencies:
      - define-types
  - id: storage-migration
    content: 实现新旧数据结构兼容和自动迁移逻辑
    status: completed
    dependencies:
      - migrate-background
      - migrate-popup
  - id: build-test
    content: 配置构建流程，测试扩展功能完整性
    status: completed
    dependencies:
      - migrate-popup
      - migrate-settings
      - migrate-content
      - migrate-offscreen
      - migrate-background
      - storage-migration
---

## 产品概述

「生词本」Chrome 扩展重构项目，将现有的 JavaScript 项目迁移到 TypeScript，使用 Vite 进行现代化构建，并优化数据结构和项目架构。

## 核心功能

- 通过右键菜单、快捷键或浮动工具栏添加生词
- 在网页上自动高亮显示生词本中的单词
- 鼠标悬停时显示剑桥词典的英汉双语释义
- 生词管理（搜索、删除、导出）
- 用户偏好设置（高亮样式、深色模式等）

## 重构需求

1. **TypeScript 迁移**：为所有代码添加完整类型支持
2. **Vite 构建**：使用 Vite 作为构建工具，支持热更新和代码分割
3. **数据结构优化**：从简单字符串数组改为支持元数据的结构化对象
4. **标准目录结构**：采用现代 Chrome 扩展项目的标准目录组织方式

## Tech Stack

- **语言**: TypeScript 5.x
- **构建工具**: Vite 5.x + CRXJS Vite Plugin（用于 Chrome 扩展开发）
- **类型定义**: @types/chrome
- **代码规范**: ESLint + TypeScript ESLint
- **CSS**: 保留原有 CSS，迁移到 `src/styles/`

## Implementation Approach

### 整体策略

采用渐进式重构策略，保持原有功能不变的前提下进行技术栈升级：

1. 先搭建 TypeScript + Vite 项目骨架
2. 逐步迁移各个模块，保持接口兼容
3. 最后优化数据结构，添加新功能支持

### 关键技术决策

- **CRXJS Vite Plugin**: 专门用于 Chrome 扩展开发，自动处理 manifest 生成、HMR 支持
- **类型优先**: 先定义所有接口类型，再实现业务逻辑
- **存储兼容**: 新数据结构保持向后兼容，支持旧数据迁移

### 数据结构设计

```typescript
// 旧数据结构
vocabulary: string[]

// 新数据结构
interface VocabularyWord {
  id: string;           // 唯一标识
  word: string;         // 单词文本
  addedAt: number;      // 添加时间
  source?: string;      // 来源网页
  context?: string;     // 上下文句子
  reviewCount: number;  // 复习次数
  lastReviewedAt?: number;
  proficiency: 'new' | 'learning' | 'familiar' | 'mastered';
}

interface VocabularyStorage {
  words: VocabularyWord[];
  version: number;
}
```

### 性能考量

- 使用 Vite 的代码分割减少单个文件体积
- 保持 TreeWalker 高亮算法的性能优化
- 缓存策略保持不变，减少网络请求

## Architecture Design

### 目录结构

```
src/
├── background/          # Service Worker
│   ├── index.ts        # 入口
│   ├── contextMenu.ts  # 右键菜单
│   ├── commands.ts     # 快捷键处理
│   └── messageHandler.ts # 消息路由
├── content/            # 内容脚本
│   ├── index.ts        # 入口
│   ├── highlight.ts    # 高亮渲染
│   ├── tooltip.ts      # 悬浮释义
│   ├── toolbar.ts      # 浮动工具栏
│   └── notification.ts # 通知系统
├── offscreen/          # 离屏文档
│   ├── index.ts        # 入口
│   ├── parser.ts       # 词典解析
│   └── cache.ts        # 缓存管理
├── popup/              # 弹窗页面
│   ├── index.ts
│   ├── index.html
│   └── vocabulary.ts   # 生词列表管理
├── options/            # 设置页面
│   ├── index.ts
│   ├── index.html
│   └── settings.ts
├── types/              # 类型定义
│   ├── index.ts        # 主出口
│   ├── vocabulary.ts   # 生词相关
│   ├── message.ts      # 消息协议
│   └── settings.ts     # 设置项
├── utils/              # 工具函数
│   ├── storage.ts      # 存储封装
│   └── audio.ts        # 音频处理
└── styles/             # 样式文件
    ├── content.css
    ├── popup.css
    └── options.css
```

### 模块职责

- **background**: 处理扩展生命周期事件、右键菜单、快捷键、消息路由、音频代理
- **content**: 页面内容注入、高亮渲染、悬浮提示、工具栏、通知
- **offscreen**: 剑桥词典页面解析（Manifest V3 限制下的 DOM 操作）
- **popup**: 生词本弹窗界面
- **options**: 设置页面

## Implementation Notes

1. **Manifest V3 兼容**: 保持 Service Worker 模式，使用 Offscreen API 进行 DOM 解析
2. **消息类型安全**: 使用 TypeScript 严格定义所有消息接口，避免运行时错误
3. **存储迁移**: 启动时检查旧格式数据，自动迁移到新结构
4. **CSS 迁移**: 保留原有样式，仅调整路径引用
5. **开发体验**: 配置 Vite HMR，修改代码后自动刷新扩展