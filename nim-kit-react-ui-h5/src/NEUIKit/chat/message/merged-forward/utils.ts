import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessage } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import type RootStore from '@xkit-yx/im-store-v2/dist/types/src'
import type { NIM } from 'nim-web-sdk-ng/dist/esm/nim'
import { getMsgContentTipByType } from '@/NEUIKit/common/utils/msg'
import { getFileMd5 } from '@/NEUIKit/common/utils'
import { isMessageStatusFailed } from '@/NEUIKit/chat/message/message-multi-select/utils'

export const MERGED_FORWARD_TYPE = 101
export const MERGED_FORWARD_LIMIT = 100
export const MERGED_FORWARD_MAX_DEPTH = 3

export interface MergedForwardAbstract {
  senderNick: string
  content: string
  userAccId: string
}

export interface MergedForwardPayload {
  type: typeof MERGED_FORWARD_TYPE
  data: {
    abstracts?: MergedForwardAbstract[]
    depth?: number
    md5?: string
    sessionId?: string
    sessionName?: string
    url?: string
  }
}

export const parseMergedForwardPayload = (msg?: {
  messageType?: V2NIMConst.V2NIMMessageType
  attachment?: unknown
  content?: unknown
  text?: string
}): MergedForwardPayload | undefined => {
  if (!msg || msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM) return undefined

  const candidates = [(msg.attachment as any)?.raw, (msg as any).content, msg.text]

  for (const candidate of candidates) {
    if (!candidate) continue
    let payload = candidate
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        payload = undefined
      }
    }

    if (payload && typeof payload === 'object' && payload.type === MERGED_FORWARD_TYPE) {
      return payload as MergedForwardPayload
    }
  }

  return undefined
}

export const getMergedForwardDepth = (msg: V2NIMMessageForUI): number => {
  const payload = parseMergedForwardPayload(msg)
  return Number(payload?.data?.depth || 0)
}

export const isMergedForwardMsg = (store: RootStore, msg: V2NIMMessageForUI): boolean => {
  return !!store.msgStore.isChatMergedForwardMsg(msg)
}

export const isMergeForwardableMessage = (store: RootStore, msg: V2NIMMessageForUI): boolean => {
  if (
    !msg ||
    msg.recallType ||
    msg.sendingState !== V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED ||
    isMessageStatusFailed(msg) ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION
  ) {
    return false
  }

  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM) {
    return isMergedForwardMsg(store, msg) && getMergedForwardDepth(msg) < MERGED_FORWARD_MAX_DEPTH
  }

  return (
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL
  )
}

export const getSourceSessionInfo = (store: RootStore, nim: NIM, conversationId: string) => {
  const sessionId = nim.V2NIMConversationIdUtil.parseConversationTargetId(conversationId)
  const conversationType = nim.V2NIMConversationIdUtil.parseConversationType(conversationId) as unknown as V2NIMConst.V2NIMConversationType
  const sessionName =
    conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
      ? store.teamStore.teams.get(sessionId)?.name || sessionId
      : store.userStore.users.get(sessionId)?.name || sessionId

  return {
    sessionId,
    sessionName
  }
}

export const getMergedForwardAbstracts = (store: RootStore, msgs: V2NIMMessageForUI[], chatHistoryText: string): MergedForwardAbstract[] => {
  return [...msgs]
    .sort((a, b) => a.createTime - b.createTime)
    .slice(0, 3)
    .map((msg) => {
      const senderId = (msg as any).__kit__senderId || msg.senderId
      const senderNick = store.userStore.users.get(senderId)?.name || senderId
      const content = getMsgContentTipByType({
        messageType: msg.messageType,
        attachment: msg.attachment,
        text: isMergedForwardMsg(store, msg) ? `[${chatHistoryText}]` : msg.text || ''
      })

      return {
        senderNick,
        content,
        userAccId: senderId
      }
    })
}

export const normalizeMergedForwardText = (mergeMsg: string): string => {
  return (mergeMsg || '').replace(/("12"\s*:\s*)(\d+)/g, '$1"$2"')
}

export const sendMergedForwardMessage = async ({
  store,
  nim,
  msgs,
  conversationId,
  sourceConversationId,
  appVersion,
  chatHistoryText,
  comment
}: {
  store: RootStore
  nim: NIM
  msgs: V2NIMMessageForUI[]
  conversationId: string
  sourceConversationId: string
  appVersion: string
  chatHistoryText: string
  comment?: string
}) => {
  const { content, depth } = store.msgStore.serializeMergeMsgs(msgs as unknown as V2NIMMessage[], {
    appVersion,
    sdkVersion: (nim as any).version || ''
  })
  const mergedMsgsFile = new File([content], 'mergedMsgs.txt', { type: 'text/plain' })
  const url = await store.storageStore.uploadFileActive(mergedMsgsFile)
  const md5 = await getFileMd5(mergedMsgsFile)
  const { sessionId, sessionName } = getSourceSessionInfo(store, nim, sourceConversationId)
  const payload: MergedForwardPayload = {
    type: MERGED_FORWARD_TYPE,
    data: {
      abstracts: getMergedForwardAbstracts(store, msgs, chatHistoryText),
      depth,
      md5,
      sessionId,
      sessionName,
      url
    }
  }
  const customMsg = nim.V2NIMMessageCreator.createCustomMessage(`[${chatHistoryText}]`, JSON.stringify(payload))

  await store.msgStore.sendMessageActive({
    msg: customMsg as unknown as V2NIMMessage,
    conversationId
  })

  if (comment) {
    const textMsg = nim.V2NIMMessageCreator.createTextMessage(comment)
    await store.msgStore.sendMessageActive({
      msg: textMsg as unknown as V2NIMMessage,
      conversationId
    })
  }
}
