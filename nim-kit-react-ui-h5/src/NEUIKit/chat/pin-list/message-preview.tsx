import React, { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import PreviewImage from '@/NEUIKit/common/components/PreviewImage'
import PreviewText from '@/NEUIKit/common/components/PreviewText'
import MessageText from '@/NEUIKit/chat/message/message-text'
import MessageAudio from '@/NEUIKit/chat/message/message-audio'
import MessageFile from '@/NEUIKit/chat/message/message-file'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from '@/NEUIKit/common/utils/image'

interface PinMessagePreviewProps {
  msg: V2NIMMessageForUI
}

const PinMessagePreview: React.FC<PinMessagePreviewProps> = observer(({ msg }) => {
  const { t } = useTranslation()
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)

  const imageUrl = useMemo(() => {
    if (!msg.attachment) return ''
    if (msg.messageStatus?.errorCode === 102426) {
      return 'https://yx-web-nosdn.netease.im/common/c1f278b963b18667ecba4ee9a6e68047/img-fail.png'
    }
    if ('url' in msg.attachment) return msg.attachment.url
    if ('file' in msg.attachment) return URL.createObjectURL(msg.attachment.file as File)
    return ''
  }, [msg.attachment, msg.messageStatus?.errorCode])

  const thumbnail = useMemo(() => {
    const { width, height } = getImageAttachmentSize(msg.attachment)
    return getImageThumbUrl(imageUrl, width, height)
  }, [imageUrl, msg.attachment])

  const imageRenderStyle = useMemo(() => {
    const { width, height } = getImageAttachmentSize(msg.attachment)
    return getImageRenderStyle(width, height, 'compact')
  }, [msg.attachment])

  const videoFirstFrameDataUrl = useMemo(() => {
    const url = (msg.attachment as any)?.url
    return url ? `${url}${url.includes('?') ? '&' : '?'}vframe=1` : ''
  }, [msg.attachment])

  const handleVideoTouch = () => {
    const url = (msg.attachment as any)?.url
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleTextPreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('a')) return
    setIsPreviewVisible(true)
  }

  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT) {
    return (
      <>
        <div className="pin-message-preview pin-message-preview-text" onClick={handleTextPreviewClick}>
          <MessageText msg={msg} />
        </div>
        <PreviewText visible={isPreviewVisible} msg={msg} onClose={() => setIsPreviewVisible(false)} />
      </>
    )
  }

  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE) {
    return (
      <>
        <img className="pin-message-image" style={imageRenderStyle} loading="lazy" src={thumbnail} alt="图片" onClick={() => imageUrl && setIsPreviewVisible(true)} />
        {isPreviewVisible && <PreviewImage visible={isPreviewVisible} imageUrl={imageUrl} onClose={() => setIsPreviewVisible(false)} />}
      </>
    )
  }

  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO) {
    return (
      <div className="pin-message-preview-audio">
        <MessageAudio msg={msg} mode="audio-in" />
      </div>
    )
  }

  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO) {
    return (
      <div className="pin-video-msg-wrapper" onClick={handleVideoTouch}>
        <div className="pin-video-play-button">
          <div className="pin-video-play-icon"></div>
        </div>
        <img className="pin-message-image" style={imageRenderStyle} loading="lazy" src={videoFirstFrameDataUrl} alt="视频封面" />
      </div>
    )
  }

  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE) {
    return (
      <div className="pin-message-preview-file">
        <MessageFile msg={msg} />
      </div>
    )
  }

  return <div className="pin-message-preview">[{t('unknowMsgText')}]</div>
})

export default PinMessagePreview
