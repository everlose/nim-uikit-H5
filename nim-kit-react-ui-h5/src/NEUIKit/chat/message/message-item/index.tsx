import React, { useState, useMemo, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import Avatar from '@/NEUIKit/common/components/Avatar'
import MessageBubble from '@/NEUIKit/chat/message/message-bubble'
import MessageFile from '@/NEUIKit/chat/message/message-file'
import MessageText from '@/NEUIKit/chat/message/message-text'
import MessageAudio from '@/NEUIKit/chat/message/message-audio'
import MessageNotification from '@/NEUIKit/chat/message/message-notification'
import MessageG2 from '@/NEUIKit/chat/message/message-g2'
import MessageRead from '@/NEUIKit/chat/message/message-read'
import ReplyMessage from '@/NEUIKit/chat/message/message-reply'
import MergedForwardCard from '@/NEUIKit/chat/message/merged-forward/card'
import Icon from '@/NEUIKit/common/components/Icon'
import PreviewImage from '@/NEUIKit/common/components/PreviewImage'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { events, MSG_ID_FLAG } from '@/NEUIKit/common/utils/constants'
import emitter from '@/NEUIKit/common/utils/eventBus'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { getPinOperatorId, isMessagePinned } from '@/NEUIKit/chat/message-pin/utils'
import { isSelectableMessage } from '@/NEUIKit/chat/message/message-multi-select/utils'
import { isMergedForwardMsg } from '@/NEUIKit/chat/message/merged-forward/utils'
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from '@/NEUIKit/common/utils/image'
import './index.less'

interface MessageItemProps {
  msg: V2NIMMessageForUI & { timeValue?: number }
  index: number
  replyMsgsMap?: {
    [key: string]: V2NIMMessageForUI
  }
  broadcastNewAudioSrc: string
  /**
   * 语音转文字结果映射
   */
  voiceTextMap?: Map<string, string>
  /**
   * 设置语音转文字结果
   */
  setVoiceText?: (messageClientId: string, text: string) => void
  isMultiSelecting?: boolean
  selected?: boolean
  onToggleSelect?: (msg: V2NIMMessageForUI) => void
  onMultiSelect?: (msg: V2NIMMessageForUI) => void
  readonly?: boolean
}

/**
 * 消息项组件，根据不同的消息类型展示不同的消息内容
 */
const MessageItem: React.FC<MessageItemProps> = observer(({ msg, index, replyMsgsMap = {}, broadcastNewAudioSrc, voiceTextMap = new Map(), setVoiceText, isMultiSelecting = false, selected = false, onToggleSelect, onMultiSelect, readonly = false }) => {
  const { t } = useTranslation()
  const { store, nim, locale } = useStateContext()

  // 图片预览状态
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)

  // 回复消息
  const replyMsg = useMemo(() => {
    return replyMsgsMap && replyMsgsMap[msg.messageClientId]
  }, [msg.messageClientId, replyMsgsMap])

  const canParseConversationId = !readonly && !!msg.conversationId

  // 会话类型
  const conversationType = readonly
    ? (msg.conversationType as unknown as V2NIMConst.V2NIMConversationType)
    : (nim.V2NIMConversationIdUtil.parseConversationType(msg.conversationId) as unknown as V2NIMConst.V2NIMConversationType)

  // 会话对象
  const to = canParseConversationId ? nim.V2NIMConversationIdUtil.parseConversationTargetId(msg.conversationId) : ''

  // 昵称展示顺序 群昵称 > 备注 > 个人昵称 > 帐号
  const appellation = store.uiStore.getAppellation({
    account: msg.senderId,
    teamId: conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ? to : ''
  })

  const mergedForwardSenderInfo = useMemo(() => {
    let serverExtension: Record<string, string> = {}

    try {
      serverExtension = JSON.parse(msg.serverExtension || '{}')
    } catch {
      serverExtension = {}
    }

    return {
      nick: serverExtension.mergedMessageNickKey || (msg as any).fromNick || msg.senderId,
      avatar: serverExtension.mergedMessageAvatarKey || ''
    }
  }, [msg.serverExtension, msg.senderId, (msg as any).fromNick])

  const senderName = readonly ? mergedForwardSenderInfo.nick : appellation
  const senderAvatar = readonly ? mergedForwardSenderInfo.avatar : ''
  const showSenderName = readonly || !msg.isSelf
  const readonlyAudioText = t('audioMsgText')
  const readonlyCallText = (msg.attachment as any)?.type == 1 ? t('voiceCallText') : t('videoCallText')
  const canAitSender =
    !readonly &&
    !msg.isSelf &&
    conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM

  const pinInfoMap = store.msgStore.pinMsgs.map.get(msg.conversationId)
  const pinOperatorId = getPinOperatorId(msg, pinInfoMap)
  const pinOperatorName = pinOperatorId
    ? store.uiStore.getAppellation({
        account: pinOperatorId,
        teamId: conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ? to : ''
      })
    : ''
  const pinTipName = pinOperatorId === store.userStore.myUserInfo?.accountId ? t('you') : pinOperatorName || pinOperatorId

  // 群ID
  const teamId = useMemo(() => {
    if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
      return to
    }
    return ''
  }, [conversationType, to])

  const handleAvatarLongpress = () => {
    if (!canAitSender) return

    emitter.emit(events.AIT_TEAM_MEMBER, {
      accountId: msg.senderId,
      appellation: store.uiStore.getAppellation({
        account: msg.senderId,
        teamId,
        ignoreAlias: true
      })
    })
  }

  const senderAvatarNode = (
    <Avatar
      account={msg.senderId}
      teamId={teamId}
      avatar={senderAvatar}
      nickFromMsg={senderName}
      gotoUserCard={!readonly}
      onLongpress={handleAvatarLongpress}
    />
  )

  // 获取视频首帧
  const videoFirstFrameDataUrl = useMemo(() => {
    //@ts-ignore
    const url = msg.attachment?.url
    return url ? `${url}${url.includes('?') ? '&' : '?'}vframe=1` : ''
  }, [msg.attachment])

  // 图片URL
  const imageUrl = useMemo(() => {
    if (!(msg && msg.attachment)) {
      return ''
    }
    // 被拉黑
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
    return getImageRenderStyle(width, height, 'chat')
  }, [msg.attachment])

  // 点击图片预览
  const handleImageTouch = (url: string) => {
    if (url) {
      setIsPreviewVisible(true)
    }
  }

  // 点击视频播放
  const handleVideoTouch = (msg: V2NIMMessageForUI) => {
    //@ts-ignore
    const url = msg.attachment?.url
    if (url) {
      // 在新窗口打开视频
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  // 重新编辑消息
  const handleReeditMsg = (msg: V2NIMMessageForUI) => {
    emitter.emit(events.ON_REEDIT_MSG, msg)
  }

  // 消息置顶类判断
  const isPinned = isMessagePinned(msg) && !(msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM && msg.timeValue !== undefined) && !msg.recallType
  const isEnglish = locale === 'en'
  const pinTip = isEnglish ? `${t('pinThisText')} ${pinTipName}` : `${pinTipName}${t('pinThisText')}`
  const pinTipNode = isPinned ? (
    <div className={msg.isSelf ? 'msg-pin-tip msg-pin-tip-self' : 'msg-pin-tip'}>
      <Icon type="icon-green-pin" size={12} />
      <span className="msg-pin-tip-text">{pinTip}</span>
    </div>
  ) : null
  const selectable = isSelectableMessage(msg)
  const bubbleMultiSelectProps = selectable && !readonly ? {
    isMultiSelecting,
    onMultiSelect
  } : {}
  const handleMultiSelectItemClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMultiSelecting || !selectable) return
    event.preventDefault()
    event.stopPropagation()
    onToggleSelect?.(msg)
  }

  return (
    <div
      className={`msg-item-wrapper ${isPinned ? 'msg-pin' : ''} ${isMultiSelecting ? 'msg-item-multi-selecting' : ''} ${isMultiSelecting && selectable ? 'msg-item-selectable' : ''}`}
      id={MSG_ID_FLAG + msg.messageClientId}
      key={msg.createTime}
      onClickCapture={handleMultiSelectItemClick}
    >
      {isMultiSelecting && selectable && !readonly && (
        <div className="msg-select-column">
          <div className={`msg-select-box ${selected ? 'selected' : ''}`}>{selected && <span className="msg-select-check">✓</span>}</div>
        </div>
      )}
      {/* 消息时间间隔提示 */}
      {msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM && msg.timeValue !== undefined ? (
        <div className="msg-time">{msg.timeValue}</div>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM && msg.recallType === 'reCallMsg' && msg.canEdit ? (
        /* 撤回消息-可重新编辑 */
        <div
          className="msg-common"
          style={{
            flexDirection: !msg.isSelf ? 'row' : 'row-reverse'
          }}
        >
          {senderAvatarNode}
          <MessageBubble msg={msg} bgVisible={true} readonly={readonly} {...bubbleMultiSelectProps}>
            <span className="recall-text">{t('recall2')}</span>
            <span className="msg-recall-btn" onClick={() => handleReeditMsg(msg)}>
              {t('reeditText')}
            </span>
          </MessageBubble>
        </div>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM && msg.recallType === 'reCallMsg' && !msg.canEdit ? (
        /* 撤回消息-不可重新编辑 */
        <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
          {senderAvatarNode}
          <MessageBubble msg={msg} bgVisible={true} readonly={readonly} {...bubbleMultiSelectProps}>
            <div className="recall-text">{t('you') + t('recall')}</div>
          </MessageBubble>
        </div>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM && msg.recallType === 'beReCallMsg' ? (
        /* 撤回消息-对方撤回 */
        <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
          {senderAvatarNode}
          <div className="msg-content">
            {showSenderName && <div className="msg-name">{senderName}</div>}
            <div className={msg.isSelf ? 'self-msg-recall' : 'msg-recall'}>
              <span className="msg-recall2">{!msg.isSelf ? t('recall2') : `${t('you') + t('recall')}`}</span>
            </div>
          </div>
        </div>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ? (
        /* 文本消息 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={true} readonly={readonly} {...bubbleMultiSelectProps}>
                {!!replyMsg && <ReplyMessage replyMsg={replyMsg} />}
                <MessageText msg={msg} disableAit={readonly} />
              </MessageBubble>
            </div>
            {msg?.isSelf && !readonly && <MessageRead msg={msg} />}
          </div>
          {pinTipNode}
        </>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ? (
        /* 图片消息 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={true} readonly={readonly} {...bubbleMultiSelectProps}>
                <div onClick={() => handleImageTouch(imageUrl)}>
                  {msg.sendingState === V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING ? (
                    <div className="msg-image" style={imageRenderStyle}>
                      <div className="loading-spinner"></div>
                    </div>
                  ) : (
                    <img className="msg-image" style={imageRenderStyle} loading="lazy" src={thumbnail} alt="图片" />
                  )}
                </div>
              </MessageBubble>
              {/* 图片预览 */}
              {isPreviewVisible && <PreviewImage visible={isPreviewVisible} imageUrl={imageUrl} onClose={() => setIsPreviewVisible(false)} />}
            </div>
            {msg?.isSelf && !readonly && <MessageRead msg={msg} />}
          </div>
          {pinTipNode}
        </>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO ? (
        /* 视频消息 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={true} readonly={readonly} {...bubbleMultiSelectProps}>
                <div className="video-msg-wrapper" onClick={() => handleVideoTouch(msg)}>
                  <div className="video-play-button">
                    <div className="video-play-icon"></div>
                  </div>
                  <img className="msg-image" style={imageRenderStyle} loading="lazy" src={videoFirstFrameDataUrl} alt="视频封面" />
                </div>
              </MessageBubble>
            </div>
            {msg?.isSelf && !readonly && <MessageRead msg={msg} />}
          </div>
          {pinTipNode}
        </>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL ? (
        /* 音视频通话消息 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={true} readonly={readonly} {...bubbleMultiSelectProps}>
                {readonly ? `[${readonlyCallText}]` : <MessageG2 msg={msg} />}
              </MessageBubble>
            </div>
          </div>
          {pinTipNode}
        </>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE ? (
        /* 文件消息 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={false} readonly={readonly} {...bubbleMultiSelectProps}>
                <MessageFile msg={msg} />
              </MessageBubble>
            </div>
            {msg?.isSelf && !readonly && <MessageRead msg={msg} />}
          </div>
          {pinTipNode}
        </>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO ? (
        /* 语音消息 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={true} voiceTextMap={voiceTextMap} setVoiceText={setVoiceText} readonly={readonly} {...bubbleMultiSelectProps}>
                {readonly ? `[${readonlyAudioText}]` : <MessageAudio msg={msg} broadcastNewAudioSrc={broadcastNewAudioSrc} voiceText={voiceTextMap.get(msg.messageClientId as string)} />}
              </MessageBubble>
            </div>
            {msg?.isSelf && !readonly && <MessageRead msg={msg} />}
          </div>
          {pinTipNode}
        </>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM && isMergedForwardMsg(store, msg) ? (
        /* 合并转发消息 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={false} readonly={readonly} {...bubbleMultiSelectProps}>
                <MergedForwardCard msg={msg} />
              </MessageBubble>
            </div>
            {msg?.isSelf && !readonly && <MessageRead msg={msg} />}
          </div>
          {pinTipNode}
        </>
      ) : msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION ? (
        /* 通知消息 */
        <MessageNotification msg={msg} />
      ) : (
        /* 未知消息类型 */
        <>
          <div className="msg-common" style={{ flexDirection: !msg.isSelf ? 'row' : 'row-reverse' }}>
            {senderAvatarNode}
            <div className="msg-content">
              {showSenderName && <div className="msg-name">{senderName}</div>}
              <MessageBubble msg={msg} tooltipVisible={true} bgVisible={true} readonly={readonly} {...bubbleMultiSelectProps}>
                [{t('unknowMsgText')}]
              </MessageBubble>
            </div>
          </div>
          {pinTipNode}
        </>
      )}
    </div>
  )
})

export default MessageItem
