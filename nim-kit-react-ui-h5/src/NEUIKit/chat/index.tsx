import React, { useState, useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { autorun } from 'mobx'
import { useLocation, useNavigate } from '@/utils/router'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { events } from '@/NEUIKit/common/utils/constants'
import { showModal } from '@/NEUIKit/common/utils/modal'
import { showToast, toast } from '@/NEUIKit/common/utils/toast'
import { neUiKitRouterPath } from '@/NEUIKit/common/utils/uikitRouter'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import emitter from '@/NEUIKit/common/utils/eventBus'

import NetworkAlert from '@/NEUIKit/common/components/NetworkAlert'
import NavBar from './message/nav-bar'
import Icon from '@/NEUIKit/common/components/Icon'
import MessageList from './message/message-list'
import MessageInput from './message/message-input'
import MessageForward from './message/message-forward'
import { useEventTracking } from '../common/hooks/useEventTracking'
import { checkUserOnline } from '../common/utils/userStatus'
import { getVoiceTextMap, setVoiceText as setCachedVoiceText } from './voiceTextCache'
import { useChatMessageLoader } from './hooks/useChatMessageLoader'
import { chunkMessages, getMessageSelectKey, isForwardableMessage, isSelectableMessage, MULTI_DELETE_BATCH_SIZE, MULTI_FORWARD_LIMIT, syncConversationLastMessageAfterDelete } from './message/message-multi-select/utils'
import { isMergeForwardableMessage, MERGED_FORWARD_LIMIT } from './message/merged-forward/utils'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'

import './index.less'

// 回复消息类型
interface YxReplyMsg {
  conversationId: string
  messageClientId: string
  messageServerId: string
  conversationType: V2NIMConst.V2NIMConversationType
  senderId: string
  receiverId: string
  createTime: number
}

/**
 * 聊天组件
 */
const Chat = observer(() => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { store, nim } = useStateContext()
  const query = new URLSearchParams(location.search)
  const queryConversationId = query.get('conversationId') || ''
  const anchorMessageClientId = query.get('anchorMessageClientId') || ''
  const selectedConversation = store.uiStore.selectedConversation as string
  const lastConversationIdRef = useRef(queryConversationId || selectedConversation || '')

  const [title, setTitle] = useState('')
  const [statusText, setStatusText] = useState('')  // P2P 会话的在线状态文字
  const [replyMsgsMap, setReplyMsgsMap] = useState<Record<string, any>>({})
  const [isMultiSelecting, setIsMultiSelecting] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  const [multiForwardMsgs, setMultiForwardMsgs] = useState<V2NIMMessageForUI[]>([])
  const [multiForwardMode, setMultiForwardMode] = useState<'oneByOne' | 'merge'>('oneByOne')
  const initialScrollKeyRef = useRef('')

  // 会话ID
  const currentConversationId = queryConversationId || selectedConversation
  if (currentConversationId) {
    lastConversationIdRef.current = currentConversationId
  }
  const conversationId = currentConversationId || lastConversationIdRef.current

  // 语音转文字结果存储 Map<messageClientId, text>，进入会话列表前保留在内存中
  const [voiceTextMap, setVoiceTextMap] = useState<Map<string, string>>(() => getVoiceTextMap(conversationId))

  /**
   * 设置语音转文字结果
   */
  const setVoiceText = (messageClientId: string, text: string) => {
    setVoiceTextMap(setCachedVoiceText(conversationId, messageClientId, text))
  }

  // 会话类型
  const conversationType = conversationId
    ? (nim.V2NIMConversationIdUtil.parseConversationType(conversationId) as unknown as V2NIMConst.V2NIMConversationType)
    : V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_UNKNOWN

  // 对话方
  const to = conversationId ? nim.V2NIMConversationIdUtil.parseConversationTargetId(conversationId) : ''

  // 是否需要显示群组消息已读未读，默认 false
  const teamManagerVisible = store.localOptions.teamMsgReceiptVisible

  // 是否需要显示 p2p 消息、p2p会话列表消息已读未读，默认 false
  const p2pMsgReceiptVisible = store.localOptions.p2pMsgReceiptVisible

  // 初始化埋点
  useEventTracking({
    component: 'ChatUIKit'
  })

  useEffect(() => {
    if (queryConversationId && queryConversationId !== store.uiStore.selectedConversation) {
      store.uiStore.selectConversation(queryConversationId)
    }
  }, [queryConversationId])

  /**
   * 返回会话列表
   */
  const backToConversation = () => {
    // 在导航离开前清除选中的会话，以便后续收到消息时能正确计算未读数
    store.uiStore.unselectConversation()
    navigate(neUiKitRouterPath.conversation)
  }

  /**
   * 跳转设置页
   */
  const handleSetting = () => {
    if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P) {
      navigate({
        pathname: neUiKitRouterPath.p2pSetting,
        search: `?accountId=${to}`
      })
    } else if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
      navigate({
        pathname: neUiKitRouterPath.teamSetting,
        search: `?teamId=${to}`
      })
    }
  }

  const exitMultiSelect = () => {
    setIsMultiSelecting(false)
    setSelectedMessageIds([])
    setMultiForwardMsgs([])
  }

  const enterMultiSelect = (msg: V2NIMMessageForUI) => {
    if (!isSelectableMessage(msg)) return
    setIsMultiSelecting(true)
    setSelectedMessageIds([getMessageSelectKey(msg)])
    emitter.emit(events.CLOSE_PANEL)
  }

  const toggleSelectMessage = (msg: V2NIMMessageForUI) => {
    if (!isSelectableMessage(msg)) return
    const selectKey = getMessageSelectKey(msg)
    setSelectedMessageIds((ids) => (ids.includes(selectKey) ? ids.filter((id) => id !== selectKey) : [...ids, selectKey]))
  }

  const openMultiForward = (forwardMsgs: V2NIMMessageForUI[]) => {
    setMultiForwardMode('oneByOne')
    setMultiForwardMsgs(forwardMsgs)
  }

  const openMergeForward = (forwardMsgs: V2NIMMessageForUI[]) => {
    setMultiForwardMode('merge')
    setMultiForwardMsgs(forwardMsgs)
  }

  const syncSelectedMessages = (msgs: V2NIMMessageForUI[]) => {
    setSelectedMessageIds(msgs.map(getMessageSelectKey).filter(Boolean))
  }

  const handleMultiForward = () => {
    if (!selectedMessages.length) {
      return
    }

    if (store.connectStore.loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      toast.info(t('networkError'))
      return
    }

    if (selectedMessages.length > MULTI_FORWARD_LIMIT) {
      showToast({
        message: t('oneByOneForwardLimitText'),
        type: 'info',
        duration: 1000
      })
      return
    }

    const forwardableMsgs = selectedMessages.filter((msg) => isForwardableMessage(store, msg))
    if (forwardableMsgs.length !== selectedMessages.length) {
      showModal({
        title: t('forwardExceptionTitle'),
        content: t('forwardExceptionContent'),
        confirmText: t('okText'),
        cancelText: t('cancelText'),
        onConfirm: () => {
          syncSelectedMessages(forwardableMsgs)
          if (forwardableMsgs.length) {
            openMultiForward(forwardableMsgs)
          } else {
            showToast({
              message: t('noForwardableMsgText'),
              type: 'info',
              duration: 1000
            })
          }
        }
      })
      return
    }

    openMultiForward(forwardableMsgs)
  }

  const handleMergeForward = () => {
    if (!selectedMessages.length) {
      return
    }

    if (store.connectStore.loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      toast.info(t('networkError'))
      return
    }

    if (selectedMessages.length > MERGED_FORWARD_LIMIT) {
      showToast({
        message: t('mergeForwardLimitText'),
        type: 'info',
        duration: 1000
      })
      return
    }

    const forwardableMsgs = selectedMessages.filter((msg) => isMergeForwardableMessage(store, msg))
    if (forwardableMsgs.length !== selectedMessages.length) {
      showModal({
        title: t('forwardExceptionTitle'),
        content: t('forwardExceptionContent'),
        confirmText: t('okText'),
        cancelText: t('cancelText'),
        onConfirm: () => {
          syncSelectedMessages(forwardableMsgs)
          if (forwardableMsgs.length) {
            openMergeForward(forwardableMsgs)
          } else {
            showToast({
              message: t('noForwardableMsgText'),
              type: 'info',
              duration: 1000
            })
          }
        }
      })
      return
    }

    openMergeForward(forwardableMsgs)
  }

  /**
   * 解散群组回调
   */
  const onTeamDismissed = (data: any) => {
    if (data.teamId === to) {
      showModal({
        content: t('onDismissTeamText'),
        title: t('tipText'),
        onCancel: () => {
          backToConversation()
        },
        onConfirm: () => {
          backToConversation()
        }
      })
    }
  }

  /**
   * 自己主动离开群组或被管理员踢出回调
   */
  const onTeamLeft = () => {
    showToast({
      message: t('onRemoveTeamText'),
      type: 'info',
      duration: 1000
    })
    backToConversation()
  }

  /**
   * 收到新消息
   */
  const onReceiveMessages = (messages: any[]) => {
    // 当前在聊天页，视为消息已读，发送已读回执
    const pathname = window.location.pathname
    if (messages.length && !messages[0]?.isSelf && messages[0].conversationId === conversationId && pathname === neUiKitRouterPath.chat) {
      handleMsgReceipt(messages)
    }
    if (handleIncomingMessages(messages)) {
      // 加个宏任务, 因为事件先触发后, msgs 自身才更新
      setTimeout(() => {
        emitter.emit(events.ON_SCROLL_BOTTOM)
      }, 0)
    }
  }

  /**
   * 处理收到消息的已读回执
   */
  const handleMsgReceipt = (message: any[]) => {
    if (message[0].conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P && p2pMsgReceiptVisible) {
      store.msgStore.sendMsgReceiptActive(message[0])
    } else if (message[0].conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM && teamManagerVisible) {
      store.msgStore.sendTeamMsgReceiptActive(message)
    }
  }

  /**
   * 处理历史消息的已读未读
   */
  const handleHistoryMsgReceipt = async (messages: any[]) => {
    // 如果是单聊
    if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P && p2pMsgReceiptVisible) {
      const myUserAccountId = nim.V2NIMLoginService.getLoginUser()
      const othersMsgs = messages
        .filter((item) => !['beReCallMsg', 'reCallMsg'].includes(item.recallType || ''))
        .filter((item) => item.senderId !== myUserAccountId)

      // 发送单聊消息已读回执
      if (othersMsgs.length > 0) {
        await store.msgStore.sendMsgReceiptActive(othersMsgs[0])
      }
    }
    // 如果是群聊
    else if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM && teamManagerVisible) {
      const myUserAccountId = nim.V2NIMLoginService.getLoginUser()
      const myMsgs = messages
        .filter((item) => !['beReCallMsg', 'reCallMsg'].includes(item.recallType || ''))
        .filter((item) => item.senderId === myUserAccountId)

      await store.msgStore.getTeamMsgReadsActive(myMsgs, conversationId)

      // 发送群消息已读回执
      // sdk 要求 一次最多传入 50 个消息对象
      const othersMsgs = messages
        .filter((item) => !['beReCallMsg', 'reCallMsg'].includes(item.recallType || ''))
        .filter((item) => item.senderId !== myUserAccountId)

      if (othersMsgs.length > 0 && othersMsgs.length < 50) {
        await store.msgStore.sendTeamMsgReceiptActive(othersMsgs)
      }
    }
  }

  const {
    msgs,
    loadingOlder,
    loadingNewer,
    hasOlder,
    hasNewer,
    anchorMode,
    showLatestHint,
    loadOlder,
    loadNewer,
    switchToLatest,
    handleIncomingMessages
  } = useChatMessageLoader({
    conversationId,
    anchorMessageClientId,
    loginStatus: store.connectStore.loginStatus,
    store,
    nim,
    onHistoryMessagesLoaded: handleHistoryMsgReceipt,
    onError: (err) => {
      showToast({
        message: t('getHistoryFailedText'),
        type: 'error',
        duration: 1000
      })
      console.error('Get history message failed', err.toString())
    }
  })

  const selectedMessageIdSet = new Set(selectedMessageIds)
  const selectedMessages = msgs.filter((msg) => selectedMessageIdSet.has(getMessageSelectKey(msg)))

  const handleMultiDelete = () => {
    if (!selectedMessages.length) {
      return
    }

    if (store.connectStore.loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      toast.info(t('networkError'))
      return
    }

    showModal({
      title: t('deleteText'),
      content: t('delete'),
      confirmText: t('deleteText'),
      cancelText: t('cancelText'),
      onConfirm: async () => {
        try {
          const messageBatches = chunkMessages(selectedMessages, MULTI_DELETE_BATCH_SIZE)
          for (const messageBatch of messageBatches) {
            await store.msgStore.deleteMsgActive(messageBatch)
          }
          toast.info(t('deleteMsgSuccessText'))
          syncConversationLastMessageAfterDelete(store, conversationId)
          exitMultiSelect()
        } catch {
          toast.info(t('deleteMsgFailText'))
        }
      }
    })
  }

  const backToLatestMsgs = async () => {
    navigate(neUiKitRouterPath.chat, { replace: true })
    await switchToLatest()
    setTimeout(() => {
      emitter.emit(events.ON_SCROLL_BOTTOM)
    }, 0)
  }

  const handleSendMessage = () => {
    if (!anchorMode) return
    backToLatestMsgs()
  }

  useEffect(() => {
    if (!isMultiSelecting) return
    setSelectedMessageIds((ids) => {
      const selectableIds = new Set(msgs.filter(isSelectableMessage).map(getMessageSelectKey))
      return ids.filter((id) => selectableIds.has(id))
    })
  }, [isMultiSelecting, msgs])

  // 使用 autorun 监听导航栏标题（自动追踪 MobX observable 依赖）
  // 当以下任一变化时自动触发：conversationId、群信息、在线状态
  useEffect(() => {
    const dispose = autorun(() => {
      // 防解散群的时候 conversationId 编为空字符串, type 变 unknown, to 变空字符串
      if (!conversationId) return
      
      if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P) {
        const appellation = store.uiStore.getAppellation({ account: to })
        // autorun 会自动追踪 stateMap.get(to) 的变化
        const userStatus = store.subscriptionStore.getUserStatus(to)
        const isOnline = checkUserOnline(userStatus)
        // P2P 会话：标题为昵称，状态文字单独设置（确保昵称过长时状态不被截断）
        setTitle(appellation)
        setStatusText(isOnline ? `(${t('userOnlineText')})` : `(${t('userOfflineText')})`)
      } else if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
        // autorun 会自动追踪 teams.get(to) 的变化
        const team = store.teamStore.teams.get(to)
        const subTitle = `(${team?.memberCount || 0})`
        // 群聊：标题包含群名和成员数，无状态文字
        setTitle((team?.name || '') + subTitle)
        setStatusText('')
      }
    })
    
    return () => dispose()
  }, [conversationId, conversationType, to])

  useEffect(() => {
    const key = `${conversationId}-${anchorMessageClientId}`
    if (anchorMode || anchorMessageClientId || !msgs.length || initialScrollKeyRef.current === key) return

    initialScrollKeyRef.current = key
    setTimeout(() => {
      emitter.emit(events.ON_SCROLL_BOTTOM)
    }, 0)
  }, [anchorMessageClientId, anchorMode, conversationId, msgs.length])

  // 处理可能的回复消息
  const processReplyMsg = (msgs: any) => {
    const _replyMsgsMap: Record<string, any> = {}
    const reqMsgs: YxReplyMsg[] = []
    const messageClientIds: Record<string, string> = {}
    msgs.forEach((msg: any) => {
      // 兼容旧版本用 serverExtension 存储被回复消息的相关消息
      if (msg.serverExtension) {
        try {
          // yxReplyMsg 存储着被回复消息的相关消息
          const { yxReplyMsg } = JSON.parse(msg.serverExtension)
          if (yxReplyMsg) {
            // 从消息列表中找到被回复消息，replyMsg 为被回复的消息
            const replyMsg = msgs.find((item) => item.messageClientId === yxReplyMsg.idClient)
            // 如果直接找到，存储在map中
            if (replyMsg) {
              _replyMsgsMap[msg.messageClientId] = replyMsg
              // 如果没找到，说明被回复的消息可能有三种情况：1.被删除 2.被撤回 3.不在当前消息列表中（一次性没拉到，在之前的消息中）
            } else {
              _replyMsgsMap[msg.messageClientId] = {
                messageClientId: 'noFind'
              }
              const { scene, from, to, idServer, messageClientId, time, receiverId } = yxReplyMsg

              if (scene && from && to && idServer && messageClientId && time && receiverId) {
                reqMsgs.push({
                  conversationType: scene,
                  senderId: from,
                  conversationId: to,
                  messageServerId: idServer,
                  messageClientId,
                  createTime: time,
                  receiverId
                })
                messageClientIds[idServer] = msg.messageClientId
              }
            }
          }
        } catch (e) {
          // 解析JSON失败
        }
      }
      // 新版本采用 threadReply 存储被回复消息的相关消息
      else if (msg.threadReply) {
        // serverExtension":"{\"yxReplyMsg\":{\"idClient\":\"0cb875a967854da69173df397294a832\",\"scene\":2,\"from\":\"334574329307264\",\"receiverId\":\"46223315430\",\"to\":\"334633283559552|2|46223315430\",\"idServer\":\"3101994188820971548\",\"time\":1755500811326}}","sendingState":3,"senderName":""}
        // yxReplyMsg 存储着被回复消息的相关消息
        const yxReplyMsg = msg.threadReply
        // 从消息列表中找到被回复消息，replyMsg 为被回复的消息
        const replyMsg = msgs.find((item) => item.messageClientId === yxReplyMsg.messageClientId)
        // 如果直接找到，存储在map中
        if (replyMsg) {
          _replyMsgsMap[msg.messageClientId] = replyMsg
          // 如果没找到，说明被回复的消息可能有三种情况：1.被删除 2.被撤回 3.不在当前消息列表中（一次性没拉到，在之前的消息中）
        } else {
          _replyMsgsMap[msg.messageClientId] = {
            messageClientId: 'noFind'
          }
          const { conversationType, conversationId, senderId, receiverId, messageServerId, messageClientId, createTime } = yxReplyMsg

          reqMsgs.push({
            conversationId,
            conversationType,
            senderId,
            receiverId,
            messageServerId,
            messageClientId,
            createTime
          })
          messageClientIds[messageServerId] = msg.messageClientId
        }
      }
    })

    return { _replyMsgsMap, reqMsgs, messageClientIds }
  }

  // 监听消息列表
  useEffect(() => {
    // 遍历所有消息，找出被回复消息，储存在map中
    if (msgs.length > 0) {
      const { _replyMsgsMap, reqMsgs, messageClientIds } = processReplyMsg(msgs)

      if (reqMsgs.length > 0) {
        // 从服务器拉取被回复消息, 但是有频率控制
        nim.V2NIMMessageService.getMessageListByRefers(
          reqMsgs.map((item) => ({
            senderId: item.senderId,
            receiverId: item.receiverId,
            messageClientId: item.messageClientId,
            messageServerId: item.messageServerId,
            createTime: item.createTime,
            conversationType: item.conversationType,
            conversationId: item.conversationId
          }))
        )
          .then((res: any) => {
            if (res?.length > 0) {
              res.forEach((item: any) => {
                if (item.messageServerId) {
                  _replyMsgsMap[messageClientIds[item.messageServerId]] = item
                }
              })
            }
            setReplyMsgsMap({ ..._replyMsgsMap })
          })
          .catch(() => {
            setReplyMsgsMap({ ..._replyMsgsMap })
          })
      } else {
        setReplyMsgsMap({ ..._replyMsgsMap })
      }
    }
  }, [msgs])

  // // 绑定和解绑事件监听
  useEffect(() => {
    // 初始加载时，如果有消息，发送已读回执
    if (msgs.length) {
      const _msgs = [...msgs].reverse()
      handleHistoryMsgReceipt(_msgs)
    }

    // 绑定事件监听
    nim.V2NIMMessageService.on('onReceiveMessages', onReceiveMessages)
    nim.V2NIMTeamService.on('onTeamDismissed', onTeamDismissed)
    nim.V2NIMTeamService.on('onTeamLeft', onTeamLeft)

    return () => {
      // 解绑事件监听
      nim.V2NIMMessageService.off('onReceiveMessages', onReceiveMessages)
      nim.V2NIMTeamService.off('onTeamDismissed', onTeamDismissed)
      nim.V2NIMTeamService.off('onTeamLeft', onTeamLeft)
    }
  }, [conversationId, handleIncomingMessages])

  return (
    <div className="msg-page-wrapper-h5">
      <NavBar
        title={title}
        showLeft={true}
        leftContent={
          <div onClick={backToConversation}>
            <Icon type="icon-zuojiantou" size={24} />
          </div>
        }
        rightContent={
          isMultiSelecting ? (
            <div className="msg-nav-cancel" onClick={exitMultiSelect}>
              {t('cancelText')}
            </div>
          ) : (
            <div onClick={handleSetting}>
              <Icon type="icon-More" size={24} />
            </div>
          )
        }
        // P2P 会话时显示在线状态文字，使用 iconContent 确保不被截断
        iconContent={statusText ? <span className="nav-status-text">{statusText}</span> : undefined}
      />

      <div className="msg-alert">
        <NetworkAlert />
      </div>

      <MessageList
        conversationType={conversationType}
        to={to}
        msgs={msgs}
        loadingOlder={loadingOlder}
        hasOlder={hasOlder}
        replyMsgsMap={replyMsgsMap}
        voiceTextMap={voiceTextMap}
        setVoiceText={setVoiceText}
        anchorMessageClientId={anchorMessageClientId}
        anchorMode={anchorMode}
        loadingNewer={loadingNewer}
        autoScrollToBottom={!anchorMode}
        onLoadOlder={loadOlder}
        onLoadNewer={loadNewer}
        isMultiSelecting={isMultiSelecting}
        selectedMessageIds={selectedMessageIds}
        onToggleSelect={toggleSelectMessage}
        onMultiSelect={enterMultiSelect}
      />

      {anchorMode && (hasNewer || showLatestHint) && (
        <div className="msg-anchor-latest" onClick={backToLatestMsgs}>
          {loadingNewer ? <Icon type="icon-a-Frame8" size={20} iconClassName="msg-anchor-loading" /> : <Icon type="icon-jiantou" size={20} />}
        </div>
      )}

      {isMultiSelecting ? (
        <div className="msg-multi-action-bar">
          <div className={`msg-multi-action ${!selectedMessages.length ? 'disabled' : ''}`} onClick={handleMergeForward}>
            <div className="msg-multi-action-icon">
              <Icon type="icon-zhuanfa" size={22} />
            </div>
            <div>{t('mergeForwardText')}</div>
          </div>
          <div className={`msg-multi-action ${!selectedMessages.length ? 'disabled' : ''}`} onClick={handleMultiForward}>
            <div className="msg-multi-action-icon">
              <Icon type="icon-zhuanfa" size={22} />
            </div>
            <div>{t('oneByOneForwardText')}</div>
          </div>
          <div className={`msg-multi-action ${!selectedMessages.length ? 'disabled' : ''}`} onClick={handleMultiDelete}>
            <div className="msg-multi-action-icon">
              <Icon type="icon-shanchu" size={22} />
            </div>
            <div>{t('deleteText')}</div>
          </div>
        </div>
      ) : (
        <MessageInput replyMsgsMap={replyMsgsMap} conversationType={conversationType} to={to} onSendMessage={handleSendMessage} />
      )}

      {!!multiForwardMsgs.length && (
        <MessageForward
          visible={!!multiForwardMsgs.length}
          msgIdClient={multiForwardMsgs[0]?.messageClientId || ''}
          msgs={multiForwardMsgs}
          forwardMode={multiForwardMode}
          conversationId={conversationId}
          onClose={() => {
            setMultiForwardMsgs([])
          }}
          onForwardSuccess={() => {
            exitMultiSelect()
          }}
        />
      )}
    </div>
  )
})

export default Chat
