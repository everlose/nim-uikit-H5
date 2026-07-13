import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import classNames from 'classnames'
import Icon from '@/NEUIKit/common/components/Icon'
import emitter from '@/NEUIKit/common/utils/eventBus'
import { events } from '@/NEUIKit/common/utils/constants'
import './index.less'

export interface FullScreenModalProps {
  visible: boolean
  title: React.ReactNode
  onBack: () => void
  children?: React.ReactNode
  className?: string
  contentClassName?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  backAriaLabel?: string
}

const FullScreenModal: React.FC<FullScreenModalProps> = ({
  visible,
  title,
  onBack,
  children,
  className,
  contentClassName,
  leftContent,
  rightContent,
  backAriaLabel = '返回'
}) => {
  // 打开全屏页面时停止语音播放
  useEffect(() => {
    if (visible) {
      emitter.emit(events.AUDIO_STOP_ALL)
    }
  }, [visible])

  if (!visible) return null

  return createPortal(
    <div className={classNames('nim-full-screen-modal', className)}>
      <div className="nim-full-screen-modal-nav">
        {leftContent ? (
          <button className="nim-full-screen-modal-left" type="button" onClick={onBack} aria-label={backAriaLabel}>
            {leftContent}
          </button>
        ) : (
          <button className="nim-full-screen-modal-back" type="button" onClick={onBack} aria-label={backAriaLabel}>
            <Icon type="icon-zuojiantou" size={24} />
          </button>
        )}
        <div className="nim-full-screen-modal-title">{title}</div>
        <div className="nim-full-screen-modal-right">{rightContent}</div>
      </div>
      <div className={classNames('nim-full-screen-modal-content', contentClassName)}>{children}</div>
    </div>,
    document.body
  )
}

export default FullScreenModal
