import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMCollection, V2NIMCollectionOption, V2NIMMessageFileAttachment } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import NavBar from '@/NEUIKit/common/components/NavBar'
import Avatar from '@/NEUIKit/common/components/Avatar'
import Empty from '@/NEUIKit/common/components/Empty'
import Icon from '@/NEUIKit/common/components/Icon'
import BottomPopup from '@/NEUIKit/common/components/BottomPopup'
import PreviewImage from '@/NEUIKit/common/components/PreviewImage'
import PreviewText from '@/NEUIKit/common/components/PreviewText'
import MessageForward from '@/NEUIKit/chat/message/message-forward'
import MessageText from '@/NEUIKit/chat/message/message-text'
import MessageAudio from '@/NEUIKit/chat/message/message-audio'
import MessageFile from '@/NEUIKit/chat/message/message-file'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { copyText } from '@/NEUIKit/common/utils'
import { toast } from '@/NEUIKit/common/utils/toast'
import { showModal } from '@/NEUIKit/common/utils/modal'
import { getMsgContentTipByType } from '@/NEUIKit/common/utils/msg'
import { getMessageCollectionConverter, MESSAGE_COLLECTION_TYPE, MessageCollectionItem, normalizeMessageCollections } from '@/NEUIKit/common/utils/collection'
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from '@/NEUIKit/common/utils/image'
import './index.less'

const PAGE_SIZE = 20

const formatCollectionTime = (time: number) => {
  const date = new Date(time)
  const now = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()) {
    return `${hour}:${minute}`
  }
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`
}

const getAttachmentUrl = (msg?: V2NIMMessageForUI) => {
  const attachment = msg?.attachment as { url?: string } | undefined
  return attachment?.url || ''
}

const getCollectionImageThumbUrl = (msg?: V2NIMMessageForUI) => {
  const url = getAttachmentUrl(msg)
  const { width, height } = getImageAttachmentSize(msg?.attachment)
  return getImageThumbUrl(url, width, height)
}

const getCollectionImageStyle = (msg?: V2NIMMessageForUI) => {
  const { width, height } = getImageAttachmentSize(msg?.attachment)
  return getImageRenderStyle(width, height, 'compact')
}

const getVideoFirstFrameUrl = (msg?: V2NIMMessageForUI) => {
  const url = getAttachmentUrl(msg)
  return url ? `${url}${url.includes('?') ? '&' : '?'}vframe=1` : ''
}

const getFileDownloadUrl = (msg: V2NIMMessageForUI) => {
  const attachment = msg.attachment as V2NIMMessageFileAttachment | undefined
  const url = attachment?.url || ''
  if (!url) return ''
  const name = attachment?.name || ''
  return url + (url.includes('?') ? '&' : '?') + `download=${encodeURIComponent(name)}`
}

const Collection: React.FC = observer(() => {
  const { t } = useTranslation()
  const { store, nim } = useStateContext()
  const [items, setItems] = useState<MessageCollectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [actionCollectionId, setActionCollectionId] = useState('')
  const [forwardMsg, setForwardMsg] = useState<V2NIMMessageForUI>()
  const [previewMsg, setPreviewMsg] = useState<V2NIMMessageForUI>()
  const listRef = useRef<HTMLDivElement | null>(null)
  const lastCollectionRef = useRef<V2NIMCollection | undefined>()
  const loadingMoreRef = useRef(false)
  const converter = useMemo(() => getMessageCollectionConverter(nim), [nim])

  const actionItem = useMemo(() => items.find((item) => item.collection.collectionId === actionCollectionId), [actionCollectionId, items])

  const loadCollections = useCallback(async (isLoadMore = false) => {
    if ((isLoadMore && (!hasMore || loadingMoreRef.current)) || (!isLoadMore && loading)) return

    if (isLoadMore) {
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
      setLoading(true)
      setHasMore(true)
      lastCollectionRef.current = undefined
    }

    try {
      const option: V2NIMCollectionOption = {
        collectionType: MESSAGE_COLLECTION_TYPE,
        limit: PAGE_SIZE,
        direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC
      }

      if (isLoadMore && lastCollectionRef.current) {
        option.anchorCollection = lastCollectionRef.current
      }

      const collections = await store.msgStore.getCollectionListByOptionActive(option)
      lastCollectionRef.current = collections[collections.length - 1] || lastCollectionRef.current
      const nextItems = normalizeMessageCollections(collections, converter)

      setItems((prev) => (isLoadMore ? [...prev, ...nextItems] : nextItems))
      setHasMore(collections.length >= PAGE_SIZE)
    } catch {
      toast.info(t('getHistoryMsgFailedText'))
    } finally {
      if (isLoadMore) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [converter, hasMore, loading, store.msgStore, t])

  useEffect(() => {
    loadCollections()
  }, [])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el || loading || loadingMore || !hasMore) return

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      loadCollections(true)
    }
  }, [hasMore, loadCollections, loading, loadingMore])

  const closeActionPopup = () => {
    setActionCollectionId('')
  }

  const handleDelete = async (item: MessageCollectionItem) => {
    if (store.connectStore.loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      closeActionPopup()
      toast.info(t('offlineText'))
      return
    }

    closeActionPopup()
    showModal({
      title: t('deleteText'),
      content: t('deleteCollectionConfirmText'),
      confirmText: t('deleteText'),
      onConfirm: async () => {
        try {
          await store.msgStore.removeCollectionsActive([item.collection])
          setItems((list) => list.filter((collectionItem) => collectionItem.collection.collectionId !== item.collection.collectionId))
          toast.info(t('deleteMsgSuccessText'))
        } catch {
          toast.info(t('deleteCollectionFailedText'))
        }
      }
    })
  }

  const handleCopy = async (msg: V2NIMMessageForUI) => {
    try {
      if (msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT || !msg.text) {
        throw new Error('Unsupported copy message')
      }
      await copyText(msg.text)
      toast.info(t('copySuccessText'))
    } catch {
      toast.info(t('copyFailText'))
    } finally {
      closeActionPopup()
    }
  }

  const handleForward = (msg: V2NIMMessageForUI) => {
    if (store.connectStore.loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      toast.info(t('offlineText'))
      return
    }

    store.uiStore.selectConversation(msg.conversationId)
    setForwardMsg(msg)
    closeActionPopup()
  }

  const handleFileDownload = (msg: V2NIMMessageForUI) => {
    const url = getFileDownloadUrl(msg)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleItemClick = (msg: V2NIMMessageForUI) => {
    if (
      msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ||
      msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
      msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
    ) {
      setPreviewMsg(msg)
      return
    }

    if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE) {
      handleFileDownload(msg)
    }
  }

  const getConversationName = (msg: V2NIMMessageForUI) => {
    const conversationType = msg.conversationType || (nim.V2NIMConversationIdUtil.parseConversationType(msg.conversationId) as unknown as V2NIMConst.V2NIMConversationType)
    const targetId = nim.V2NIMConversationIdUtil.parseConversationTargetId(msg.conversationId)

    if (conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM) {
      return store.teamStore.teams.get(targetId)?.name || targetId
    }

    return store.uiStore.getAppellation({ account: targetId })
  }

  const getSenderName = (msg: V2NIMMessageForUI) => {
    const conversationType = msg.conversationType || (nim.V2NIMConversationIdUtil.parseConversationType(msg.conversationId) as unknown as V2NIMConst.V2NIMConversationType)
    const targetId = nim.V2NIMConversationIdUtil.parseConversationTargetId(msg.conversationId)
    return store.uiStore.getAppellation({
      account: msg.senderId,
      teamId: conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ? targetId : ''
    })
  }

  const renderMessagePreview = (msg: V2NIMMessageForUI) => {
    if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT) {
      return (
        <div className="collection-message-preview collection-message-preview-text">
          <MessageText msg={msg} />
        </div>
      )
    }

    if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE) {
      return <img className="collection-message-image" style={getCollectionImageStyle(msg)} src={getCollectionImageThumbUrl(msg)} alt="" />
    }

    if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE) {
      return (
        <div className="collection-file-preview" onClick={(e) => e.stopPropagation()}>
          <MessageFile msg={msg} />
        </div>
      )
    }

    if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO) {
      return (
        <div className="collection-audio-preview" onClick={(e) => e.stopPropagation()}>
          <div className="msg-bg msg-bg-in">
            <MessageAudio msg={msg} mode="audio-in" broadcastNewAudioSrc="" />
          </div>
        </div>
      )
    }

    if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO) {
      return (
        <div className="collection-video-message">
          <div className="collection-video-play-button">
            <div className="collection-video-play-icon"></div>
          </div>
          <img className="collection-video-cover" style={getCollectionImageStyle(msg)} src={getVideoFirstFrameUrl(msg)} alt="" />
        </div>
      )
    }

    return <div className="collection-message-preview">{getMsgContentTipByType(msg)}</div>
  }

  const renderPreviewOverlay = () => {
    if (!previewMsg) return null

    if (previewMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE) {
      return <PreviewImage visible={true} imageUrl={getAttachmentUrl(previewMsg)} onClose={() => setPreviewMsg(undefined)} />
    }

    if (previewMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO) {
      return (
        <div className="collection-preview-mask" onClick={() => setPreviewMsg(undefined)}>
          <div className="collection-video-preview" onClick={(e) => e.stopPropagation()}>
            <video src={getAttachmentUrl(previewMsg)} controls autoPlay />
            <div className="collection-preview-close" onClick={() => setPreviewMsg(undefined)}>×</div>
          </div>
        </div>
      )
    }

    return <PreviewText visible={true} msg={previewMsg} onClose={() => setPreviewMsg(undefined)} />
  }

  return (
    <div className="collection-wrapper">
      <NavBar title={t('collectionText')} />
      {loading ? (
        <div className="collection-loading">{t('loadingMoreText')}</div>
      ) : items.length === 0 ? (
        <Empty text={t('noCollectionsText')} />
      ) : (
        <div className="collection-list" ref={listRef} onScroll={handleScroll}>
          {items.map((item) => {
            const { msg } = item
            const targetId = nim.V2NIMConversationIdUtil.parseConversationTargetId(msg.conversationId)

            return (
              <div className="collection-list-item" key={item.collection.collectionId || item.collection.uniqueId} onClick={() => handleItemClick(msg)}>
                <div className="collection-list-item-header">
                  <Avatar account={msg.senderId} teamId={targetId} size={40} />
                  <div className="collection-list-item-meta">
                    <div className="collection-list-item-name">{getSenderName(msg)}</div>
                    <div className="collection-conversation-name">{t('collectionFromText')} {getConversationName(msg)}</div>
                  </div>
                  <div className="collection-list-more" onClick={(e) => { e.stopPropagation(); setActionCollectionId(item.collection.collectionId) }}>
                    <Icon type="icon-More" size={22} />
                  </div>
                </div>
                <div className="collection-list-item-content">{renderMessagePreview(msg)}</div>
                <div className="collection-list-item-time">{formatCollectionTime(item.collectionTime)}</div>
              </div>
            )
          })}
          {loadingMore && <div className="collection-load-more">{t('loadingMoreText')}</div>}
          {!hasMore && items.length > 0 && <div className="collection-load-more">{t('noMoreText')}</div>}
        </div>
      )}

      <BottomPopup visible={!!actionItem} showHeader={false} showCancel={false} showConfirm={false} onCancel={closeActionPopup} onClose={closeActionPopup} className="collection-action-popup">
        {actionItem && (
          <div className="collection-action-sheet">
            <div className="collection-action-group">
              <div className="collection-action" onClick={() => handleDelete(actionItem)}>
                {t('deleteText')}
              </div>
              {actionItem.msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT && (
                <div className="collection-action" onClick={() => handleCopy(actionItem.msg)}>
                  {t('copyText')}
                </div>
              )}
              <div className="collection-action" onClick={() => handleForward(actionItem.msg)}>
                {t('forwardText')}
              </div>
            </div>
            <div className="collection-action-cancel" onClick={closeActionPopup}>
              {t('cancelText')}
            </div>
          </div>
        )}
      </BottomPopup>

      {forwardMsg && (
        <MessageForward
          visible={!!forwardMsg}
          msgIdClient={forwardMsg.messageClientId}
          conversationId={forwardMsg.conversationId}
          msg={forwardMsg}
          onClose={() => setForwardMsg(undefined)}
        />
      )}

      {renderPreviewOverlay()}
    </div>
  )
})

export default Collection
