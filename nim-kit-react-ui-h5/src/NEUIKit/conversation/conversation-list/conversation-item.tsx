import React, { useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import dayjs from 'dayjs'
import Avatar from '@/NEUIKit/common/components/Avatar'
import AvatarWithStatus from '@/NEUIKit/common/components/AvatarWithStatus'
import Appellation from '@/NEUIKit/common/components/Appellation'
import Icon from '@/NEUIKit/common/components/Icon'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMConversationForUI, V2NIMLocalConversationForUI, V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import ConversationItemRead from './conversation-item-read'
import LastMsgContent from './conversation-item-last-msg-content'
import './conversation-item.less'

interface ConversationItemProps {
  conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI
  showMoreActions?: boolean
  onClick?: (conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI) => void
  onDelete?: (conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI) => void
  onStickyToTop?: (conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI) => void
  onLeftSlide?: (conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI | null) => void
}

/**
 * 会话列表项组件
 */
const ConversationItem: React.FC<ConversationItemProps> = observer(
  ({ conversation, showMoreActions = false, onClick, onDelete, onStickyToTop, onLeftSlide }) => {
    const { t } = useTranslation()
    const { store } = useStateContext()

    // 滑动阈值 & 触摸相关 refs
    const SWIPE_THRESHOLD = 60
    const containerRef = useRef<HTMLDivElement>(null)
    const startXRef = useRef(0)
    const startYRef = useRef(0)
    const swipeTriggeredRef = useRef(false)
    const onLeftSlideRef = useRef(onLeftSlide)
    onLeftSlideRef.current = onLeftSlide
    const conversationRef = useRef(conversation)
    conversationRef.current = conversation

    // 更多操作按钮
    const moreActions = [
      {
        name: conversation.stickTop ? t('deleteStickTopText') : t('addStickTopText'),
        class: 'action-top',
        type: 'action-top'
      },
      {
        name: t('deleteSessionText'),
        class: 'action-delete',
        type: 'action-delete'
      }
    ]

    // 处理操作按钮点击
    const handleActionClick = (type: string, e: React.MouseEvent) => {
      e.stopPropagation()

      if (type === 'action-top') {
        onStickyToTop?.(conversation)
      } else {
        onDelete?.(conversation)
      }
    }

    // 获取会话目标ID
    const to = store.nim.V2NIMConversationIdUtil.parseConversationTargetId(conversation.conversationId)

    // 获取群头像
    const teamAvatar = conversation.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ? conversation.avatar : undefined

    // 获取会话名称
    const sessionName = conversation.name || conversation.conversationId

    // 格式化时间
    const formatDate = (): string => {
      const time = conversation.lastMessage?.messageRefer.createTime || conversation.updateTime

      if (!time) {
        return ''
      }

      const _d = dayjs(time)
      const isCurrentDay = _d.isSame(dayjs(), 'day')
      const isCurrentYear = _d.isSame(dayjs(), 'year')

      if (isCurrentDay) {
        return _d.format('HH:mm')
      }
      if (isCurrentYear) {
        return _d.format(t('timeFormatSameYear'))
      }
      return _d.format(t('timeFormatDiffYear'))
    }

    // 未读数量显示格式化
    const max = 99
    const unread = conversation.unreadCount > 0 ? (conversation.unreadCount > max ? `${max}+` : `${conversation.unreadCount}`) : ''

    // 是否静音
    const isMute = !!conversation.mute

    // 是否有@消息
    // 1. 没有未读消息时，不显示@提示
    // 2. 如果 aitMsgs 有值，从本地内存查找这些消息，对比 createTime 与 lastReadTime 判断是否真正未读
    // 3. 如果本地内存中找不到（如页面刷新），fallback 到 lastMessage.serverExtension 检测
    const beMentioned = (() => {
      if (conversation.unreadCount === 0) {
        return false
      }

      if (conversation.aitMsgs?.length) {
        // 从本地内存查找这些@消息
        const aitMessages = store.msgStore?.getMsg(conversation.conversationId, conversation.aitMsgs)
        if (aitMessages && aitMessages.length > 0) {
          // 找到了@消息，检查是否有消息时间 > 已读时间（即真正未读的@消息）
          const lastReadTime = (conversation as V2NIMConversationForUI).lastReadTime ?? 0
          return aitMessages.some((msg: V2NIMMessageForUI) => msg.createTime > lastReadTime)
        }
        // 本地内存中没找到消息（如页面刷新后消息未加载），fallback 到 lastMessage 检测
      }

      // fallback: 检查最后一条消息的 serverExtension 是否@了当前用户
      const lastMsg = conversation.lastMessage
      if (!lastMsg?.serverExtension) {
        return false
      }

      try {
        const ext = JSON.parse(lastMsg.serverExtension)
        if (!ext?.yxAitMsg) {
          return false
        }

        const myAccountId = store.nim.V2NIMLoginService.getLoginUser()
        // 检查是否@了当前用户或@了所有人
        return myAccountId in ext.yxAitMsg || 'ait_all' in ext.yxAitMsg
      } catch {
        return false
      }
    })()

    // 是否显示消息已读状态
    const showSessionUnread = (() => {
      const myUserAccountId = store.nim.V2NIMLoginService.getLoginUser()

      if (conversation.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P) {
        return (
          conversation?.lastMessage?.messageRefer.senderId === myUserAccountId &&
          conversation?.lastMessage?.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL &&
          conversation?.lastMessage?.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION &&
          conversation?.lastMessage?.sendingState === V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED &&
          conversation?.lastMessage?.lastMessageState !== V2NIMConst.V2NIMLastMessageState.V2NIM_MESSAGE_STATUS_REVOKE
        )
      }

      return false
    })()

    // 原生 touch 事件监听，使用 { passive: false } 以支持 preventDefault
    useEffect(() => {
      const el = containerRef.current
      if (!el) return

      const handleTouchStart = (e: TouchEvent) => {
        startXRef.current = e.changedTouches[0].pageX
        startYRef.current = e.changedTouches[0].pageY
        swipeTriggeredRef.current = false
      }

      const handleTouchMove = (e: TouchEvent) => {
        if (swipeTriggeredRef.current) {
          e.preventDefault()
          return
        }
        const diffX = e.changedTouches[0].pageX - startXRef.current
        const diffY = e.changedTouches[0].pageY - startYRef.current

        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_THRESHOLD) {
          swipeTriggeredRef.current = true
          e.preventDefault()
          if (diffX < 0) {
            onLeftSlideRef.current?.(conversationRef.current)
          } else {
            onLeftSlideRef.current?.(null)
          }
        }
      }

      el.addEventListener('touchstart', handleTouchStart, { passive: true })
      el.addEventListener('touchmove', handleTouchMove, { passive: false })
      return () => {
        el.removeEventListener('touchstart', handleTouchStart)
        el.removeEventListener('touchmove', handleTouchMove)
      }
    }, [])

    // 处理会话项点击
    const handleConversationItemClick = () => {
      if (showMoreActions) {
        // 如果当前显示操作栏，点击应该收起
        onLeftSlide?.(null)
        return
      }
      onClick?.(conversation)
    }

    // CSS 类名
    const containerClassName = ['nim-conversation-item-container', showMoreActions ? 'show-action-list' : '', conversation.stickTop ? 'stick-on-top' : '']
      .filter(Boolean)
      .join(' ')

    return (
      <div className={containerClassName} ref={containerRef} onClick={handleConversationItemClick}>
        <div className="conversation-item-content">
          <div className="conversation-item-left">
            {unread && <div className="unread">{isMute ? <div className="dot"></div> : <div className="badge">{unread}</div>}</div>}
            {conversation.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P ? (
              <AvatarWithStatus account={to} />
            ) : (
              <Avatar account={to} avatar={teamAvatar} />
            )}
          </div>

          <div className="conversation-item-right">
            <div className="conversation-item-top">
              {conversation.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P ? (
                <Appellation className="conversation-item-title" account={to} />
              ) : (
                <span className="conversation-item-title">{sessionName}</span>
              )}
              <span className="conversation-item-time">{formatDate()}</span>
            </div>

            <div className="conversation-item-desc">
              <span className="conversation-item-desc-span">
                {beMentioned && <span className="beMentioned">{`[${t('someoneText')}@${t('meText')}]`}</span>}

                {/* {showSessionUnread && <ConversationItemRead conversation={conversation} />} */}

                {conversation.lastMessage && (
                  <span className="conversation-item-desc-content">
                    <LastMsgContent lastMessage={conversation.lastMessage} />
                  </span>
                )}
              </span>

              <div className="conversation-item-state">
                {isMute && <Icon iconClassName="conversation-item-desc-state" style={{ color: '#ccc' }} type="icon-xiaoximiandarao" />}
              </div>
            </div>
          </div>
        </div>

        <div className="right-action-list">
          {moreActions.map((action) => (
            <div key={action.type} className={`right-action-item ${action.class}`} onClick={(e) => handleActionClick(action.type, e)}>
              {action.name}
            </div>
          ))}
        </div>
      </div>
    )
  }
)

export default ConversationItem
