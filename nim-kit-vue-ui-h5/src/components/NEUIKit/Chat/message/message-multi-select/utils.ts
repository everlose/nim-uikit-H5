import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import {
  hasForwardableBaseState,
  isForwardableMergedCustomMessage,
  isForwardableMessageType,
} from "../merged-forward/utils";

export const MULTI_FORWARD_LIMIT = 10;
export const MULTI_DELETE_BATCH_SIZE = 50;

export const chunkMessages = <T>(messages: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    result.push(messages.slice(i, i + size));
  }
  return result;
};

export const getMessageSelectKey = (
  msg?: Pick<
    V2NIMMessageForUI,
    | "messageClientId"
    | "messageServerId"
    | "createTime"
    | "senderId"
    | "conversationId"
  >
) => {
  if (!msg) {
    return "";
  }
  if (msg.messageServerId && msg.messageServerId !== "0") {
    return `server-${msg.messageServerId}`;
  }
  if (msg.messageClientId) {
    return `client-${msg.messageClientId}`;
  }
  return `local-${msg.conversationId}-${msg.senderId}-${msg.createTime}`;
};

export const isSelectableMessage = (
  msg?: V2NIMMessageForUI & { timeValue?: number }
) => {
  return !!(
    msg &&
    msg.messageClientId &&
    !msg.timeValue &&
    !msg.recallType &&
    msg.messageType !==
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION
  );
};

export const isForwardableMessage = (store: any, msg: V2NIMMessageForUI) => {
  if (!isSelectableMessage(msg) || !hasForwardableBaseState(msg)) {
    return false;
  }
  if (
    msg.messageType ===
    V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM
  ) {
    return isForwardableMergedCustomMessage(store, msg);
  }
  return isForwardableMessageType(msg);
};

export const syncConversationLastMessageAfterDelete = (
  store: any,
  conversationId: string
) => {
  const msgs = store?.msgStore.getMsg(conversationId) || [];
  const enableV2CloudConversation = store?.sdkOptions?.enableV2CloudConversation;
  const conversation = enableV2CloudConversation
    ? store?.conversationStore?.conversations.get(conversationId)
    : store?.localConversationStore?.conversations.get(conversationId);

  if (!conversation) {
    return;
  }

  if (msgs.length > 0) {
    const lastMsg = msgs[msgs.length - 1];
    conversation.lastMessage = {
      ...conversation.lastMessage,
      messageRefer: {
        senderId: lastMsg.senderId,
        receiverId: lastMsg.receiverId,
        messageClientId: lastMsg.messageClientId,
        messageServerId: lastMsg.messageServerId,
        conversationId: lastMsg.conversationId,
        conversationType: lastMsg.conversationType,
        createTime: lastMsg.createTime,
      },
      messageType: lastMsg.messageType,
      subType: lastMsg.subType,
      sendingState: lastMsg.sendingState,
      text: lastMsg.text,
      attachment: lastMsg.attachment,
      serverExtension: lastMsg.serverExtension,
      callbackExtension: lastMsg.callbackExtension,
      lastMessageState:
        V2NIMConst.V2NIMLastMessageState.V2NIM_MESSAGE_STATUS_DEFAULT,
    };
  } else {
    conversation.lastMessage = undefined;
  }
};
