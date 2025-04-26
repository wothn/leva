当你完成某项值得被记录的功能时请在这里记录，方便后来者快速理解功能和实现逻辑
## 开发技术

- **开发环境**：Windows10 命令行 powershell
- **前端**：HTML, CSS, JavaScript
- **存储**：Chrome Storage API
- **浏览器API**：
  - Chrome Extensions API
  - Context Menus API
  - Notifications API
  - Offscreen API

## 技术实现

### 1. 扩展配置（manifest.json）

- 使用 Manifest V3 格式
- 申请必要的权限：storage（存储生词）、contextMenus（右键菜单）、activeTab（访问当前标签页）
- 配置内容脚本、后台脚本和弹出页面

### 2. 生词收集功能

- 通过右键菜单选项实现单词收集
- 使用 Chrome Storage API 存储生词数据
- 收集成功时显示通知提醒

### 3. 高亮显示功能

- 使用正则表达式在网页上查找匹配的生词
- 通过 DOM 操作将找到的文本包装在带样式的 span 元素中
- 实现高亮显示的开关控制

### 4. 生词管理功能

- 在弹出窗口中展示收集的所有生词
- 提供搜索过滤功能
- 支持删除单个生词
- 支持一键清空所有生词
- 支持清空单词释义缓存
- 提供导出生词列表功能

### 5. 悬浮释义功能

- 当用户鼠标悬停在高亮单词上时触发释义查询
- 通过 Cambridge Dictionary 获取单词的英汉/英英释义
- 使用 Offscreen API 解析词典网页提取关键信息
- 显示包含音标、多个释义和例句的悬浮提示框
- 实现缓存机制减少重复请求，提高性能
- 提供优雅的加载动画和精美的界面设计
- 根据页面布局智能定位悬浮提示框位置

## 项目结构

```
生词本浏览器扩展/
│
├── manifest.json        # 扩展配置文件
├── popup.html           # 扩展弹出窗口HTML
├── offscreen.html       # 用于离屏DOM解析的HTML
├── README.md            # 项目说明文档
│
├── css/
│   ├── content.css      # 网页内容样式（用于高亮和悬浮提示）
│   └── popup.css        # 扩展弹出窗口样式
│
├── icons/
│   ├── icon16.png       # 16x16像素图标
│   ├── icon48.png       # 48x48像素图标
│   └── icon128.png      # 128x128像素图标
│
└── js/
    ├── background.js    # 后台脚本（处理右键菜单、词典查询等）
    ├── content.js       # 内容脚本（网页高亮和悬浮提示实现）
    ├── offscreen.js     # 离屏页面脚本（处理HTML解析）
    └── popup.js         # 弹出窗口脚本（生词本管理）
```

## 使用Vite打包Chrome扩展

项目使用Vite作为构建工具，替代了之前考虑的Webpack。Vite提供了更快的开发体验和更简洁的配置。

### 关键配置：

1. 使用@crxjs/vite-plugin插件处理Chrome扩展特有的manifest.json
2. 配置了多入口点：background、content、popup和offscreen
3. 设置了资源输出路径，保持了与原始项目结构一致的文件组织
4. 添加了开发服务器配置，支持热更新开发

### 开发命令：
- `npm run dev`：启动开发服务器
- `npm run build`：构建生产版本扩展