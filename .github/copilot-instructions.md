## 开发技术

- **前端**：HTML, CSS, JavaScript
- **存储**：Chrome Storage API
- **浏览器API**：
  - Chrome Extensions API
  - Context Menus API
  - Notifications API

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
- 提供导出生词列表功能
## 项目结构

```
生词本浏览器扩展/
│
├── manifest.json        # 扩展配置文件
├── popup.html           # 扩展弹出窗口HTML
│
├── css/
│   ├── content.css      # 网页内容样式（用于高亮显示）
│   └── popup.css        # 扩展弹出窗口样式
│
├── icons/
│   ├── icon16.svg       # 16x16像素图标
│   ├── icon48.svg       # 48x48像素图标
│   └── icon128.svg      # 128x128像素图标
│
└── js/
    ├── background.js    # 后台脚本（处理右键菜单等）
    ├── content.js       # 内容脚本（网页高亮实现）
    └── popup.js         # 弹出窗口脚本（生词本管理）
```