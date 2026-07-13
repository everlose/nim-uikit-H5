import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMCollection, V2NIMCollectionOption, V2NIMMessageFileAttachment } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import NavBar from '@/NEUIKit/common/components/NavBar'
import Avatar from '@/NEUIKit/common/components/Avatar'
import Empty from '@/NEUIKit/common/components/Empty'
import Icon from '@/NEUIKit/common/components/Icon'
import ActionSheet from '@/NEUIKit/common/components/ActionSheet'
import PreviewImage from '@/NEUIKit/common/components/PreviewImage'
import PreviewText from '@/NEUIKit/common/components/PreviewText'
import MessageForward from '@/NEUIKit/chat/message/message-forward'
import MessageText from '@/NEUIKit/chat/message/message-text'
import MessageAudio from '@/NEUIKit/chat/message/message-audio'
import MessageFile from '@/NEUIKit/chat/message/message-file'
import MergedForwardModal from '@/NEUIKit/chat/message/merged-forward/modal'
import { useTranslation } from '@/NEUIKit/common/hooks/useTranslate'
import { useStateContext } from '@/NEUIKit/common/hooks/useStateContext'
import { copyText } from '@/NEUIKit/common/utils'
import { toast } from '@/NEUIKit/common/utils/toast'
import { showModal } from '@/NEUIKit/common/utils/modal'
import { getMsgContentTipByType } from '@/NEUIKit/common/utils/msg'
import { getMessageCollectionConverter, MessageCollectionItem, normalizeMessageCollections } from '@/NEUIKit/common/utils/collection'
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from '@/NEUIKit/common/utils/image'
import { normalizeMergedForwardText, parseMergedForwardPayload } from '@/NEUIKit/chat/message/merged-forward/utils'
import dayjs from 'dayjs'
import './index.less'

const PAGE_SIZE = 20

const formatCollectionTime = (time: number, t: (...args: any[]) => string) => {
  if (!time) return ''
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
  const [mergedMsgs, setMergedMsgs] = useState<V2NIMMessageForUI[]>([])
  const [mergedVisible, setMergedVisible] = useState(false)
  const [mergedForwardTitle, setMergedForwardTitle] = useState('')
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
      collectionType: 0,
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

  const handleOpenMergedForward = async (msg: V2NIMMessageForUI) => {
    const payload = parseMergedForwardPayload(msg)
    if (!payload?.data) return
    const data = payload.data
    const sessionName = data.sessionName || data.sessionId || ''
    const title = `${sessionName}${t('messageOfText')}`

    if (mergedMsgs.length) {
      setMergedForwardTitle(title)
      setMergedVisible(true)
      return
    }
    try {
      if (!data.url) throw new Error('url missing')
      const res = await fetch(data.url)
      if (!res.ok) throw new Error('fetch failed')
      const text = await res.text()
      const list = store.msgStore.deserializeMergeMsgs(normalizeMergedForwardText(text)) as V2NIMMessageForUI[]
      if (!list.length) throw new Error('deserialize failed')
      setMergedMsgs(list)
      setMergedForwardTitle(title)
      setMergedVisible(true)
    } catch {
      toast.info(t('getMergedForwardFailedText'))
    }
  }

  const handleItemClick = (msg: V2NIMMessageForUI) => {
    if (parseMergedForwardPayload(msg)) {
      handleOpenMergedForward(msg)
      return
    }

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

    const mergedPayload = parseMergedForwardPayload(msg)
    if (mergedPayload) {
      const data = mergedPayload.data
      const sessionName = data?.sessionName || data?.sessionId || ''
      return (
        <div className="collection-merged-card">
          <div className="collection-merged-title">{sessionName}{t('messageOfText')}</div>
          <div className="collection-merged-abstracts">
            {(data?.abstracts || []).map((item, index) => (
              <div key={index}>
                <span className="collection-merged-sender">{item.senderNick}: </span>
                <span>{item.content}</span>
              </div>
            ))}
          </div>
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
        <div className="collection-preview-mask">
          <div className="collection-video-preview">
            <video src={getAttachmentUrl(previewMsg)} controls autoPlay />
          </div>
          <button className="collection-preview-close" onClick={() => setPreviewMsg(undefined)} type="button" aria-label="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="14" fill="#4C4C4C"/>
              <line x1="9" y1="9" x2="18.5" y2="18.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <line x1="19" y1="9" x2="9.5" y2="18.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )
    }

    return <PreviewText visible={true} msg={previewMsg} onClose={() => setPreviewMsg(undefined)} />
  }

  return (
    <div className="collection-wrapper">
      <NavBar title={t('collectionText')} backgroundColor="transparent" />
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
                <div className="collection-list-item-time">{formatCollectionTime(item.collectionTime, t)}</div>
              </div>
            )
          })}
          {loadingMore && <div className="collection-load-more">{t('loadingMoreText')}</div>}
          {!hasMore && items.length > 0 && <div className="collection-load-more">{t('noMoreText')}</div>}
        </div>
      )}

      <ActionSheet
        visible={!!actionItem}
        actions={actionItem ? [
          { text: t('deleteText'), onClick: () => handleDelete(actionItem) },
          ...(actionItem.msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ? [{ text: t('copyText'), onClick: () => handleCopy(actionItem.msg) }] : []),
          ...(actionItem.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO && actionItem.msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL ? [{ text: t('forwardText'), onClick: () => handleForward(actionItem.msg) }] : []),
        ] : []}
        onClose={closeActionPopup}
      />

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

      <MergedForwardModal visible={mergedVisible} title={mergedForwardTitle} msgs={mergedMsgs} onClose={() => setMergedVisible(false)} />
    </div>
  )
})

export default Collection
