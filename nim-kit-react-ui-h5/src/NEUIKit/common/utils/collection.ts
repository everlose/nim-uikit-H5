import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import type { V2NIMAddCollectionParams, V2NIMCollection, V2NIMMessage } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'

export const COLLECTION_LIMIT_ERROR_CODE = 189301

export interface MessageCollectionItem {
  collection: V2NIMCollection
  msg: V2NIMMessageForUI
  collectionTime: number
}

export interface MessageCollectionConverter {
  messageSerialization: (message: V2NIMMessage) => string | null
  messageDeserialization: (message: string) => V2NIMMessage | null
}

const SUCCESS_SENDING_STATES = new Set([
  V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
  V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_UNKNOWN
])

const COLLECTABLE_MESSAGE_TYPES = new Set([
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_LOCATION,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TIPS,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_ROBOT
])

export const isCollectionLimitError = (error: unknown) => {
  const err = error as { code?: number; errorCode?: number; messageStatus?: { errorCode?: number } }
  return err?.code === COLLECTION_LIMIT_ERROR_CODE || err?.errorCode === COLLECTION_LIMIT_ERROR_CODE || err?.messageStatus?.errorCode === COLLECTION_LIMIT_ERROR_CODE
}

export const canCollectMessage = (msg: V2NIMMessageForUI) => {
  if (!msg || msg.recallType || msg.isDelete) return false
  if (!SUCCESS_SENDING_STATES.has(msg.sendingState)) return false
  return COLLECTABLE_MESSAGE_TYPES.has(msg.messageType)
}

export const getCollectionUniqueId = (msg: V2NIMMessageForUI) => {
  return msg.messageServerId || `${msg.conversationId}_${msg.messageClientId}`
}

export const getMessageCollectionConverter = (nim: unknown): MessageCollectionConverter | null => {
  return ((nim as { V2NIMMessageConverter?: MessageCollectionConverter })?.V2NIMMessageConverter) || null
}

export const createMessageCollectionParams = (
  msg: V2NIMMessageForUI,
  converter: MessageCollectionConverter,
  extra?: {
    conversationName?: string
    senderName?: string
    avatar?: string
  }
): V2NIMAddCollectionParams => {
  const serializedMsg = converter.messageSerialization(msg)
  if (!serializedMsg) {
    throw new Error('Message serialization failed')
  }

  return {
    collectionType: msg.messageType + 1000,
    collectionData: JSON.stringify({
      message: serializedMsg,
      conversationName: extra?.conversationName || '',
      senderName: extra?.senderName || '',
      avatar: extra?.avatar || '',
    }),
    uniqueId: getCollectionUniqueId(msg),
  }
}

const isValidMessage = (msg: unknown): msg is V2NIMMessageForUI => {
  const m = msg as V2NIMMessageForUI | null | undefined
  return !!(m?.messageClientId && m.conversationId && typeof m.messageType === 'number')
}

const tryParseAppFormat = (collectionData: string, converter?: MessageCollectionConverter | null): V2NIMMessage | null => {
  try {
    const payload = JSON.parse(collectionData || '{}')
    const rawMsg = payload?.message
    if (!rawMsg) return null

    const msg = typeof rawMsg === 'string'
      ? converter?.messageDeserialization(rawMsg)
      : rawMsg

    return isValidMessage(msg) ? msg : null
  } catch {
    return null
  }
}

const tryParseH5Format = (collectionData: string, converter?: MessageCollectionConverter | null): V2NIMMessage | null => {
  const msg = converter?.messageDeserialization(collectionData || '')
  return isValidMessage(msg) ? msg : null
}

export const parseMessageCollection = (collection: V2NIMCollection, converter?: MessageCollectionConverter | null): MessageCollectionItem | null => {
  // Try App format first — collectionData is {"message": "<serialized>", "conversationName": ..., "senderName": ..., "avatar": ...}
  const msg = tryParseAppFormat(collection.collectionData || '', converter)
    || tryParseH5Format(collection.collectionData || '', converter)

  if (!msg) return null

  return {
    collection,
    msg,
    collectionTime: collection.createTime || collection.updateTime || msg.createTime || 0,
  }
}

export const normalizeMessageCollections = (collections: V2NIMCollection[], converter?: MessageCollectionConverter | null) => {
  return collections
    .map((collection) => parseMessageCollection(collection, converter))
    .filter((item): item is MessageCollectionItem => !!item)
    .sort((a, b) => b.collectionTime - a.collectionTime)
}
