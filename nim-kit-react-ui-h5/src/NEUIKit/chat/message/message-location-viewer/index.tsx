import React from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/NEUIKit/common/components/Icon'
import MessageLocation from '@/NEUIKit/chat/message/message-location'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import './index.less'

interface MessageLocationViewerProps {
  msg: V2NIMMessageForUI
  onClose: () => void
}

/**
 * 地理位置消息全屏查看。
 *
 * H5 不接入高德等付费三方地图 SDK，这里只展示占位图 + 地理标题 + 详细地址。
 * 回复消息里被引用的地理位置与消息气泡里的地理位置共用该组件，保证两处表现一致。
 */
const MessageLocationViewer: React.FC<MessageLocationViewerProps> = ({ msg, onClose }) => {
  return createPortal(
    <div className="msg-location-viewer" onClick={onClose}>
      <div className="msg-location-viewer-close" onClick={onClose}>
        <Icon style={{ color: '#929299', fontWeight: '200' }} size={18} type="icon-guanbi" />
      </div>
      <div className="msg-location-viewer-card" onClick={(e) => e.stopPropagation()}>
        <MessageLocation msg={msg} fullScreen />
      </div>
    </div>,
    document.body
  )
}

export default MessageLocationViewer
