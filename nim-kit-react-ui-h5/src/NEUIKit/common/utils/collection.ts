import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'
import type { V2NIMAddCollectionParams, V2NIMCollection, V2NIMMessage } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'

export const MESSAGE_COLLECTION_TYPE = 1
export const COLLECTION_LIMIT_ERROR_CODE = 189301

export interface MessageCollectionPayload {
  version: 1
  message: V2NIMMessageForUI
}

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

export const createMessageCollectionParams = (msg: V2NIMMessageForUI, converter: MessageCollectionConverter): V2NIMAddCollectionParams => {
  const collectionData = converter.messageSerialization(msg)
  if (!collectionData) {
    throw new Error('Message serialization failed')
  }

  return {
    collectionType: MESSAGE_COLLECTION_TYPE,
    collectionData,
    uniqueId: getCollectionUniqueId(msg)
  }
}

export const parseMessageCollection = (collection: V2NIMCollection, converter?: MessageCollectionConverter | null): MessageCollectionItem | null => {
  if (collection.collectionType !== MESSAGE_COLLECTION_TYPE) return null

  const serializedMsg = converter?.messageDeserialization(collection.collectionData || '')
  if (serializedMsg?.messageClientId && serializedMsg.conversationId && typeof serializedMsg.messageType === 'number') {
    return {
      collection,
      msg: serializedMsg as V2NIMMessageForUI,
      collectionTime: collection.createTime || collection.updateTime || serializedMsg.createTime || 0
    }
  }

  try {
    const payload = JSON.parse(collection.collectionData || '{}') as Partial<MessageCollectionPayload>
    const msg = payload.message
    if (!msg?.messageClientId || !msg.conversationId || typeof msg.messageType !== 'number') return null

    return {
      collection,
      msg,
      collectionTime: collection.createTime || collection.updateTime || msg.createTime || 0
    }
  } catch {
    return null
  }
}

export const normalizeMessageCollections = (collections: V2NIMCollection[], converter?: MessageCollectionConverter | null) => {
  return collections
    .map((collection) => parseMessageCollection(collection, converter))
    .filter((item): item is MessageCollectionItem => !!item)
    .sort((a, b) => b.collectionTime - a.collectionTime)
}
