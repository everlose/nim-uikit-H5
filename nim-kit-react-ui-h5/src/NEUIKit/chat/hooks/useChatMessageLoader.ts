import { useCallback, useEffect, useRef, useState } from 'react'
import { autorun } from 'mobx'
import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import { HISTORY_LIMIT } from '@/NEUIKit/common/utils/constants'

const ANCHOR_HISTORY_LIMIT = 10

interface UseChatMessageLoaderOptions {
  conversationId: string
  anchorMessageClientId?: string
  loginStatus: V2NIMConst.V2NIMLoginStatus
  store: any
  nim: any
  onHistoryMessagesLoaded?: (messages: V2NIMMessageForUI[]) => void | Promise<void>
  onError?: (error: any) => void
}

const mergeMessages = (messages: V2NIMMessageForUI[]) => {
  const map = new Map<string, V2NIMMessageForUI>()
  messages.forEach((item) => {
    map.set(item.messageClientId, item)
  })
  return [...map.values()].sort((a, b) => a.createTime - b.createTime)
}

export const useChatMessageLoader = ({
  conversationId,
  anchorMessageClientId = '',
  loginStatus,
  store,
  nim,
  onHistoryMessagesLoaded,
  onError
}: UseChatMessageLoaderOptions) => {
  const [msgs, setMsgs] = useState<V2NIMMessageForUI[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadingNewer, setLoadingNewer] = useState(false)
  const [hasOlder, setHasOlder] = useState(true)
  const [hasNewer, setHasNewer] = useState(false)
  const [anchorMode, setAnchorMode] = useState(false)
  const [hasLoadedLatest, setHasLoadedLatest] = useState(false)
  const [showLatestHint, setShowLatestHint] = useState(false)
  const onHistoryMessagesLoadedRef = useRef(onHistoryMessagesLoaded)
  const onErrorRef = useRef(onError)
  const loadingOlderRef = useRef(false)
  const loadingNewerRef = useRef(false)
  const hasOlderRef = useRef(true)
  const hasNewerRef = useRef(false)
  const hasLoadedLatestRef = useRef(false)
  const anchorModeRef = useRef(false)
  const hasLoadedInitialRef = useRef(false)
  const prevLoginStatusRef = useRef(loginStatus)
  const prevConversationIdRef = useRef(conversationId)

  const setLoadingOlderState = (value: boolean) => {
    loadingOlderRef.current = value
    setLoadingOlder(value)
  }

  const setLoadingNewerState = (value: boolean) => {
    loadingNewerRef.current = value
    setLoadingNewer(value)
  }

  const setHasOlderState = (value: boolean) => {
    hasOlderRef.current = value
    setHasOlder(value)
  }

  const setHasNewerState = (value: boolean) => {
    hasNewerRef.current = value
    setHasNewer(value)
  }

  const setAnchorModeState = (value: boolean) => {
    anchorModeRef.current = value
    setAnchorMode(value)
  }

  const setHasLoadedLatestState = (value: boolean) => {
    hasLoadedLatestRef.current = value
    setHasLoadedLatest(value)
  }

  useEffect(() => {
    onHistoryMessagesLoadedRef.current = onHistoryMessagesLoaded
  }, [onHistoryMessagesLoaded])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const normalizeHistoryMsgs = useCallback(
    (messages: V2NIMMessageForUI[]) => {
      const pinMap = store.msgStore.pinMsgs.map.get(conversationId)
      return messages
        .map((item) => {
          if (pinMap?.has(item.messageClientId)) {
            return store.msgStore.handleMsgPinState({ ...item }, pinMap)
          }
          return {
            ...item,
            pinState: 0,
            operatorId: undefined
          }
        })
        .sort((a, b) => a.createTime - b.createTime)
    },
    [conversationId, store]
  )

  const getConversationLastMessage = useCallback(() => {
    const conversationStore = store.sdkOptions?.enableV2CloudConversation ? store.conversationStore : store.localConversationStore
    return conversationStore?.conversations.get(conversationId)?.lastMessage
  }, [conversationId, store])

  const containsLastMessage = useCallback(
    (messages: V2NIMMessageForUI[]) => {
      const lastMessage = getConversationLastMessage()
      if (!lastMessage) return false

      const refer = lastMessage.messageRefer
      return messages.some((msg) => {
        if (refer?.messageClientId && msg.messageClientId === refer.messageClientId) return true
        if (refer?.messageServerId && msg.messageServerId === refer.messageServerId) return true
        return msg.messageClientId === lastMessage.messageClientId || msg.messageServerId === lastMessage.messageServerId
      })
    },
    [getConversationLastMessage]
  )

  const updateLatestStateByMessages = useCallback(
    (messages: V2NIMMessageForUI[]) => {
      if (messages.length === 0 || containsLastMessage(messages)) {
        setHasNewerState(false)
        setHasLoadedLatestState(true)
        setShowLatestHint(false)
      }
    },
    [containsLastMessage]
  )

  const syncLoadedMessagesFromStore = useCallback(
    (loadedMessages: V2NIMMessageForUI[]) => {
      if (!conversationId || !loadedMessages.length) return

      const messageClientIds = loadedMessages.map((item) => item.messageClientId).filter(Boolean)
      const storeMsgs = (store.msgStore.getMsg(conversationId, messageClientIds) || []) as V2NIMMessageForUI[]
      if (!storeMsgs.length) return

      const storeMsgMap = new Map<string, V2NIMMessageForUI>(storeMsgs.map((item) => [item.messageClientId, item]))
      setMsgs((list) => mergeMessages(list.map((item) => storeMsgMap.get(item.messageClientId) || item)))
    },
    [conversationId, store]
  )

  const notifyHistoryMessagesLoaded = useCallback(
    async (loadedMessages: V2NIMMessageForUI[]) => {
      if (!loadedMessages.length) return
      await onHistoryMessagesLoadedRef.current?.(loadedMessages)
      if (anchorModeRef.current) {
        syncLoadedMessagesFromStore(loadedMessages)
      }
    },
    [syncLoadedMessagesFromStore]
  )

  const refreshLocalPinState = useCallback(() => {
    if (!conversationId) return
    const pinMap = store.msgStore.pinMsgs.map.get(conversationId)
    const currentMsgs = store.msgStore.getMsg(conversationId) || []
    if (!currentMsgs.length) return

    const nextMsgs = currentMsgs.map((msg: V2NIMMessageForUI) => {
      if (pinMap?.has(msg.messageClientId)) {
        return store.msgStore.handleMsgPinState({ ...msg }, pinMap)
      }
      return {
        ...msg,
        pinState: 0,
        operatorId: undefined
      }
    })

    nextMsgs.forEach((msg: V2NIMMessageForUI) => {
      store.msgStore.updateMsg(conversationId, msg.messageClientId, {
        pinState: msg.pinState,
        operatorId: msg.operatorId
      })
    })
    setMsgs((list) => {
      if (!anchorModeRef.current) return nextMsgs
      const nextMsgMap = new Map(nextMsgs.map((msg: V2NIMMessageForUI) => [msg.messageClientId, msg]))
      return list.map((msg) => nextMsgMap.get(msg.messageClientId) || msg)
    })
  }, [conversationId, store])

  const syncPinnedMessageList = useCallback(async (forceUpdate = false) => {
    if (!conversationId) return
    try {
      await (store.msgStore.getPinnedMessageListActive as (conversationId: string, forceUpdate?: boolean) => Promise<unknown>)(conversationId, forceUpdate)
      refreshLocalPinState()
    } catch (error) {
      console.error('Get pinned message list failed', error)
    }
  }, [conversationId, refreshLocalPinState, store])

  const getAnchorMessage = useCallback(async () => {
    if (!anchorMessageClientId || !conversationId) return undefined

    const localMsg = store.msgStore.getMsg(conversationId, [anchorMessageClientId])?.[0]
    if (localMsg) return localMsg

    const pinInfo = store.msgStore.pinMsgs.map.get(conversationId)?.get(anchorMessageClientId)
    if (pinInfo?.message) return pinInfo.message as V2NIMMessageForUI

    if (pinInfo?.messageRefer) {
      const result = await nim.V2NIMMessageService.getMessageListByRefers([pinInfo.messageRefer])
      return result?.[0] as V2NIMMessageForUI | undefined
    }

    return undefined
  }, [anchorMessageClientId, conversationId, nim, store])

  const loadLatestHistory = useCallback(async () => {
    if (!conversationId || loadingOlderRef.current) return []
    setLoadingOlderState(true)
    try {
      const historyMsgs = await store.msgStore.getHistoryMsgActive({
        conversationId,
        endTime: Date.now(),
        limit: HISTORY_LIMIT
      })
      const normalizedMsgs = normalizeHistoryMsgs(historyMsgs || [])
      setHasOlderState(normalizedMsgs.length >= HISTORY_LIMIT)
      setHasNewerState(false)
      setAnchorModeState(false)
      setHasLoadedLatestState(true)
      setShowLatestHint(false)
      setMsgs(store.msgStore.getMsg(conversationId) || normalizedMsgs)
      await notifyHistoryMessagesLoaded(normalizedMsgs)
      return normalizedMsgs
    } finally {
      setLoadingOlderState(false)
    }
  }, [conversationId, normalizeHistoryMsgs, notifyHistoryMessagesLoaded, store])

  const loadAnchorHistory = useCallback(async () => {
    if (!anchorMessageClientId || !conversationId || loadingOlderRef.current) return false
    setLoadingOlderState(true)
    try {
      const anchorMessage = await getAnchorMessage()
      if (!anchorMessage) return false

      const [beforeMsgs, afterMsgs] = await Promise.all([
        nim.V2NIMMessageService.getMessageList({
          conversationId,
          anchorMessage,
          direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
          limit: ANCHOR_HISTORY_LIMIT
        }),
        nim.V2NIMMessageService.getMessageList({
          conversationId,
          anchorMessage,
          direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_ASC,
          limit: ANCHOR_HISTORY_LIMIT
        })
      ])

      const normalizedMsgs = normalizeHistoryMsgs([...(beforeMsgs || []), anchorMessage, ...(afterMsgs || [])])
      const mergedMsgs = mergeMessages(normalizedMsgs)
      const hasLoadedLatestNow = (afterMsgs || []).length === 0 || containsLastMessage([anchorMessage, ...(afterMsgs || [])])

      store.msgStore.addMsg(conversationId, mergedMsgs)
      setMsgs(mergedMsgs)
      setHasOlderState((beforeMsgs || []).length >= ANCHOR_HISTORY_LIMIT)
      setHasNewerState(!hasLoadedLatestNow && (afterMsgs || []).length >= ANCHOR_HISTORY_LIMIT)
      setAnchorModeState(true)
      setHasLoadedLatestState(hasLoadedLatestNow)
      setShowLatestHint(false)
      await notifyHistoryMessagesLoaded(mergedMsgs)
      return true
    } finally {
      setLoadingOlderState(false)
    }
  }, [anchorMessageClientId, containsLastMessage, conversationId, getAnchorMessage, nim, normalizeHistoryMsgs, notifyHistoryMessagesLoaded, store])

  const loadOlder = useCallback(
    async (firstMsg?: V2NIMMessageForUI) => {
      if (!conversationId || loadingOlderRef.current || !hasOlderRef.current) return []
      setLoadingOlderState(true)
      try {
        let historyMsgs: V2NIMMessageForUI[] = []
        if (anchorModeRef.current && firstMsg) {
          historyMsgs =
            (await nim.V2NIMMessageService.getMessageList({
              conversationId,
              anchorMessage: firstMsg,
              direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
              limit: HISTORY_LIMIT
            })) || []
        } else {
          historyMsgs =
            (await store.msgStore.getHistoryMsgActive({
              conversationId,
              endTime: firstMsg?.createTime || Date.now(),
              lastMsgId: firstMsg?.messageServerId,
              limit: HISTORY_LIMIT
            })) || []
        }

        const normalizedMsgs = normalizeHistoryMsgs(historyMsgs)
        setHasOlderState(normalizedMsgs.length >= HISTORY_LIMIT)
        if (normalizedMsgs.length) {
          store.msgStore.addMsg(conversationId, normalizedMsgs)
          setMsgs((list) => mergeMessages([...normalizedMsgs, ...list]))
          await notifyHistoryMessagesLoaded(normalizedMsgs)
        }
        return normalizedMsgs
      } finally {
        setLoadingOlderState(false)
      }
    },
    [conversationId, nim, normalizeHistoryMsgs, notifyHistoryMessagesLoaded, store]
  )

  const loadNewer = useCallback(
    async (lastMsg?: V2NIMMessageForUI) => {
      if (!anchorModeRef.current || loadingNewerRef.current || !lastMsg || !hasNewerRef.current) return []
      setLoadingNewerState(true)
      try {
        const newerMsgs =
          (await nim.V2NIMMessageService.getMessageList({
            conversationId,
            anchorMessage: lastMsg,
            direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_ASC,
            limit: HISTORY_LIMIT
          })) || []
        const normalizedMsgs = normalizeHistoryMsgs(newerMsgs)

        if (normalizedMsgs.length) {
          store.msgStore.addMsg(conversationId, normalizedMsgs)
          setMsgs((list) => mergeMessages([...list, ...normalizedMsgs]))
          await notifyHistoryMessagesLoaded(normalizedMsgs)
        }
        if (normalizedMsgs.length === 0 || normalizedMsgs.length < HISTORY_LIMIT || containsLastMessage(normalizedMsgs)) {
          updateLatestStateByMessages(normalizedMsgs)
        }
        return normalizedMsgs
      } finally {
        setLoadingNewerState(false)
      }
    },
    [containsLastMessage, conversationId, nim, normalizeHistoryMsgs, notifyHistoryMessagesLoaded, store, updateLatestStateByMessages]
  )

  const switchToLatest = useCallback(async () => {
    setLoadingNewerState(true)
    try {
      return await loadLatestHistory()
    } finally {
      setLoadingNewerState(false)
    }
  }, [loadLatestHistory])

  const handleIncomingMessages = useCallback(
    (messages: V2NIMMessageForUI[]) => {
      if (!conversationId || !messages.length) return false
      const currentMessages = normalizeHistoryMsgs(messages.filter((item) => item.conversationId === conversationId))
      if (!currentMessages.length) return false

      if (!anchorModeRef.current) {
        return true
      }

      if (hasLoadedLatestRef.current) {
        setMsgs((list) => mergeMessages([...list, ...currentMessages]))
      } else {
        setShowLatestHint(true)
      }
      return false
    },
    [conversationId, normalizeHistoryMsgs]
  )

  useEffect(() => {
    const dispose = autorun(() => {
      if (!conversationId) return
      const storeMsgs = store.msgStore.getMsg(conversationId) || []
      if (anchorModeRef.current) {
        const normalizedStoreMsgs = normalizeHistoryMsgs(storeMsgs)
        const storeMsgMap = new Map(normalizedStoreMsgs.map((msg: V2NIMMessageForUI) => [msg.messageClientId, msg]))
        setMsgs((list) => {
          const syncedList = list.filter((msg) => storeMsgMap.has(msg.messageClientId)).map((msg) => storeMsgMap.get(msg.messageClientId) || msg)
          return hasLoadedLatestRef.current ? mergeMessages([...syncedList, ...normalizedStoreMsgs]) : syncedList
        })
        return
      }
      setMsgs(storeMsgs)
    })

    return () => dispose()
  }, [conversationId, normalizeHistoryMsgs, store])

  useEffect(() => {
    if (loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED) {
      prevLoginStatusRef.current = loginStatus
    }
  }, [loginStatus])

  useEffect(() => {
    if (loginStatus !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED || !conversationId) return

    let canceled = false
    const loadInitialMessages = async () => {
      const forceUpdatePinList = hasLoadedInitialRef.current && prevLoginStatusRef.current !== V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
      await syncPinnedMessageList(forceUpdatePinList)
      const loadedAnchor = anchorMessageClientId ? await loadAnchorHistory() : false
      if (!canceled && (!anchorMessageClientId || !loadedAnchor)) {
        await loadLatestHistory()
      }
      hasLoadedInitialRef.current = true
      prevLoginStatusRef.current = loginStatus
    }

    const conversationChanged = prevConversationIdRef.current !== conversationId
    if (conversationChanged || !hasLoadedInitialRef.current) {
      setMsgs([])
    }
    setHasOlderState(true)
    setHasNewerState(false)
    setAnchorModeState(false)
    setHasLoadedLatestState(false)
    setShowLatestHint(false)

    loadInitialMessages().catch((error) => {
      if (!canceled) onErrorRef.current?.(error)
    })

    return () => {
      canceled = true
      prevConversationIdRef.current = conversationId
    }
  }, [anchorMessageClientId, conversationId, loadAnchorHistory, loadLatestHistory, loginStatus, syncPinnedMessageList])

  return {
    msgs,
    loadingOlder,
    loadingNewer,
    hasOlder,
    hasNewer,
    anchorMode,
    hasLoadedLatest,
    showLatestHint,
    loadOlder,
    loadNewer,
    switchToLatest,
    handleIncomingMessages
  }
}
