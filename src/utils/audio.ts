/**
 * 音频处理工具
 */

/**
 * 下载音频并转换为 data URL
 * @param audioUrl - 音频文件 URL
 * @returns data URL
 */
export async function downloadAudioAsDataUrl(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`下载音频失败: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // 转换为 base64
  let binaryString = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i])
  }
  const base64 = btoa(binaryString)

  // 推断 MIME 类型
  const mimeType = audioUrl.includes('.mp3')
    ? 'audio/mpeg'
    : audioUrl.includes('.ogg')
      ? 'audio/ogg'
      : 'audio/mpeg'

  return `data:${mimeType};base64,${base64}`
}

/**
 * 生成音频备用 URL 列表
 * @param originalUrl - 原始音频 URL
 * @returns 备用 URL 数组
 */
export function generateAudioFallbackUrls(originalUrl: string): string[] {
  const urls = [originalUrl]

  // MP3 -> OGG
  if (originalUrl.includes('.mp3')) {
    urls.push(originalUrl.replace('.mp3', '.ogg'))
  }

  // OGG -> MP3
  if (originalUrl.includes('.ogg')) {
    urls.push(originalUrl.replace('.ogg', '.mp3'))
  }

  return urls
}

/**
 * 播放音频
 * @param url - 音频 URL 或 data URL
 * @param timeoutMs - 超时时间 (默认 10秒)
 */
export function playAudio(url: string, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()

    const timeout = setTimeout(() => {
      audio.pause()
      reject(new Error('音频加载超时'))
    }, timeoutMs)

    audio.addEventListener('ended', () => {
      clearTimeout(timeout)
      resolve()
    })

    audio.addEventListener('error', () => {
      clearTimeout(timeout)
      const errorMsg = audio.error
        ? `Audio error ${audio.error.code}: ${getAudioErrorMessage(audio.error.code)}`
        : '未知音频错误'
      reject(new Error(errorMsg))
    })

    audio.src = url
    audio.load()

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        clearTimeout(timeout)
        reject(new Error(`播放失败: ${error.message}`))
      })
    }
  })
}

/**
 * 获取音频错误消息
 */
function getAudioErrorMessage(errorCode: number): string {
  const messages: Record<number, string> = {
    1: 'MEDIA_ERR_ABORTED - 播放被中断',
    2: 'MEDIA_ERR_NETWORK - 网络错误',
    3: 'MEDIA_ERR_DECODE - 解码错误',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 音频格式不支持',
  }
  return messages[errorCode] || `未知错误 (${errorCode})`
}

/**
 * 尝试播放音频（带备用方案）
 * @param audioSrc - 音频源 URL
 */
export async function playAudioWithFallback(audioSrc: string): Promise<void> {
  const fallbackUrls = generateAudioFallbackUrls(audioSrc)

  for (let i = 0; i < fallbackUrls.length; i++) {
    const url = fallbackUrls[i]

    try {
      await playAudio(url)
      return
    } catch (error) {
      if (i === fallbackUrls.length - 1) {
        throw new Error(`所有音频源都无法播放: ${error}`)
      }
    }
  }
}
