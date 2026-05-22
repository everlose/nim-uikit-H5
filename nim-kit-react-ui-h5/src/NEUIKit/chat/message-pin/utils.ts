import { V2NIMConst } from 'nim-web-sdk-ng/dist/esm/nim'
import type { V2NIMMessageRefer } from 'nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService'
import type { V2NIMMessageForUI } from '@xkit-yx/im-store-v2/dist/types/src/types'

export const isMessagePinned = (msg?: Pick<V2NIMMessageForUI, 'pinState'>) => {
  return msg?.pinState === V2NIMConst.V2NIMMessagePinState.V2NIM_MESSAGE_PIN_STATE_PINNED || !!msg?.pinState
}

export const getMessageRefer = (msg: V2NIMMessageForUI): V2NIMMessageRefer => ({
  senderId: msg.senderId,
  receiverId: msg.receiverId,
  messageClientId: msg.messageClientId,
  messageServerId: msg.messageServerId,
  createTime: msg.createTime,
  conversationType: msg.conversationType,
  conversationId: msg.conversationId
})

export const canOperatePin = (msg: V2NIMMessageForUI) => {
  return (
    !!msg.messageClientId &&
    !!msg.messageServerId &&
    !msg.recallType &&
    msg.messageType !== V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
    msg.sendingState === V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED
  )
}

export const getPinOperatorId = (msg: V2NIMMessageForUI, pinInfoMap?: Map<string, any> | null) => {
  return msg.operatorId || pinInfoMap?.get(msg.messageClientId)?.operatorId || ''
}
