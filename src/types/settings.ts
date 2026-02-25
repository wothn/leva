/**
 * 高亮样式类型
 */
export type HighlightStyle = 'solid' | 'dotted' | 'dashed' | 'background'

/**
 * 扩展设置
 */
export interface ExtensionSettings {
  /** 是否启用高亮 */
  highlightEnabled: boolean
  /** 高亮样式 */
  highlightStyle: HighlightStyle
  /** 高亮颜色 */
  highlightColor: string
  /** 是否启用划词工具栏 */
  toolbarEnabled: boolean
  /** 是否启用悬浮释义 */
  tooltipEnabled: boolean
  /** 深色模式 */
  darkMode: boolean
  /** 自动发音 */
  autoPronounce: boolean
}

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  highlightEnabled: true,
  highlightStyle: 'solid',
  highlightColor: '#FFD700',
  toolbarEnabled: true,
  tooltipEnabled: true,
  darkMode: false,
  autoPronounce: false,
}

/**
 * 设置键名
 */
export const SETTINGS_KEYS: (keyof ExtensionSettings)[] = [
  'highlightEnabled',
  'highlightStyle',
  'highlightColor',
  'toolbarEnabled',
  'tooltipEnabled',
  'darkMode',
  'autoPronounce',
]
