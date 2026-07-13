import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { caculateTimeago } from '@/NEUIKit/common/utils/date'
import { events, MSG_ID_FLAG } from '@/NEUIKit/common/utils/constants'
import emitter from '@/NEUIKit/common/utils/eventBus'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'

import MessageItem from '../message-item'
import { getMessageSelectKey } from '../message-multi-select/utils'
import './index.less'

interface MessageListProps {
  msgs: any[]
  conversationType: V2NIMConst.V2NIMConversationType
  to: string
  loadingOlder?: boolean
  hasOlder?: boolean
  replyMsgsMap?: {
    [key: string]: any
  }
  voiceTextMap?: Map<string, string>
  setVoiceText?: (messageClientId: string, text: string) => void
  anchorMessageClientId?: string
  anchorMode?: boolean
  loadingNewer?: boolean
  autoScrollToBottom?: boolean
  onLoadOlder?: (firstMsg?: any) => void | Promise<unknown>
  onLoadNewer?: (lastMsg?: any) => void | Promise<unknown>
  isMultiSelecting?: boolean
  selectedMessageIds?: string[]
  onToggleSelect?: (msg: any) => void
  onMultiSelect?: (msg: any) => void
}

const isNormalMsg = (item: any) => !(item.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM && ['beReCallMsg', 'reCallMsg'].includes(item.recallType || ''))

/**
 * 消息列表组件
 */
const MessageList: React.FC<MessageListProps> = observer(
  ({
    msgs = [],
    conversationType,
    to,
    loadingOlder = false,
    hasOlder = true,
    replyMsgsMap = {},
    voiceTextMap = new Map(),
    setVoiceText,
    anchorMessageClientId = '',
    anchorMode = false,
    loadingNewer = false,
    autoScrollToBottom = true,
    onLoadOlder,
    onLoadNewer,
    isMultiSelecting = false,
    selectedMessageIds = [],
    onToggleSelect,
    onMultiSelect
  }) => {
    const { t } = useTranslation()
    const { store } = useStateContext()
    const messageListRef = useRef<HTMLDivElement>(null)
    const anchorScrollStateRef = useRef({
      anchorMessageClientId: '',
      scrolled: false
    })
    const pagingLockRef = useRef(false)
    const loadingOlderRef = useRef(loadingOlder)
    const loadingNewerRef = useRef(loadingNewer)
    const onLoadMoreRef = useRef<() => void>(() => undefined)
    const pendingPaginationRef = useRef<{
      direction: 'older' | 'newer'
      prevScrollHeight: number
      prevScrollTop: number
    } | null>(null)
    const [broadcastNewAudioSrc, setBroadcastNewAudioSrc] = useState('')

    /**
     * 处理消息列表，插入时间分割线
     */
    const finalMsgs = msgs.reduce((result: any[], item, index) => {
      // 如果两条消息间隔超过5分钟，插入一条自定义时间消息
      if (index > 0 && item.createTime - msgs[index - 1].createTime > 5 * 60 * 1000) {
        result.push({
          ...item,
          messageClientId: 'time-' + item.createTime,
          messageType: V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
          sendingState: V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
          timeValue: caculateTimeago(item.createTime),
          renderKey: `${item.createTime + 1}`
        })
      }
      result.push({
        ...item,
        renderKey: `${item.createTime}`
      })
      return result
    }, [])

    const getFirstNormalMsg = () => finalMsgs.find(isNormalMsg)

    const getLastNormalMsg = () => {
      const normalMsgs = finalMsgs.filter(isNormalMsg)
      return normalMsgs[normalMsgs.length - 1]
    }

    /**
     * 滚动到底部
     */
    const scrollToBottom = () => {
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight
      }
    }

    const scrollToAnchor = () => {
      if (!anchorMessageClientId) return false
      const el = document.getElementById(`${MSG_ID_FLAG}${anchorMessageClientId}`)
      if (!el) return false
      el.scrollIntoView({ block: 'center' })
      return true
    }

    const unlockPaginationAfterRender = () => {
      requestAnimationFrame(() => {
        const pending = pendingPaginationRef.current
        if (!pending || loadingOlderRef.current || loadingNewerRef.current) return

        if (messageListRef.current && pending.direction === 'older') {
          const nextScrollHeight = messageListRef.current.scrollHeight
          messageListRef.current.scrollTop = pending.prevScrollTop + (nextScrollHeight - pending.prevScrollHeight)
        }

        requestAnimationFrame(() => {
          if (loadingOlderRef.current || loadingNewerRef.current) return
          pagingLockRef.current = false
          pendingPaginationRef.current = null
        })
      })
    }

    const startPagination = (direction: 'older' | 'newer', load: () => void | Promise<unknown>) => {
      if (pagingLockRef.current || !messageListRef.current) return

      pagingLockRef.current = true
      pendingPaginationRef.current = {
        direction,
        prevScrollHeight: messageListRef.current.scrollHeight,
        prevScrollTop: messageListRef.current.scrollTop
      }

      const result = load()
      Promise.resolve(result).finally(() => {
        setTimeout(() => {
          if (!loadingOlderRef.current && !loadingNewerRef.current) {
            unlockPaginationAfterRender()
          }
        }, 0)
      })
    }

    /**
     * 加载更多消息
     */
    const onLoadMore = () => {
      if (pagingLockRef.current || loadingOlderRef.current || !onLoadOlder) return
      const msg = getFirstNormalMsg()
      if (!msg) return
      startPagination('older', () => onLoadOlder(msg))
    }

    useEffect(() => {
      onLoadMoreRef.current = onLoadMore
    })

    const handleScroll = () => {
      if (!messageListRef.current) return
      if (pagingLockRef.current || loadingOlderRef.current || loadingNewerRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = messageListRef.current
      if (anchorMode && onLoadNewer && scrollHeight - scrollTop - clientHeight < 24) {
        const msg = getLastNormalMsg()
        if (msg) {
          startPagination('newer', () => onLoadNewer(msg))
        }
      }
      if (anchorMode && scrollTop < 24) {
        onLoadMore()
      }
    }

    /**
     * 处理点击消息列表
     */
    const handleTapMessageList = () => {
      // 点击消息列表时让输入框失焦
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && activeElement.id === 'msg-input') {
        activeElement.blur()
      }

      emitter.emit(events.CLOSE_PANEL)
    }

    useEffect(() => {
      loadingOlderRef.current = loadingOlder
      loadingNewerRef.current = loadingNewer
    }, [loadingOlder, loadingNewer])

    useEffect(() => {
      const pending = pendingPaginationRef.current
      if (!pending || loadingOlder || loadingNewer) return
      unlockPaginationAfterRender()
    }, [finalMsgs.length, loadingOlder, loadingNewer])

    // 组件挂载时初始化
    useEffect(() => {
      const team = store.teamStore.teams.get(to)

      // 如果是群聊，加载群成员信息
      if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
        store.teamMemberStore.getTeamMemberActive({
          teamId: to,
          queryOption: {
            limit: Math.max(team?.memberLimit || 0, 200),
            roleQueryType: 0
          }
        })
      }

      // 监听音频URL变化
      const handleAudioUrlChange = (url: string) => {
        setBroadcastNewAudioSrc(url)
      }

      // 监听加载更多
      const handleOnLoadMore = () => {
        onLoadMoreRef.current()
      }

      // 注册事件
      // emitter.on(events.AUDIO_URL_CHANGE, handleAudioUrlChange)
      emitter.on(events.ON_LOAD_MORE, handleOnLoadMore)
      if (autoScrollToBottom) {
        emitter.on(events.ON_SCROLL_BOTTOM, scrollToBottom)
      }

      // 初次加载完成后滚动到底部
      const timer = setTimeout(() => {
        if (anchorMessageClientId) {
          if (scrollToAnchor()) {
            anchorScrollStateRef.current = {
              anchorMessageClientId,
              scrolled: true
            }
          }
        } else if (autoScrollToBottom) {
          scrollToBottom()
        }
        clearTimeout(timer)
      }, 100)

      return () => {
        // emitter.off(events.AUDIO_URL_CHANGE, handleAudioUrlChange)
        emitter.off(events.ON_LOAD_MORE, handleOnLoadMore)
        if (autoScrollToBottom) {
          emitter.off(events.ON_SCROLL_BOTTOM, scrollToBottom)
        }
      }
    }, [autoScrollToBottom])

    // 滚动容器高度变化时（键盘弹起/收起、网络断开提示条等），若用户之前在底部附近则保持滚到底部
    useLayoutEffect(() => {
      const el = messageListRef.current
      if (!el) return

      // 记录上一次的状态，用于判断 resize 前用户是否在底部
      const prevStateRef = { clientHeight: 0, distanceFromBottom: 0 }

      const scrollToBottomIfNear = () => {
        const currentEl = messageListRef.current
        if (!currentEl) return
        const { scrollHeight, scrollTop, clientHeight } = currentEl
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight
        const prev = prevStateRef
        const wasNearBottom = prev.distanceFromBottom < 48
        const isNearBottom = distanceFromBottom < 48
        // 容器变矮（键盘弹起）时，之前用户在底部附近 → 需要保持滚到底部
        const containerShrunk = clientHeight < prev.clientHeight

        if (isNearBottom || (wasNearBottom && containerShrunk)) {
          currentEl.scrollTop = scrollHeight
        }

        // 更新状态快照
        prev.clientHeight = clientHeight
        prev.distanceFromBottom = distanceFromBottom
      }

      let rafId = 0
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(scrollToBottomIfNear)
      })
      observer.observe(el)

      // H5 键盘弹起/收起时 visualViewport 变化，但容器 CSS 尺寸可能不变，ResizeObserver 不触发
      const onViewportResize = () => {
        requestAnimationFrame(scrollToBottomIfNear)
      }
      window.visualViewport?.addEventListener('resize', onViewportResize)

      return () => {
        observer.disconnect()
        cancelAnimationFrame(rafId)
        window.visualViewport?.removeEventListener('resize', onViewportResize)
      }
    }, [])

    useEffect(() => {
      if (!anchorMessageClientId) return
      if (anchorScrollStateRef.current.anchorMessageClientId !== anchorMessageClientId) {
        anchorScrollStateRef.current = {
          anchorMessageClientId,
          scrolled: false
        }
      }
      if (anchorScrollStateRef.current.scrolled) return

      const timer = setTimeout(() => {
        if (scrollToAnchor()) {
          anchorScrollStateRef.current = {
            anchorMessageClientId,
            scrolled: true
          }
        }
        clearTimeout(timer)
      }, 100)
    }, [anchorMessageClientId, finalMsgs.length])

    return (
      <div className="msg-list-wrapper" onTouchStart={handleTapMessageList} onClick={handleTapMessageList}>
        <div id="message-scroll-list" className="message-scroll-list" ref={messageListRef} onScroll={handleScroll}>
          {hasOlder && (
            <div className="view-more-text" onClick={onLoadMore}>
              {loadingOlder ? t('loadingMoreText') : t('viewMoreText')}
            </div>
          )}
          {!hasOlder && <div className="msg-tip">{t('noMoreText')}</div>}

          {finalMsgs.map((item, index) => (
            <MessageItem
              key={item.messageClientId || index}
              msg={item}
              index={index}
              replyMsgsMap={replyMsgsMap}
              broadcastNewAudioSrc={broadcastNewAudioSrc}
              voiceTextMap={voiceTextMap}
              setVoiceText={setVoiceText}
              isMultiSelecting={isMultiSelecting}
              selected={selectedMessageIds.includes(getMessageSelectKey(item))}
              onToggleSelect={onToggleSelect}
              onMultiSelect={onMultiSelect}
            />
          ))}

          {anchorMode && loadingNewer && <div className="msg-tip">{t('loadingMoreText')}</div>}
        </div>
      </div>
    )
  }
)

export default MessageList
