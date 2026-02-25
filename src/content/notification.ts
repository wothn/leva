/**
 * 通知系统模块
 */

let notificationElement: HTMLElement | null = null

/**
 * 显示浏览器内通知
 */
export function showNotification(
  message: string,
  type: 'success' | 'info' | 'error' = 'success'
): void {
  // 移除已存在的通知
  if (notificationElement) {
    notificationElement.remove()
  }

  notificationElement = document.createElement('div')
  notificationElement.className = `vocabulary-notification ${type}`
  notificationElement.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close" title="关闭">×</button>
    </div>
  `

  document.body.appendChild(notificationElement)

  // 关闭按钮事件
  const closeBtn = notificationElement.querySelector('.notification-close')
  closeBtn?.addEventListener('click', hideNotification)

  // 显示动画
  requestAnimationFrame(() => {
    notificationElement?.classList.add('show')
  })

  // 自动隐藏
  setTimeout(hideNotification, 3000)
}

/**
 * 隐藏通知
 */
export function hideNotification(): void {
  if (notificationElement) {
    notificationElement.classList.remove('show')
    setTimeout(() => {
      notificationElement?.remove()
      notificationElement = null
    }, 300)
  }
}
