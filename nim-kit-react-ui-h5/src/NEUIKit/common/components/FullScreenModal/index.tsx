import React from 'react'
import classNames from 'classnames'
import Icon from '@/NEUIKit/common/components/Icon'
import './index.less'

export interface FullScreenModalProps {
  visible: boolean
  title: React.ReactNode
  onBack: () => void
  children?: React.ReactNode
  className?: string
  contentClassName?: string
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
  rightContent,
  backAriaLabel = '返回'
}) => {
  if (!visible) return null

  return (
    <div className={classNames('nim-full-screen-modal', className)}>
      <div className="nim-full-screen-modal-nav">
        <button className="nim-full-screen-modal-back" type="button" onClick={onBack} aria-label={backAriaLabel}>
          <Icon type="icon-zuojiantou" size={24} />
        </button>
        <div className="nim-full-screen-modal-title">{title}</div>
        <div className="nim-full-screen-modal-right">{rightContent}</div>
      </div>
      <div className={classNames('nim-full-screen-modal-content', contentClassName)}>{children}</div>
    </div>
  )
}

export default FullScreenModal
