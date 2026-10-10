import React, { useMemo } from 'react'
import locationPlaceholder from '@/NEUIKit/static/location-default.png'
import { normalizeLocationMessage } from './utils'
import './index.less'

interface MessageLocationProps {
  msg: any
  isSelf?: boolean
  /**
   * 点击查看地理位置的入口。不传时卡片不可点击（例如置顶列表、收藏页里的消息预览）
   */
  onViewLocation?: () => void
  /**
   * 全屏查看时的排版：放宽宽度，地理标题与详细地址完整展示不截断
   */
  fullScreen?: boolean
}

const MessageLocation: React.FC<MessageLocationProps> = ({ msg, isSelf = false, onViewLocation, fullScreen = false }) => {
  const location = useMemo(() => normalizeLocationMessage(msg.text, msg.attachment), [msg.text, msg.attachment])

  const rootClassName = [
    'message-location',
    isSelf ? 'message-location-out' : 'message-location-in',
    fullScreen ? 'message-location-full' : '',
    onViewLocation ? 'message-location-clickable' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClassName} onClick={onViewLocation}>
      {location.title && <div className="message-location-title">{location.title}</div>}
      {location.address && <div className="message-location-address">{location.address}</div>}
      <div
        className="message-location-map"
        style={{ backgroundImage: `url(${locationPlaceholder})` }}
        aria-hidden="true"
      />
    </div>
  )
}

export default MessageLocation
