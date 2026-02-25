import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '生词本',
  version: '2.0.0',
  description: '收集并高亮显示网页上的生词',
  permissions: ['storage', 'contextMenus', 'activeTab', 'offscreen', 'scripting'],
  host_permissions: ['https://dictionary.cambridge.org/*'],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; media-src 'self' blob: data:;",
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      css: ['src/styles/content.css'],
    },
  ],
  options_page: 'src/options/index.html',
  web_accessible_resources: [
    {
      resources: ['icons/*', 'src/styles/*'],
      matches: ['<all_urls>'],
    },
  ],
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+V',
        mac: 'MacCtrl+Shift+V',
      },
      description: '打开生词本弹窗',
    },
    add_selected_word: {
      suggested_key: {
        default: 'Ctrl+Shift+A',
        mac: 'MacCtrl+Shift+A',
      },
      description: '添加选中的单词到生词本',
    },
  },
})
