import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import './index.less'

export interface TooltipProps {
  /**
   * 内容
   */
  content?: React.ReactNode
  /**
   * 背景颜色
   * @default "#303133"
   */
  color?: string
  /**
   * 是否可见
   * @default false
   */
  visible?: boolean
  /**
   * 是否对齐
   * @default false
   */
  align?: boolean
  /**
   * 可见性变化回调
   */
  onVisibleChange?: (visible: boolean) => void
  /**
   * 子元素
   */
  children?: React.ReactNode
}

/**
 * Tooltip 组件对外暴露的方法
 */
export interface TooltipRef {
  close: () => void
}

/**
 * 工具提示组件
 */
const Tooltip = forwardRef<TooltipRef, TooltipProps>(({ content, color = '#303133', visible: propVisible = false, align = false, onVisibleChange, children }, ref) => {
  // 状态
  const [isShow, setIsShow] = useState(propVisible)
  const [popperRendered, setPopperRendered] = useState(propVisible)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top')

  // 引用
  const contentRef = useRef<HTMLDivElement>(null)
  const popperRef = useRef<HTMLDivElement>(null)
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartPositionRef = useRef<{ x: number; y: number } | null>(null)

  // 暴露 close 方法给外部使用
  useImperativeHandle(ref, () => ({
    close: () => {
      setIsShow(false)
      setPopperRendered(false)
    }
  }))

  // 同步外部visible属性
  useEffect(() => {
    setPopperRendered(propVisible)
    setIsShow(propVisible)
  }, [propVisible])

  // 通知外部isShow变化
  useEffect(() => {
    onVisibleChange?.(isShow)
  }, [isShow, onVisibleChange])

  // 添加全局点击监听
  useEffect(() => {
    const handleGlobalClick = () => {
      setIsShow(false)
      setPopperRendered(false)
    }

    window.addEventListener('click', handleGlobalClick)

    return () => {
      window.removeEventListener('click', handleGlobalClick)
    }
  }, [])

  // 计算tooltip位置
  const getPosition = () => {
    return new Promise<boolean>((resolve) => {
      const tooltipContent = contentRef.current
      const tooltipPopper = popperRef.current

      if (!tooltipContent || !tooltipPopper) {
        resolve(false)
        return
      }

      if (tooltipContent && tooltipPopper) {
        const popperRect = tooltipPopper.getBoundingClientRect()
        const contentRect = tooltipContent.getBoundingClientRect()
        const windowWidth = window.innerWidth
        const windowHeight = window.innerHeight
        const margin = 10
        const gap = 8
        const touchPoint = touchStartPositionRef.current
        const anchorX = touchPoint?.x || contentRect.left + contentRect.width / 2
        const anchorY = touchPoint?.y || contentRect.top + contentRect.height / 2
        const popperWidth = popperRect.width
        const popperHeight = popperRect.height
        const hasEnoughSpaceAbove = anchorY - popperHeight - gap >= margin
        const hasEnoughSpaceBelow = anchorY + popperHeight + gap <= windowHeight - margin
        let newStyle: React.CSSProperties = {}

        if (!hasEnoughSpaceAbove && hasEnoughSpaceBelow) {
          setPlacement('bottom')
        } else {
          setPlacement('top')
        }

        if (hasEnoughSpaceAbove || !hasEnoughSpaceBelow) {
          newStyle.top = `${Math.max(margin, anchorY - popperHeight - gap)}px`
        } else {
          newStyle.top = `${Math.min(windowHeight - popperHeight - margin, anchorY + gap)}px`
        }
        newStyle.left = `${Math.min(windowWidth - popperWidth - margin, Math.max(margin, anchorX - popperWidth / 2))}px`

        setStyle(newStyle)
        resolve(true)
      }
    })
  }

  // 处理点击
  const handleClick = async () => {
    if (isShow) {
      setPopperRendered(false)
      return setIsShow(false)
    }
    setPopperRendered(true)
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
    const positioned = await getPosition()
    if (!positioned) {
      setPopperRendered(false)
      return
    }
    setIsShow(true)
  }

  // 触摸处理函数
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartPositionRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }

    touchTimerRef.current = setTimeout(() => {
      // 检查是否移动了太多
      const currentX = e.touches[0].clientX
      const currentY = e.touches[0].clientY
      const startPos = touchStartPositionRef.current

      if (startPos) {
        const moveDistance = Math.sqrt(Math.pow(currentX - startPos.x, 2) + Math.pow(currentY - startPos.y, 2))

        if (moveDistance < 10) {
          // 允许少量移动
          handleClick()
        }
      }
    }, 500) // 长按时间阈值：500ms
  }

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
    }
  }

  const handleTouchMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
    }
  }

  const close = (e: React.TouchEvent) => {
    e.stopPropagation()
    setIsShow(false)
    setPopperRendered(false)
  }

  // 阻止冒泡
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // 自定义样式
  const tooltipStyle = {
    '--theme-bg-color': color
  } as React.CSSProperties

  const popperStyle: React.CSSProperties = {
    ...style,
    visibility: isShow ? 'visible' : 'hidden',
    color: color === 'white' ? '' : '#fff',
    boxShadow: color === 'white' ? '0 3px 6px -4px #0000001f, 0 6px 16px #00000014, 0 9px 28px 8px #0000000d' : '',
    backgroundColor: color
  }

  return (
    <div className="nim-tooltip" style={tooltipStyle}>
      <div ref={contentRef} className="nim-tooltip-content" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove}>
        {children}

        {isShow && <div className="nim-tooltip-mask" onTouchStart={close}></div>}

        {popperRendered && (
          <div ref={popperRef} className="nim-tooltip-popper" onClick={stopPropagation} style={popperStyle}>
            {content}
          </div>
        )}
      </div>
    </div>
  )
})

export default Tooltip
