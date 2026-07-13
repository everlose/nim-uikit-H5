import React, { useEffect } from 'react'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import MessageText from '@/NEUIKit/chat/message/message-text'
import './index.less'

export interface PreviewTextProps {
  visible: boolean
  msg?: V2NIMMessageForUI
  onClose?: () => void
}

const PreviewText: React.FC<PreviewTextProps> = ({ visible, msg, onClose }) => {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  if (!visible || !msg) return null

  return (
    <div className="text-preview-mask" onClick={onClose}>
      <div className="text-preview-body" onClick={(e) => e.stopPropagation()}>
        <div className="text-preview-content">
          <MessageText msg={msg} />
        </div>
      </div>
    </div>
  )
}

export default PreviewText
