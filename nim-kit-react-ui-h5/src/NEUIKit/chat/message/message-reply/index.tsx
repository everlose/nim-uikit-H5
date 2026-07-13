import React, { useState, useEffect, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import Icon from '@/NEUIKit/common/components/Icon'
import MessageOneLine from '@/NEUIKit/common/components/MessageOneLine'
import MessageText from '@/NEUIKit/chat/message/message-text'
import MessageAudio from '@/NEUIKit/chat/message/message-audio'
import PreviewImage from '@/NEUIKit/common/components/PreviewImage'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { REPLY_MSG_TYPE_MAP } from '@/NEUIKit/common/utils/constants'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { parseMergedForwardPayload, normalizeMergedForwardText } from '@/NEUIKit/chat/message/merged-forward/utils'
import { showToast } from '@/NEUIKit/common/utils/toast'
import MergedForwardModal from '@/NEUIKit/chat/message/merged-forward/modal'
import './index.less'

interface MessageReplyProps {
  replyMsg: V2NIMMessageForUI
}

/**
 * 回复消息组件
 */
const MessageReply: React.FC<MessageReplyProps> = observer(({ replyMsg }) => {
  const { t } = useTranslation()
  const { store } = useStateContext()

  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isPreviewImgVisible, setIsPreviewImgVisible] = useState(false)
  const [repliedTo, setRepliedTo] = useState('')
  const [mergedForwardVisible, setMergedForwardVisible] = useState(false)
  const [mergedForwardMsgs, setMergedForwardMsgs] = useState<V2NIMMessageForUI[]>([])

  // 从附件中获取文件名和下载链接
  //@ts-ignore
  const { name = '', url = '' } = replyMsg?.attachment || {}
  const downloadUrl = url + ((url as string).includes('?') ? '&' : '?') + `download=${name}`

  // 被回复消息是否存在（如果messageClientId为noFind表示消息不存在）
  const isReplyMsgExist = useMemo(() => {
    return replyMsg?.messageClientId !== 'noFind'
  }, [replyMsg?.messageClientId])

  // 图片链接
  const imageUrl = useMemo(() => {
    // 被拉黑
    if (replyMsg.errorCode === 102426) {
      return 'https://yx-web-nosdn.netease.im/common/c1f278b963b18667ecba4ee9a6e68047/img-fail.png'
    }
    //@ts-ignore
    return replyMsg?.attachment?.url || replyMsg.attachment?.file
  }, [replyMsg.attachment, replyMsg.errorCode])

  // 获取被回复人的昵称
  useEffect(() => {
    const nickname = store.uiStore.getAppellation({
      account: replyMsg?.senderId as string,
      teamId: replyMsg?.receiverId
    })
    setRepliedTo(nickname)
  }, [replyMsg?.receiverId, replyMsg?.senderId])

  // 打开合并转发消息
  const openMergedForward = async () => {
    if (mergedForwardMsgs.length) {
      setMergedForwardVisible(true)
      return
    }
    try {
      const payload = parseMergedForwardPayload(replyMsg)
      const url = payload?.data?.url
      if (!url) throw new Error('Merged forward url missing')
      const res = await fetch(url)
      if (!res.ok) throw new Error('Merged forward fetch failed')
      const text = await res.text()
      const list = store.msgStore.deserializeMergeMsgs(normalizeMergedForwardText(text)) as V2NIMMessageForUI[]
      if (!list.length) throw new Error('Merged forward deserialize failed')
      setMergedForwardMsgs(list)
      setMergedForwardVisible(true)
    } catch {
      showToast({
        message: t('getMergedForwardFailedText'),
        type: 'error',
        duration: 1000
      })
    }
  }

  // 显示全屏回复消息
  const showFullReplyMsg = () => {
    if (replyMsg?.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE) {
      setIsFullScreen(true)
      setIsPreviewImgVisible(true)
    } else if (replyMsg?.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT) {
      setIsFullScreen(true)
    } else if (replyMsg?.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO) {
      //@ts-ignore
      const videoUrl = replyMsg?.attachment?.url
      if (videoUrl) {
        window.open(videoUrl, '_blank')
      }
    } else if (replyMsg?.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO) {
      setIsFullScreen(true)
    } else if (replyMsg?.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM) {
      openMergedForward()
    }
  }

  // 关闭全屏回复消息
  const closeFullReplyMsg = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsFullScreen(false)
  }

  if (!replyMsg?.messageClientId) {
    return null
  }

  return (
    <div className="reply-msg-wrapper">
      <div className="reply-msg-container">
        {/* replyMsg 不存在 说明回复的消息被删除或者撤回 */}
        {!isReplyMsgExist ? (
          <div>
            <span>{t('replyNotFindText')}</span>
          </div>
        ) : (
          <div className="reply-msg" onClick={showFullReplyMsg}>
            <div className="reply-msg-name-wrapper">
              <div className="reply-msg-name-line">|</div>
              <div className="reply-msg-name-content">{repliedTo}</div>
              <div className="reply-msg-name-to">:</div>
            </div>

            {replyMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ? (
              <div className="reply-msg-content">
                <MessageOneLine text={replyMsg.text || ''} />
              </div>
            ) : replyMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE ? (
              <div className="other-msg-wrapper">
                <a className="other-msg-wrapper-text" target="_blank" rel="noopener noreferrer" href={downloadUrl} download={name}>
                  {t('fileMsgTitleText')}
                </a>
              </div>
            ) : (
              <div className="other-msg-wrapper other-msg-wrapper-text">{`[${REPLY_MSG_TYPE_MAP[replyMsg.messageType] || '未知类型'}]`}</div>
            )}
          </div>
        )}
      </div>

      {/* 点击被回复的消息需要全屏显示 */}
      {isFullScreen && (
        <div className="reply-full-screen" onClick={showFullReplyMsg}>
          <div className="reply-message-close" onClick={closeFullReplyMsg}>
            <Icon style={{ color: '#929299', fontWeight: '200' }} size={18} type="icon-guanbi" />
          </div>

          {replyMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ? (
            <div className="reply-message-content">
              <MessageText msg={replyMsg} fontSize={22} />
            </div>
          ) : replyMsg?.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO ? (
            <div
              className="msg-common"
              style={{
                flexDirection: replyMsg.isSelf ? 'row-reverse' : 'row',
                backgroundColor: replyMsg.isSelf ? '#d6e5f6' : '#e8eaed',
                borderRadius: replyMsg.isSelf ? '8px 0px 8px 8px' : '0 8px 8px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MessageAudio msg={replyMsg} broadcastNewAudioSrc="" />
            </div>
          ) : replyMsg?.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ? (
            <div
              className="msg-common"
              onClick={(e) => {
                e.stopPropagation()
                setIsFullScreen(false)
              }}
            >
              <PreviewImage visible={isPreviewImgVisible} imageUrl={imageUrl} onClose={() => setIsPreviewImgVisible(false)} />
            </div>
          ) : null}
        </div>
      )}

      {mergedForwardVisible && (
        <MergedForwardModal
          visible={mergedForwardVisible}
          title={`${replyMsg?.text || ''}`}
          msgs={mergedForwardMsgs}
          onClose={() => setMergedForwardVisible(false)}
        />
      )}
    </div>
  )
})

export default MessageReply
