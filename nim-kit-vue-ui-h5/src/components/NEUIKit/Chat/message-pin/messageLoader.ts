import { ref, watch, type Ref } from "vue";
import { autorun } from "mobx";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import { HISTORY_LIMIT } from "../../utils/constants";

const ANCHOR_HISTORY_LIMIT = 10;

export interface ChatMessageLoaderOptions {
  conversationId: string;
  anchorMessageClientId?: string;
  loginStatus: Ref<V2NIMConst.V2NIMLoginStatus>;
  store: any;
  nim: any;
  onHistoryMessagesLoaded?: (
    messages: V2NIMMessageForUI[]
  ) => void | Promise<void>;
  onError?: (error: any) => void;
}

const mergeMessages = (messages: V2NIMMessageForUI[]) => {
  const map = new Map<string, V2NIMMessageForUI>();
  messages.forEach((item) => {
    map.set(item.messageClientId, item);
  });
  return [...map.values()].sort((a, b) => a.createTime - b.createTime);
};

export const createChatMessageLoader = ({
  conversationId,
  anchorMessageClientId = "",
  loginStatus,
  store,
  nim,
  onHistoryMessagesLoaded,
  onError,
}: ChatMessageLoaderOptions) => {
  const msgs = ref<V2NIMMessageForUI[]>([]);
  const loadingOlder = ref(false);
  const loadingNewer = ref(false);
  const hasOlder = ref(true);
  const hasNewer = ref(false);
  const anchorMode = ref(false);
  const hasLoadedLatest = ref(false);
  const showLatestHint = ref(false);
  const hasLoadedInitial = ref(false);
  let prevLoginStatus = loginStatus.value;
  let canceled = false;

  const normalizeHistoryMsgs = (messages: V2NIMMessageForUI[]) => {
    const pinMap = store.msgStore.pinMsgs.map.get(conversationId);
    return messages
      .map((item) => {
        if (pinMap?.has(item.messageClientId)) {
          return store.msgStore.handleMsgPinState({ ...item }, pinMap);
        }
        return {
          ...item,
          pinState: 0,
          operatorId: undefined,
        };
      })
      .sort((a, b) => a.createTime - b.createTime);
  };

  const getConversationLastMessage = () => {
    const conversationStore = store.sdkOptions?.enableV2CloudConversation
      ? store.conversationStore
      : store.localConversationStore;
    return conversationStore?.conversations.get(conversationId)?.lastMessage;
  };

  const containsLastMessage = (messages: V2NIMMessageForUI[]) => {
    const lastMessage = getConversationLastMessage();
    if (!lastMessage) {
      return false;
    }

    const refer = lastMessage.messageRefer;
    return messages.some((msg) => {
      if (
        refer?.messageClientId &&
        msg.messageClientId === refer.messageClientId
      ) {
        return true;
      }
      if (
        refer?.messageServerId &&
        msg.messageServerId === refer.messageServerId
      ) {
        return true;
      }
      return (
        msg.messageClientId === lastMessage.messageClientId ||
        msg.messageServerId === lastMessage.messageServerId
      );
    });
  };

  const updateLatestStateByMessages = (messages: V2NIMMessageForUI[]) => {
    if (messages.length === 0 || containsLastMessage(messages)) {
      hasNewer.value = false;
      hasLoadedLatest.value = true;
      showLatestHint.value = false;
    }
  };

  const syncLoadedMessagesFromStore = (loadedMessages: V2NIMMessageForUI[]) => {
    if (!conversationId || !loadedMessages.length) {
      return;
    }

    const messageClientIds = loadedMessages
      .map((item) => item.messageClientId)
      .filter(Boolean);
    const storeMsgs =
      store.msgStore.getMsg(conversationId, messageClientIds) || [];
    if (!storeMsgs.length) {
      return;
    }

    const storeMsgMap = new Map<string, V2NIMMessageForUI>(
      storeMsgs.map((item: V2NIMMessageForUI) => [item.messageClientId, item])
    );
    msgs.value = mergeMessages(
      msgs.value.map((item) => storeMsgMap.get(item.messageClientId) || item)
    );
  };

  const notifyHistoryMessagesLoaded = async (
    loadedMessages: V2NIMMessageForUI[]
  ) => {
    if (!loadedMessages.length) {
      return;
    }
    await onHistoryMessagesLoaded?.(loadedMessages);
    if (anchorMode.value) {
      syncLoadedMessagesFromStore(loadedMessages);
    }
  };

  const refreshLocalPinState = () => {
    if (!conversationId) {
      return;
    }
    const pinMap = store.msgStore.pinMsgs.map.get(conversationId);
    const currentMsgs = store.msgStore.getMsg(conversationId) || [];
    if (!currentMsgs.length) {
      return;
    }

    const nextMsgs = currentMsgs.map((msg: V2NIMMessageForUI) => {
      if (pinMap?.has(msg.messageClientId)) {
        return store.msgStore.handleMsgPinState({ ...msg }, pinMap);
      }
      return {
        ...msg,
        pinState: 0,
        operatorId: undefined,
      };
    });

    if (!anchorMode.value) {
      msgs.value = nextMsgs;
      return;
    }

    const nextMsgMap = new Map<string, V2NIMMessageForUI>(
      nextMsgs.map((msg: V2NIMMessageForUI) => [msg.messageClientId, msg])
    );
    msgs.value = msgs.value.map(
      (msg) => nextMsgMap.get(msg.messageClientId) || msg
    );
  };

  const syncPinnedMessageList = async (forceUpdate = false) => {
    if (!conversationId) {
      return;
    }
    try {
      await store.msgStore.getPinnedMessageListActive(
        conversationId,
        forceUpdate
      );
      refreshLocalPinState();
    } catch (error) {
      console.error("Get pinned message list failed", error);
    }
  };

  const getAnchorMessage = async () => {
    if (!anchorMessageClientId || !conversationId) {
      return undefined;
    }

    const localMsg = store.msgStore.getMsg(conversationId, [
      anchorMessageClientId,
    ])?.[0];
    if (localMsg) {
      return localMsg;
    }

    const pinInfo = store.msgStore.pinMsgs
      .map
      .get(conversationId)
      ?.get(anchorMessageClientId);
    if (pinInfo?.message) {
      return pinInfo.message as V2NIMMessageForUI;
    }

    if (pinInfo?.messageRefer) {
      const result = await nim.V2NIMMessageService.getMessageListByRefers([
        pinInfo.messageRefer,
      ]);
      return result?.[0] as V2NIMMessageForUI | undefined;
    }

    return undefined;
  };

  const loadLatestHistory = async () => {
    if (!conversationId || loadingOlder.value) {
      return [];
    }
    loadingOlder.value = true;
    try {
      const historyMsgs = await store.msgStore.getHistoryMsgActive({
        conversationId,
        endTime: Date.now(),
        limit: HISTORY_LIMIT,
      });
      const normalizedMsgs = normalizeHistoryMsgs(historyMsgs || []);
      hasOlder.value = normalizedMsgs.length >= HISTORY_LIMIT;
      hasNewer.value = false;
      anchorMode.value = false;
      hasLoadedLatest.value = true;
      showLatestHint.value = false;
      msgs.value = store.msgStore.getMsg(conversationId) || normalizedMsgs;
      await notifyHistoryMessagesLoaded(normalizedMsgs);
      return normalizedMsgs;
    } finally {
      loadingOlder.value = false;
    }
  };

  const loadAnchorHistory = async () => {
    if (!anchorMessageClientId || !conversationId || loadingOlder.value) {
      return false;
    }
    loadingOlder.value = true;
    try {
      const anchorMessage = await getAnchorMessage();
      if (!anchorMessage) {
        return false;
      }

      const [beforeMsgs, afterMsgs] = await Promise.all([
        nim.V2NIMMessageService.getMessageList({
          conversationId,
          anchorMessage,
          direction:
            V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
          limit: ANCHOR_HISTORY_LIMIT,
        }),
        nim.V2NIMMessageService.getMessageList({
          conversationId,
          anchorMessage,
          direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_ASC,
          limit: ANCHOR_HISTORY_LIMIT,
        }),
      ]);

      const normalizedMsgs = normalizeHistoryMsgs([
        ...(beforeMsgs || []),
        anchorMessage,
        ...(afterMsgs || []),
      ]);
      const mergedMsgs = mergeMessages(normalizedMsgs);
      const hasLoadedLatestNow =
        (afterMsgs || []).length === 0 ||
        containsLastMessage([anchorMessage, ...(afterMsgs || [])]);

      store.msgStore.addMsg(conversationId, mergedMsgs);
      msgs.value = mergedMsgs;
      hasOlder.value = (beforeMsgs || []).length >= ANCHOR_HISTORY_LIMIT;
      hasNewer.value =
        !hasLoadedLatestNow && (afterMsgs || []).length >= ANCHOR_HISTORY_LIMIT;
      anchorMode.value = true;
      hasLoadedLatest.value = hasLoadedLatestNow;
      showLatestHint.value = false;
      await notifyHistoryMessagesLoaded(mergedMsgs);
      return true;
    } finally {
      loadingOlder.value = false;
    }
  };

  const loadOlder = async (firstMsg?: V2NIMMessageForUI) => {
    if (!conversationId || loadingOlder.value || !hasOlder.value) {
      return [];
    }
    loadingOlder.value = true;
    try {
      let historyMsgs: V2NIMMessageForUI[] = [];
      if (anchorMode.value && firstMsg) {
        historyMsgs =
          (await nim.V2NIMMessageService.getMessageList({
            conversationId,
            anchorMessage: firstMsg,
            direction:
              V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
            limit: HISTORY_LIMIT,
          })) || [];
      } else {
        historyMsgs =
          (await store.msgStore.getHistoryMsgActive({
            conversationId,
            endTime: firstMsg?.createTime || Date.now(),
            lastMsgId: firstMsg?.messageServerId,
            limit: HISTORY_LIMIT,
          })) || [];
      }

      const normalizedMsgs = normalizeHistoryMsgs(historyMsgs);
      hasOlder.value = normalizedMsgs.length >= HISTORY_LIMIT;
      if (normalizedMsgs.length) {
        store.msgStore.addMsg(conversationId, normalizedMsgs);
        msgs.value = mergeMessages([...normalizedMsgs, ...msgs.value]);
        await notifyHistoryMessagesLoaded(normalizedMsgs);
      }
      return normalizedMsgs;
    } finally {
      loadingOlder.value = false;
    }
  };

  const loadNewer = async (lastMsg?: V2NIMMessageForUI) => {
    if (
      !anchorMode.value ||
      loadingNewer.value ||
      !lastMsg ||
      !hasNewer.value
    ) {
      return [];
    }
    loadingNewer.value = true;
    try {
      const newerMsgs =
        (await nim.V2NIMMessageService.getMessageList({
          conversationId,
          anchorMessage: lastMsg,
          direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_ASC,
          limit: HISTORY_LIMIT,
        })) || [];
      const normalizedMsgs = normalizeHistoryMsgs(newerMsgs);

      if (normalizedMsgs.length) {
        store.msgStore.addMsg(conversationId, normalizedMsgs);
        msgs.value = mergeMessages([...msgs.value, ...normalizedMsgs]);
        await notifyHistoryMessagesLoaded(normalizedMsgs);
      }
      if (
        normalizedMsgs.length === 0 ||
        normalizedMsgs.length < HISTORY_LIMIT ||
        containsLastMessage(normalizedMsgs)
      ) {
        updateLatestStateByMessages(normalizedMsgs);
      }
      return normalizedMsgs;
    } finally {
      loadingNewer.value = false;
    }
  };

  const switchToLatest = async () => {
    loadingNewer.value = true;
    try {
      return await loadLatestHistory();
    } finally {
      loadingNewer.value = false;
    }
  };

  const handleIncomingMessages = (messages: V2NIMMessageForUI[]) => {
    if (!conversationId || !messages.length) {
      return false;
    }
    const currentMessages = normalizeHistoryMsgs(
      messages.filter((item) => item.conversationId === conversationId)
    );
    if (!currentMessages.length) {
      return false;
    }

    if (!anchorMode.value) {
      return true;
    }

    if (hasLoadedLatest.value) {
      msgs.value = mergeMessages([...msgs.value, ...currentMessages]);
    } else {
      showLatestHint.value = true;
    }
    return false;
  };

  const msgDispose = autorun(() => {
    if (!conversationId) {
      return;
    }
    const storeMsgs = store.msgStore.getMsg(conversationId) || [];
    if (anchorMode.value) {
      const normalizedStoreMsgs = normalizeHistoryMsgs(storeMsgs);
      const storeMsgMap = new Map<string, V2NIMMessageForUI>(
        normalizedStoreMsgs.map((msg: V2NIMMessageForUI) => [
          msg.messageClientId,
          msg,
        ])
      );
      const retainedMsgs = msgs.value
        .filter((msg) => storeMsgMap.has(msg.messageClientId))
        .map((msg) => storeMsgMap.get(msg.messageClientId) || msg);

      if (hasLoadedLatest.value && storeMsgs.length) {
        msgs.value = mergeMessages([...retainedMsgs, ...normalizedStoreMsgs]);
      } else {
        msgs.value = retainedMsgs;
      }
      return;
    }
    msgs.value = storeMsgs;
  });

  const pinDispose = autorun(() => {
    if (!conversationId) {
      return;
    }
    const pinMap = store.msgStore.pinMsgs.map.get(conversationId);
    if (pinMap) {
      [...pinMap.values()]
        .map((pinInfo: any) =>
          [
            pinInfo.messageRefer?.messageClientId,
            pinInfo.pinState,
            pinInfo.operatorId,
            pinInfo.updateTime,
          ].join(":")
        )
        .join("|");
    }
    refreshLocalPinState();
  });

  const stopLoginWatch = watch(
    loginStatus,
    (curLoginStatus) => {
      if (
        curLoginStatus !==
        V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
      ) {
        prevLoginStatus = curLoginStatus;
        return;
      }
      if (!conversationId) {
        return;
      }

      const loadInitialMessages = async () => {
        const forceUpdatePinList =
          hasLoadedInitial.value &&
          prevLoginStatus !==
            V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED;
        await syncPinnedMessageList(forceUpdatePinList);
        const loadedAnchor = anchorMessageClientId
          ? await loadAnchorHistory()
          : false;
        if (!canceled && (!anchorMessageClientId || !loadedAnchor)) {
          await loadLatestHistory();
        }
        hasLoadedInitial.value = true;
        prevLoginStatus = curLoginStatus;
      };

      msgs.value = [];
      hasOlder.value = true;
      hasNewer.value = false;
      anchorMode.value = false;
      hasLoadedLatest.value = false;
      showLatestHint.value = false;

      loadInitialMessages().catch((error) => {
        if (!canceled) {
          onError?.(error);
        }
      });
    },
    { immediate: true }
  );

  const dispose = () => {
    canceled = true;
    msgDispose();
    pinDispose();
    stopLoginWatch();
  };

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
    handleIncomingMessages,
    refreshLocalPinState,
    syncPinnedMessageList,
    dispose,
  };
};
