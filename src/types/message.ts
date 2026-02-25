import type { DictionaryResult, DefinitionCache } from './dictionary'
import type { ExtensionSettings } from './settings'

/**
 * 消息动作类型
 */
export type MessageAction =
  | 'getDefinition'
  | 'getFromCache'
  | 'saveToCache'
  | 'removeFromCache'
  | 'downloadAudio'
  | 'updateHighlight'
  | 'showNotification'
  | 'clearCache'
  | 'addWord'
  | 'getSettings'
  | 'parseDefinition'

/**
 * 基础消息接口
 */
export interface BaseMessage {
  action: MessageAction
}

/**
 * 获取释义请求
 */
export interface GetDefinitionMessage extends BaseMessage {
  action: 'getDefinition'
  word: string
}

/**
 * 获取释义响应
 */
export interface GetDefinitionResponse {
  definition: string | null
  error?: string
}

/**
 * 从缓存获取请求
 */
export interface GetFromCacheMessage extends BaseMessage {
  action: 'getFromCache'
  word: string
}

/**
 * 从缓存获取响应
 */
export interface GetFromCacheResponse {
  data: DefinitionCache | null
}

/**
 * 保存到缓存请求
 */
export interface SaveToCacheMessage extends BaseMessage {
  action: 'saveToCache'
  word: string
  data: DictionaryResult
}

/**
 * 保存到缓存响应
 */
export interface SaveToCacheResponse {
  success: boolean
}

/**
 * 从缓存删除请求
 */
export interface RemoveFromCacheMessage extends BaseMessage {
  action: 'removeFromCache'
  word: string
}

/**
 * 从缓存删除响应
 */
export interface RemoveFromCacheResponse {
  success: boolean
}

/**
 * 下载音频请求
 */
export interface DownloadAudioMessage extends BaseMessage {
  action: 'downloadAudio'
  audioUrl: string
}

/**
 * 下载音频响应
 */
export interface DownloadAudioResponse {
  dataUrl: string | null
  error?: string
}

/**
 * 更新高亮消息
 */
export interface UpdateHighlightMessage extends BaseMessage {
  action: 'updateHighlight'
}

/**
 * 显示通知消息
 */
export interface ShowNotificationMessage extends BaseMessage {
  action: 'showNotification'
  message: string
  type: 'success' | 'info' | 'error'
}

/**
 * 清除缓存消息
 */
export interface ClearCacheMessage extends BaseMessage {
  action: 'clearCache'
}

/**
 * 添加单词消息
 */
export interface AddWordMessage extends BaseMessage {
  action: 'addWord'
  word: string
  context?: string
  sourceUrl?: string
  sourceTitle?: string
}

/**
 * 获取设置消息
 */
export interface GetSettingsMessage extends BaseMessage {
  action: 'getSettings'
}

/**
 * 获取设置响应
 */
export type GetSettingsResponse = ExtensionSettings

/**
 * 解析释义请求 (Offscreen)
 */
export interface ParseDefinitionMessage extends BaseMessage {
  action: 'parseDefinition'
  target: 'offscreen'
  word: string
}

/**
 * 解析释义响应 (Offscreen)
 */
export interface ParseDefinitionResponse {
  definition: string | null
  error?: string
}

/**
 * 联合消息类型
 */
export type Message =
  | GetDefinitionMessage
  | GetFromCacheMessage
  | SaveToCacheMessage
  | RemoveFromCacheMessage
  | DownloadAudioMessage
  | UpdateHighlightMessage
  | ShowNotificationMessage
  | ClearCacheMessage
  | AddWordMessage
  | GetSettingsMessage
  | ParseDefinitionMessage

/**
 * 消息响应类型映射
 */
export interface MessageResponseMap {
  getDefinition: GetDefinitionResponse
  getFromCache: GetFromCacheResponse
  saveToCache: SaveToCacheResponse
  removeFromCache: RemoveFromCacheResponse
  downloadAudio: DownloadAudioResponse
  updateHighlight: void
  showNotification: void
  clearCache: void
  addWord: void
  getSettings: GetSettingsResponse
  parseDefinition: ParseDefinitionResponse
}

/**
 * 发送消息函数类型
 */
export type SendMessage = <T extends MessageAction>(
  message: Extract<Message, { action: T }>
) => Promise<MessageResponseMap[T]>
