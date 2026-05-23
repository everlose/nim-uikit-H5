import React, { useEffect, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { autorun } from 'mobx'
import { useLocation, useNavigate } from '@/utils/router'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import type { PinInfo } from '@xkit-yx/im-store-v2/dist/types/src/pinMsgsMap'
import NavBar from '@/NEUIKit/common/components/NavBar'
import Avatar from '@/NEUIKit/common/components/Avatar'
import Empty from '@/NEUIKit/common/components/Empty'
import Icon from '@/NEUIKit/common/components/Icon'
import BottomPopup from '@/NEUIKit/common/components/BottomPopup'
import MessageForward from '@/NEUIKit/chat/message/message-forward'
import PinMessagePreview from '@/NEUIKit/chat/pin-list/message-preview'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { copyText } from '@/NEUIKit/common/utils'
import { toast } from '@/NEUIKit/common/utils/toast'
import { neUiKitRouterPath } from '@/NEUIKit/common/utils/uikitRouter'
import { getMessageRefer } from '@/NEUIKit/chat/message-pin/utils'
import './index.less'

const PAGE_SIZE = 20

const formatPinTime = (time: number) => {
  const date = new Date(time)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`
}

const getPinMessage = (pinInfo: PinInfo): V2NIMMessageForUI | undefined => {
  return pinInfo.message as V2NIMMessageForUI | undefined
}

const normalizePinInfos = (pinInfos: PinInfo[]) => {
  return [...pinInfos]
    .filter((item) => item.pinState > 0 && getPinMessage(item))
    .sort((a, b) => (getPinMessage(b)?.createTime || b.updateTime || 0) - (getPinMessage(a)?.createTime || a.updateTime || 0))
}

const PinList: React.FC = observer(() => {
  const { t } = useTranslation()
  const { store, nim } = useStateContext()
  const navigate = useNavigate()
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const conversationId = query.get('conversationId') || ''
  const [pinInfos, setPinInfos] = useState<PinInfo[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [forwardMsgId, setForwardMsgId] = useState('')
  const [forwardMsg, setForwardMsg] = useState<V2NIMMessageForUI>()
  const [actionMsgId, setActionMsgId] = useState('')
  const prevLoginStatusRef = useRef(store.connectStore.loginStatus)

  const conversationType = conversationId
    ? (nim.V2NIMConversationIdUtil.parseConversationType(conversationId) as unknown as V2NIMConst.V2NIMConversationType)
    : V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
  const targetId = conversationId ? nim.V2NIMConversationIdUtil.parseConversationTargetId(conversationId) : ''

  const loadPinList = async (forceUpdate = false) => {
    if (!conversationId) return
    setLoading(true)
    try {
      const list = await (store.msgStore.getPinnedMessageListActive as (conversationId: string, forceUpdate?: boolean) => Promise<PinInfo[]>)(conversationId, forceUpdate)
      setPinInfos(normalizePinInfos(list))
    } catch (error) {
      toast.info(t('getHistoryFailedText'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPinList()
  }, [conversationId])

  useEffect(() => {
    const prevLoginStatus = prevLoginStatusRef.current
    const loginStatus = store.connectStore.loginStatus
    prevLoginStatusRef.current = loginStatus

    if (
      prevLoginStatus === V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED ||
      loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED ||
      !conversationId
    ) {
      return
    }

    loadPinList(true)
  }, [store.connectStore.loginStatus, conversationId])

  useEffect(() => {
    if (!conversationId) return

    const dispose = autorun(() => {
      const pinMap = store.msgStore.pinMsgs.map.get(conversationId)
      if (!pinMap) return

      const list = normalizePinInfos([...pinMap.values()])
      setPinInfos(list)
    })

    return () => dispose()
  }, [conversationId, store])

  const visiblePins = useMemo(() => pinInfos.slice(0, visibleCount), [pinInfos, visibleCount])
  const actionMsg = useMemo(() => {
    if (!actionMsgId) return undefined
    return pinInfos.map((item) => getPinMessage(item)).find((msg) => msg?.messageClientId === actionMsgId)
  }, [actionMsgId, pinInfos])

  const handleCopy = async (msg: V2NIMMessageForUI) => {
    if (msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT || !msg.text) {
      toast.info(t('copyFailText'))
      return
    }

    try {
      await copyText(msg.text)
      toast.info(t('copySuccessText'))
    } catch (error) {
      toast.info(t('copyFailText'))
    }
  }

  const handleUnpin = async (msg: V2NIMMessageForUI) => {
    if (store.connectStore.loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      toast.info(t('networkError'))
      return
    }

    try {
      await store.msgStore.unpinMessageActive(getMessageRefer(msg))
      setPinInfos((list) => list.filter((item) => item.messageRefer.messageClientId !== msg.messageClientId))
      setActionMsgId('')
      toast.info(t('unpinSuccessText'))
    } catch (error) {
      toast.info(t('unpinFailedText'))
    }
  }

  const closeActionPopup = () => {
    setActionMsgId('')
  }

  const handleActionCopy = async (msg: V2NIMMessageForUI) => {
    await handleCopy(msg)
    closeActionPopup()
  }

  const handleActionForward = (msg: V2NIMMessageForUI) => {
    if (store.connectStore.loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      toast.info(t('offlineText'))
      return
    }

    store.uiStore.selectConversation(conversationId)
    setForwardMsg(msg)
    setForwardMsgId(msg.messageClientId)
    closeActionPopup()
  }

  const openChatAtMessage = async (msg: V2NIMMessageForUI) => {
    await store.uiStore.selectConversation(conversationId)
    navigate(`${neUiKitRouterPath.chat}?conversationId=${conversationId}&anchorMessageClientId=${msg.messageClientId}`)
  }

  const loadMore = () => {
    setVisibleCount((count) => Math.min(count + PAGE_SIZE, pinInfos.length))
  }

  return (
    <div className="pin-list-wrapper">
      <NavBar title={t('pinText')} />
      {loading ? (
        <div className="pin-list-loading">{t('loadingMoreText')}</div>
      ) : pinInfos.length === 0 ? (
        <Empty text={t('noPinListText')} />
      ) : (
        <div className="pin-list">
          {visiblePins.map((pinInfo) => {
            const msg = getPinMessage(pinInfo)
            if (!msg) return null
            const senderName = store.uiStore.getAppellation({
              account: msg.senderId,
              teamId: conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ? targetId : ''
            })

            return (
              <div className="pin-list-item" key={msg.messageClientId}>
                <div className="pin-list-item-top" onClick={() => openChatAtMessage(msg)}>
                  <Avatar account={msg.senderId} teamId={targetId} size={40} />
                  <div className="pin-list-item-main">
                    <div className="pin-list-item-name">{senderName}</div>
                    <div className="pin-list-item-time">{formatPinTime(msg.createTime)}</div>
                  </div>
                  <div className="pin-list-more" onClick={(e) => { e.stopPropagation(); setActionMsgId(msg.messageClientId) }}>
                    <Icon type="icon-More" size={22} />
                  </div>
                </div>
                <div className="pin-message-preview-wrapper" onClick={(e) => e.stopPropagation()}>
                  <PinMessagePreview msg={msg} />
                </div>
              </div>
            )
          })}
          {visibleCount < pinInfos.length && (
            <div className="pin-list-load-more" onClick={loadMore}>
              {t('viewMoreText')}
            </div>
          )}
        </div>
      )}
      <BottomPopup visible={!!actionMsg} showHeader={false} showCancel={false} showConfirm={false} onCancel={closeActionPopup} onClose={closeActionPopup} className="pin-list-action-popup">
        {actionMsg && (
          <div className="pin-list-action-sheet">
            <div className="pin-list-action-group">
              <div className="pin-list-action" onClick={() => handleUnpin(actionMsg)}>
                {t('unpinText')}
              </div>
              {actionMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT && (
                <div className="pin-list-action" onClick={() => handleActionCopy(actionMsg)}>
                  {t('copyText')}
                </div>
              )}
              {actionMsg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO && (
                <div className="pin-list-action" onClick={() => handleActionForward(actionMsg)}>
                  {t('forwardText')}
                </div>
              )}
            </div>
            <div className="pin-list-action-cancel" onClick={closeActionPopup}>
              {t('cancelText')}
            </div>
          </div>
        )}
      </BottomPopup>
      {forwardMsgId && (
        <MessageForward
          visible={!!forwardMsgId}
          msgIdClient={forwardMsgId}
          conversationId={conversationId}
          msg={forwardMsg}
          onClose={() => {
            setForwardMsgId('')
            setForwardMsg(undefined)
          }}
        />
      )}
    </div>
  )
})

export default PinList
