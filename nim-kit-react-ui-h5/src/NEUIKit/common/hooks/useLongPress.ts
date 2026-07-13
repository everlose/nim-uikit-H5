import { useEffect, useRef, useCallback } from 'react'

export interface UseLongPressOptions {
  /** 长按触发回调 */
  onLongPress: () => void
  /** 长按时长（ms），默认 500 */
  duration?: number
  /** 手指移动超过此距离（px）则取消长按，默认 30 */
  moveThreshold?: number
  /** 禁用长按 */
  disabled?: boolean
}

export interface UseLongPressReturn<T extends HTMLElement = HTMLElement> {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchCancel: (e: React.TouchEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  /** 绑定到目标元素，用于注册原生事件监听器 */
  ref: React.RefObject<T>
  /**
   * 长按触发后 ~500ms 内为 true。
   * 在全局 click handler 中检查此标志以抑制 Android post-touchend click。
   */
  longPressTriggered: React.MutableRefObject<boolean>
  /** 长按起始触摸位置，可用于定位弹出菜单 */
  touchPosition: React.MutableRefObject<{ x: number; y: number } | null>
}

export function useLongPress<T extends HTMLElement = HTMLElement>(
  options: UseLongPressOptions
): UseLongPressReturn<T> {
  const {
    onLongPress,
    duration = 500,
    moveThreshold = 30,
    disabled = false,
  } = options

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchPositionRef = useRef<{ x: number; y: number } | null>(null)
  const startEventRef = useRef<TouchEvent | null>(null)
  const longPressTriggeredRef = useRef(false)
  const elementRef = useRef<T>(null)
  const onLongPressRef = useRef(onLongPress)

  // 保持回调引用最新，避免 handler 重建
  onLongPressRef.current = onLongPress

  // --- 工具方法 ---
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const clearSelection = useCallback(() => {
    try {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) sel.removeAllRanges()
    } catch (_) { /* ignore */ }
  }, [])

  const fireLongPress = useCallback(() => {
    // 阻止 iOS 原生长按效果
    startEventRef.current?.preventDefault()
    clearSelection()
    // Android：标记长按已触发，后续 touchend 产生的 click 将被忽略
    longPressTriggeredRef.current = true
    setTimeout(() => {
      longPressTriggeredRef.current = false
    }, 500)
    onLongPressRef.current()
  }, [clearSelection])

  // --- React 合成事件 handler ---
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const touch = e.touches[0]
      if (!touch) return
      touchPositionRef.current = { x: touch.clientX, y: touch.clientY }
      clearTimer()
      timerRef.current = setTimeout(fireLongPress, duration)
    },
    [disabled, duration, fireLongPress, clearTimer]
  )

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTriggeredRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
    clearTimer()
  }, [clearTimer])

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!timerRef.current || !touchPositionRef.current) return
      const touch = e.touches[0]
      if (!touch) {
        clearTimer()
        return
      }
      const dx = touch.clientX - touchPositionRef.current.x
      const dy = touch.clientY - touchPositionRef.current.y
      if (Math.sqrt(dx * dx + dy * dy) > moveThreshold) {
        clearTimer()
      }
    },
    [moveThreshold, clearTimer]
  )

  const onTouchCancel = useCallback((e: React.TouchEvent) => {
    if (longPressTriggeredRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
    startEventRef.current = null
    clearTimer()
  }, [clearTimer])

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      startEventRef.current?.preventDefault()
      // Android：长按定时器可能已触发，contextmenu 后到则忽略
      if (longPressTriggeredRef.current) return
      clearTimer()
      clearSelection()
      longPressTriggeredRef.current = true
      setTimeout(() => {
        longPressTriggeredRef.current = false
      }, 500)
      onLongPressRef.current()
    },
    [disabled, clearTimer, clearSelection]
  )

  // --- 原生事件监听（必须 passive: false 才能 preventDefault 阻止 iOS callout）---
  useEffect(() => {
    const el = elementRef.current
    if (!el) return

    const captureTouchStart = (e: TouchEvent) => {
      startEventRef.current = e
    }
    const releaseTouchStart = (e: TouchEvent) => {
      if (longPressTriggeredRef.current) {
        e.preventDefault()
      }
      startEventRef.current = null
    }
    const preventSelect = (e: Event) => {
      e.preventDefault()
    }

    el.addEventListener('touchstart', captureTouchStart, { passive: false })
    el.addEventListener('touchend', releaseTouchStart, { passive: false })
    el.addEventListener('touchcancel', releaseTouchStart, { passive: false })
    el.addEventListener('selectstart', preventSelect)

    return () => {
      el.removeEventListener('touchstart', captureTouchStart)
      el.removeEventListener('touchend', releaseTouchStart)
      el.removeEventListener('touchcancel', releaseTouchStart)
      el.removeEventListener('selectstart', preventSelect)
    }
  }, [])

  // --- selectionchange 安全网：长按期间清除任何文字选择 ---
  useEffect(() => {
    const onSelectionChange = () => {
      if (longPressTriggeredRef.current) clearSelection()
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [clearSelection])

  // --- 组件卸载时清理定时器 ---
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onTouchCancel,
    onContextMenu,
    ref: elementRef,
    longPressTriggered: longPressTriggeredRef,
    touchPosition: touchPositionRef,
  }
}
