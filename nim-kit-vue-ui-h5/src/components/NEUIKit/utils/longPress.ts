/**
 * 长按混入（Vue Options API）
 *
 * 使用方式：
 * 1. 在组件中 mixins: [longPressMixin]
 * 2. 在 data() 中定义 longPressOptions 配置
 * 3. 在 mounted() 中调用 this._lpInit(this.$refs.targetElement)
 * 4. 模板中绑定事件处理器：
 *    @touchstart="_lpTouchStart"
 *    @touchend="_lpTouchEnd"
 *    @touchmove="_lpTouchMove"
 *    @touchcancel="_lpTouchCancel"
 *    @contextmenu.prevent="_lpContextMenu"
 * 5. 全局 click handler 中检查 this._lpActive 以抑制 Android post-touchend click
 */

export interface LongPressOptions {
  /** 长按触发回调 */
  onLongPress: () => void
  /** 长按时长（ms），默认 500 */
  duration?: number
  /** 手指移动超过此距离（px）则取消长按，默认 30 */
  moveThreshold?: number
  /** 禁用长按 */
  disabled?: boolean
}

export const longPressMixin = {
  data() {
    return {
      _lpTimer: null as ReturnType<typeof setTimeout> | null,
      _lpStartPosition: null as { x: number; y: number } | null,
      _lpStartEvent: null as TouchEvent | null,
      /** 长按触发后 ~500ms 内为 true，用于抑制 Android post-touchend click */
      _lpActive: false,
      _lpElement: null as HTMLElement | null,
    }
  },

  methods: {
    /**
     * 初始化长按监听。在 mounted() 中调用一次。
     * @param el 需要监听长按的 DOM 元素
     */
    _lpInit(this: any, el: HTMLElement | null) {
      if (!el) return
      this._lpElement = el

      // 原生 touchstart 监听（必须 passive: false 才能 preventDefault 阻止 iOS callout）
      this.__lpNativeTouchStart = (e: TouchEvent) => {
        this._lpStartEvent = e
      }
      this.__lpNativeTouchEnd = (e: TouchEvent) => {
        if (this._lpActive) {
          e.preventDefault()
        }
        this._lpStartEvent = null
      }
      this.__lpNativeTouchCancel = (e: TouchEvent) => {
        if (this._lpActive) {
          e.preventDefault()
        }
        this._lpStartEvent = null
      }
      el.addEventListener('touchstart', this.__lpNativeTouchStart, { passive: false })
      el.addEventListener('touchend', this.__lpNativeTouchEnd, { passive: false })
      el.addEventListener('touchcancel', this.__lpNativeTouchCancel, { passive: false })

      // 阻止文字选择（iOS callout 防护）
      this.__lpPreventSelect = (e: Event) => {
        e.preventDefault()
      }
      el.addEventListener('selectstart', this.__lpPreventSelect)

      // selectionchange 安全网
      this.__lpSelectionHandler = () => {
        if (this._lpActive) this._lpClearSelection()
      }
      document.addEventListener('selectionchange', this.__lpSelectionHandler)
    },

    /** 获取长按配置 */
    _lpConfig(this: any): LongPressOptions {
      return this.longPressOptions || {}
    },

    _lpTouchStart(this: any, e: TouchEvent) {
      const cfg = this._lpConfig()
      if (cfg.disabled) return
      const touch = e.touches[0]
      if (!touch) return
      this._lpStartPosition = { x: touch.clientX, y: touch.clientY }
      clearTimeout(this._lpTimer)
      this._lpTimer = setTimeout(() => {
        // 阻止 iOS 原生长按效果
        if (this._lpStartEvent) this._lpStartEvent.preventDefault()
        this._lpClearSelection()
        this._lpActive = true
        setTimeout(() => {
          this._lpActive = false
        }, 500)
        const cb = cfg.onLongPress
        if (typeof cb === 'function') cb()
      }, cfg.duration || 500)
    },

    _lpTouchEnd(this: any, e: TouchEvent) {
      if (this._lpActive) {
        e.preventDefault()
        e.stopPropagation()
      }
      clearTimeout(this._lpTimer)
      this._lpTimer = null
    },

    _lpTouchMove(this: any, e: TouchEvent) {
      if (!this._lpTimer || !this._lpStartPosition) return
      const touch = e.touches[0]
      if (!touch) {
        clearTimeout(this._lpTimer)
        this._lpTimer = null
        return
      }
      const cfg = this._lpConfig()
      const threshold = cfg.moveThreshold ?? 30
      const dx = touch.clientX - this._lpStartPosition.x
      const dy = touch.clientY - this._lpStartPosition.y
      if (Math.sqrt(dx * dx + dy * dy) > threshold) {
        clearTimeout(this._lpTimer)
        this._lpTimer = null
      }
    },

    _lpTouchCancel(this: any, e: TouchEvent) {
      if (this._lpActive) {
        e.preventDefault()
        e.stopPropagation()
      }
      this._lpStartEvent = null
      clearTimeout(this._lpTimer)
      this._lpTimer = null
    },

    _lpContextMenu(this: any, e: Event) {
      const cfg = this._lpConfig()
      if (cfg.disabled) return
      e.preventDefault()
      // 阻止 iOS 原生长按效果
      if (this._lpStartEvent) this._lpStartEvent.preventDefault()
      // Android：长按定时器可能已触发，contextmenu 后到则忽略
      if (this._lpActive) return
      clearTimeout(this._lpTimer)
      this._lpTimer = null
      this._lpClearSelection()
      this._lpActive = true
      setTimeout(() => {
        this._lpActive = false
      }, 500)
      const cb = cfg.onLongPress
      if (typeof cb === 'function') cb()
    },

    _lpClearSelection(this: any) {
      try {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) sel.removeAllRanges()
      } catch (_) { /* ignore */ }
    },
  },

  beforeUnmount(this: any) {
    clearTimeout(this._lpTimer)
    const el = this._lpElement
    if (el) {
      if (this.__lpNativeTouchStart) el.removeEventListener('touchstart', this.__lpNativeTouchStart)
      if (this.__lpNativeTouchEnd) el.removeEventListener('touchend', this.__lpNativeTouchEnd)
      if (this.__lpNativeTouchCancel) el.removeEventListener('touchcancel', this.__lpNativeTouchCancel)
      if (this.__lpPreventSelect) el.removeEventListener('selectstart', this.__lpPreventSelect)
    }
    if (this.__lpSelectionHandler) {
      document.removeEventListener('selectionchange', this.__lpSelectionHandler)
    }
  },
}
