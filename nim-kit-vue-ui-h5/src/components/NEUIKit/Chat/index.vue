<template>
  <div class="msg-page-wrapper-h5">
    <NavBar :title="title" :subTitle="subTitle" :showLeft="true">
      <template v-slot:left>
        <div @click="backToConversation">
          <Icon type="icon-zuojiantou" :size="24"></Icon>
        </div>
      </template>
      <template v-slot:right>
        <div
          v-if="isMultiSelecting"
          class="msg-nav-cancel"
          @click="exitMultiSelect"
        >
          {{ t("cancelText") }}
        </div>
        <div v-else @click="handleSetting">
          <Icon type="icon-More" :size="24" />
        </div>
      </template>
    </NavBar>
    <div class="msg-alert">
      <NetworkAlert />
    </div>
    <MessageList
      :conversationType="conversationType"
      :to="to"
      :msgs="msgs"
      :loading-older="loadingOlder"
      :has-older="hasOlder"
      :reply-msgs-map="replyMsgsMap"
      :voice-text-map="voiceTextMap"
      :set-voice-text="setVoiceText"
      :anchor-message-client-id="anchorMessageClientId"
      :anchor-mode="anchorMode"
      :loading-newer="loadingNewer"
      :auto-scroll-to-bottom="!anchorMode"
      :on-load-older="loadOlder"
      :on-load-newer="loadNewer"
      :is-multi-selecting="isMultiSelecting"
      :selected-message-ids="selectedMessageIds"
      :on-toggle-select="toggleSelectMessage"
      :on-multi-select="enterMultiSelect"
    />
    <div
      v-if="anchorMode && (hasNewer || showLatestHint)"
      class="msg-anchor-latest"
      @click="backToLatestMsgs"
    >
      <Icon
        v-if="loadingNewer"
        type="icon-a-Frame8"
        :size="20"
        iconClassName="msg-anchor-loading"
      />
      <Icon v-else type="icon-jiantou" :size="20" />
    </div>
    <div v-if="isMultiSelecting" class="msg-multi-action-bar">
      <div
        class="msg-multi-action"
        :class="{ disabled: !selectedMessages.length }"
        @click="handleMergedForward"
      >
        <div class="msg-multi-action-icon">
          <Icon type="icon-zhuanfa" :size="22" />
        </div>
        <div>{{ t("mergedForwardText") }}</div>
      </div>
      <div
        class="msg-multi-action"
        :class="{ disabled: !selectedMessages.length }"
        @click="handleMultiForward"
      >
        <div class="msg-multi-action-icon">
          <Icon type="icon-zhuanfa" :size="22" />
        </div>
        <div>{{ t("oneByOneForwardText") }}</div>
      </div>
      <div
        class="msg-multi-action"
        :class="{ disabled: !selectedMessages.length }"
        @click="handleMultiDelete"
      >
        <div class="msg-multi-action-icon">
          <Icon type="icon-shanchu" :size="22" />
        </div>
        <div>{{ t("deleteText") }}</div>
      </div>
    </div>
    <MessageInput
      v-else
      :reply-msgs-map="replyMsgsMap"
      :conversation-type="conversationType"
      :to="to"
      @send-message="handleSendMessage"
    />
    <MessageForward
      v-if="multiForwardMsgs.length"
      v-model="forwardVisible"
      :msgIdClient="multiForwardMsgs[0]?.messageClientId || ''"
      :msgs="multiForwardMsgs"
      :conversation-id="conversationId"
      :forward-mode="forwardMode"
      @close="handleMultiForwardClose"
      @forward-success="exitMultiSelect"
    />
  </div>
</template>

<script lang="ts" setup>
import { trackInit } from "../utils/reporter";
import { autorun } from "mobx";
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  getCurrentInstance,
  watch,
} from "vue";
import NetworkAlert from "../CommonComponents/NetworkAlert.vue";
import NavBar from "./message/nav-bar.vue";
import Icon from "../CommonComponents/Icon.vue";
import MessageList from "./message/message-list.vue";
import MessageInput from "./message/message-input.vue";
import MessageForward from "./message/message-forward.vue";
import { t } from "../utils/i18n";
import type { V2NIMMessage } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type { V2NIMConversationType } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMConversationService";
import { useRouter } from "vue-router";
import emitter from "../utils/eventBus";
import { events } from "../utils/constants";
import { showModal } from "../utils/modal";
import { showToast } from "../utils/toast";
import { neUiKitRouterPath } from "../utils/uikitRouter";
import { checkUserOnline } from "../utils/userStatus";
import {
  getVoiceTextMap,
  setVoiceText as setCachedVoiceText,
} from "./voiceTextCache";
import { createChatMessageLoader } from "./message-pin/messageLoader";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import {
  chunkMessages,
  getMessageSelectKey,
  isForwardableMessage,
  isSelectableMessage,
  MULTI_DELETE_BATCH_SIZE,
  MULTI_FORWARD_LIMIT,
  syncConversationLastMessageAfterDelete,
} from "./message/message-multi-select/utils";
import {
  isMergeForwardableMessage,
  MERGED_FORWARD_LIMIT,
} from "./message/merged-forward/utils";

export interface YxReplyMsg {
  messageClientId: string;
  scene: V2NIMConst.V2NIMConversationType;
  from: string;
  receiverId: string;
  to: string;
  idServer: string;
  time: number;
}

const title = ref("");
const subTitle = ref("");
const router = useRouter();

const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore;
const nim = proxy?.$NIM;

const queryConversationId =
  (router.currentRoute.value.query.conversationId as string) || "";
const anchorMessageClientId =
  (router.currentRoute.value.query.anchorMessageClientId as string) || "";

/**会话ID */
const conversationId = (queryConversationId ||
  store?.uiStore.selectedConversation) as string;

if (queryConversationId && queryConversationId !== store?.uiStore.selectedConversation) {
  store?.uiStore.selectConversation(queryConversationId);
}

/**会话类型 */
const conversationType =
  nim.V2NIMConversationIdUtil.parseConversationType(
    conversationId
  ) as unknown as V2NIMConversationType;

/**对话方 */
const to = nim.V2NIMConversationIdUtil.parseConversationTargetId(conversationId);

trackInit("ChatUIKit", nim?.options?.appkey);

/**是否需要显示群组消息已读未读，默认 false */
const teamManagerVisible = store?.localOptions.teamMsgReceiptVisible;

/**是否需要显示 p2p 消息、p2p会话列表消息已读未读，默认 false */
const p2pMsgReceiptVisible = store?.localOptions.p2pMsgReceiptVisible;

/**回复消息map，用于回复消息的解析处理 */
const replyMsgsMap = ref<Record<string, V2NIMMessage>>();
const isMultiSelecting = ref(false);
const selectedMessageIds = ref<string[]>([]);
const multiForwardMsgs = ref<V2NIMMessageForUI[]>([]);
const forwardVisible = ref(false);
const forwardMode = ref<"oneByOne" | "merged">("oneByOne");

/** 语音转文字结果map，在进入会话列表前保留在内存中 */
const voiceTextMap = ref<Record<string, string>>(
  getVoiceTextMap(conversationId)
);

const setVoiceText = (messageClientId: string, text: string) => {
  voiceTextMap.value = setCachedVoiceText(conversationId, messageClientId, text);
};

const exitMultiSelect = () => {
  isMultiSelecting.value = false;
  selectedMessageIds.value = [];
  multiForwardMsgs.value = [];
  forwardVisible.value = false;
};

const enterMultiSelect = (msg: V2NIMMessageForUI) => {
  if (!isSelectableMessage(msg)) {
    return;
  }
  isMultiSelecting.value = true;
  selectedMessageIds.value = [getMessageSelectKey(msg)];
  emitter.emit(events.CLOSE_PANEL);
};

const toggleSelectMessage = (msg: V2NIMMessageForUI) => {
  if (!isSelectableMessage(msg)) {
    return;
  }
  const selectKey = getMessageSelectKey(msg);
  selectedMessageIds.value = selectedMessageIds.value.includes(selectKey)
    ? selectedMessageIds.value.filter((id) => id !== selectKey)
    : [...selectedMessageIds.value, selectKey];
};

const openMultiForward = (forwardMsgs: V2NIMMessageForUI[]) => {
  forwardMode.value = "oneByOne";
  multiForwardMsgs.value = forwardMsgs;
  forwardVisible.value = true;
};

const openMergedForward = (forwardMsgs: V2NIMMessageForUI[]) => {
  forwardMode.value = "merged";
  multiForwardMsgs.value = [...forwardMsgs].sort(
    (a, b) => a.createTime - b.createTime
  );
  forwardVisible.value = true;
};

const handleMultiForwardClose = () => {
  multiForwardMsgs.value = [];
  forwardVisible.value = false;
  forwardMode.value = "oneByOne";
};

const loginStatus = ref(
  store?.connectStore.loginStatus ||
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGOUT
);
const loginStatusWatch = autorun(() => {
  loginStatus.value =
    store?.connectStore.loginStatus ||
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGOUT;
});

/** 处理收到消息的已读回执 */
const handleMsgReceipt = (msg: V2NIMMessage[]) => {
  if (
    msg[0].conversationType ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P &&
    p2pMsgReceiptVisible
  ) {
    store?.msgStore.sendMsgReceiptActive(msg[0]);
  } else if (
    msg[0].conversationType ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
    teamManagerVisible
  ) {
    store?.msgStore.sendTeamMsgReceiptActive(msg);
  }
};

/** 处理历史消息的已读未读 */
const handleHistoryMsgReceipt = (msgs: V2NIMMessage[]) => {
  if (
    conversationType ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P &&
    p2pMsgReceiptVisible
  ) {
    const myUserAccountId = nim.V2NIMLoginService.getLoginUser();
    const othersMsgs = msgs
      .filter(
        (item: V2NIMMessage) =>
          // @ts-ignore
          !["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      )
      .filter((item: V2NIMMessage) => item.senderId !== myUserAccountId);

    if (othersMsgs.length > 0) {
      store?.msgStore.sendMsgReceiptActive(othersMsgs?.[0]);
    }
  } else if (
    conversationType ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
    teamManagerVisible
  ) {
    const myUserAccountId = nim.V2NIMLoginService.getLoginUser();
    const myMsgs = msgs
      .filter(
        (item: V2NIMMessage) =>
          // @ts-ignore
          !["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      )
      .filter((item: V2NIMMessage) => item.senderId === myUserAccountId);

    store?.msgStore.getTeamMsgReadsActive(myMsgs, conversationId);

    const othersMsgs = msgs
      .filter(
        (item: V2NIMMessage) =>
          // @ts-ignore
          !["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      )
      .filter((item: V2NIMMessage) => item.senderId !== myUserAccountId);

    if (othersMsgs.length > 0 && othersMsgs.length < 50) {
      store?.msgStore.sendTeamMsgReceiptActive(othersMsgs);
    }
  }
};

const loader = createChatMessageLoader({
  conversationId,
  anchorMessageClientId,
  loginStatus,
  store,
  nim,
  onHistoryMessagesLoaded: handleHistoryMsgReceipt as any,
  onError: (err) => {
    showToast({
      message: t("getHistoryMsgFailedText"),
      type: "error",
      duration: 1000,
    });
    console.error("Get history message failed", err);
  },
});

const {
  msgs,
  loadingOlder,
  loadingNewer,
  hasOlder,
  hasNewer,
  anchorMode,
  showLatestHint,
  loadOlder,
  loadNewer,
  switchToLatest,
} = loader;

const selectedMessages = computed(() => {
  return selectedMessageIds.value
    .map((id) => msgs.value.find((msg) => getMessageSelectKey(msg) === id))
    .filter(Boolean) as V2NIMMessageForUI[];
});

const keepSelectedMessages = (messages: V2NIMMessageForUI[]) => {
  const messageKeys = new Set(messages.map(getMessageSelectKey));
  selectedMessageIds.value = selectedMessageIds.value.filter((id) =>
    messageKeys.has(id)
  );
};

const handleMultiForward = () => {
  if (!selectedMessages.value.length) {
    return;
  }

  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    showToast({ message: t("networkError"), type: "info" });
    return;
  }

  if (selectedMessages.value.length > MULTI_FORWARD_LIMIT) {
    showToast({
      message: t("oneByOneForwardLimitText"),
      type: "info",
      duration: 1000,
    });
    return;
  }

  const forwardableMsgs = selectedMessages.value.filter((msg) =>
    isForwardableMessage(store, msg)
  );
  if (forwardableMsgs.length !== selectedMessages.value.length) {
    showModal({
      title: t("forwardExceptionTitle"),
      content: t("forwardExceptionContent"),
      confirmText: t("okText"),
      cancelText: t("cancelText"),
      onConfirm: () => {
        keepSelectedMessages(forwardableMsgs);
        if (forwardableMsgs.length) {
          openMultiForward(forwardableMsgs);
        } else {
          showToast({
            message: t("noForwardableMsgText"),
            type: "info",
            duration: 1000,
          });
        }
      },
    });
    return;
  }

  openMultiForward(forwardableMsgs);
};

const handleMergedForward = () => {
  if (!selectedMessages.value.length) {
    return;
  }

  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    showToast({ message: t("networkError"), type: "info" });
    return;
  }

  if (selectedMessages.value.length > MERGED_FORWARD_LIMIT) {
    showToast({
      message: t("mergedForwardLimitText"),
      type: "info",
      duration: 1000,
    });
    return;
  }

  const mergeForwardableMsgs = selectedMessages.value.filter((msg) =>
    isMergeForwardableMessage(store, msg)
  );
  if (mergeForwardableMsgs.length !== selectedMessages.value.length) {
    showModal({
      title: t("forwardExceptionTitle"),
      content: t("forwardExceptionContent"),
      confirmText: t("okText"),
      cancelText: t("cancelText"),
      onConfirm: () => {
        keepSelectedMessages(mergeForwardableMsgs);
        if (mergeForwardableMsgs.length) {
          openMergedForward(mergeForwardableMsgs);
        } else {
          showToast({
            message: t("noForwardableMsgText"),
            type: "info",
            duration: 1000,
          });
        }
      },
    });
    return;
  }

  openMergedForward(mergeForwardableMsgs);
};

const handleMultiDelete = () => {
  if (!selectedMessages.value.length) {
    return;
  }

  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    showToast({ message: t("networkError"), type: "info" });
    return;
  }

  showModal({
    title: t("deleteText"),
    content: t("delete"),
    confirmText: t("deleteText"),
    cancelText: t("cancelText"),
    onConfirm: async () => {
      try {
        const messageBatches = chunkMessages(
          selectedMessages.value,
          MULTI_DELETE_BATCH_SIZE
        );
        for (const messageBatch of messageBatches) {
          await store?.msgStore.deleteMsgActive(messageBatch);
        }
        showToast({ message: t("deleteMsgSuccessText"), type: "info" });
        syncConversationLastMessageAfterDelete(store, conversationId);
        exitMultiSelect();
      } catch {
        showToast({ message: t("deleteMsgFailText"), type: "info" });
      }
    },
  });
};

/**回到会话列表 */
const backToConversation = () => {
  store?.uiStore.unselectConversation?.();
  router.push(neUiKitRouterPath.conversation);
};

const backToLatestMsgs = async () => {
  await router.replace(neUiKitRouterPath.chat);
  await switchToLatest();
  setTimeout(() => {
    emitter.emit(events.ON_SCROLL_BOTTOM);
  }, 0);
};

const handleSendMessage = () => {
  if (!anchorMode.value) {
    return;
  }
  backToLatestMsgs();
};

/** 解散群组回调 */
const onTeamDismissed = (data: any) => {
  if (data.teamId === to) {
    showModal({
      content: t("onDismissTeamText"),
      title: t("tipText"),
      onCancel: () => {
        backToConversation();
      },
      onConfirm: () => {
        backToConversation();
      },
    });
  }
};

// 跳转设置页
const handleSetting = () => {
  if (
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
  ) {
    router.push({
      path: neUiKitRouterPath.p2pSetting,
      query: {
        accountId: to,
      },
    });
  } else if (
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    router.push({
      path: neUiKitRouterPath.teamSetting,
      query: {
        teamId: to,
      },
    });
  }
};

/** 自己主动离开群组或被管理员踢出回调 */
const onTeamLeft = () => {
  showToast({
    message: t("onRemoveTeamText"),
    type: "info",
    duration: 1000,
  });
  backToConversation();
};

/** 收到新消息 */
const onReceiveMessages = (newMsgs: V2NIMMessage[]) => {
  const curRoute = router.currentRoute.value.path;
  if (
    newMsgs.length &&
    !newMsgs[0]?.isSelf &&
    newMsgs[0].conversationId == conversationId &&
    curRoute === neUiKitRouterPath.chat
  ) {
    handleMsgReceipt(newMsgs);
  }

  if (loader.handleIncomingMessages(newMsgs as V2NIMMessageForUI[])) {
    setTimeout(() => {
      emitter.emit(events.ON_SCROLL_BOTTOM);
    }, 0);
  }
};

/** 监听当前聊天页面的会话类型 */
const conversationTypeWatch = autorun(() => {
  if (
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
  ) {
    const appellation = store?.uiStore.getAppellation({
      account: to,
    }) as string;
    const stateMap = store?.subscriptionStore.stateMap;
    const userStatus = stateMap?.get(to);
    const isOnline = checkUserOnline(userStatus);
    title.value = appellation;
    subTitle.value = isOnline
      ? `(${t("userOnlineText")})`
      : `(${t("userOfflineText")})`;
  } else if (
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    const team = store?.teamStore.teams.get(to);
    const memberCount = `(${team?.memberCount || 0})`;
    title.value = (team?.name || "") + memberCount;
    subTitle.value = "";
  }
});

const processReplyMsgs = (messages: V2NIMMessageForUI[]) => {
  const _replyMsgsMap: any = {};
  const reqMsgs: YxReplyMsg[] = [];
  const messageClientIds: Record<string, string> = {};

  messages.forEach((msg: any) => {
    if (msg.serverExtension) {
      try {
        const { yxReplyMsg } = JSON.parse(msg.serverExtension);
        if (!yxReplyMsg) {
          return;
        }

        const replyMsg = messages.find(
          (item) => item.messageClientId === yxReplyMsg.idClient
        );
        if (replyMsg) {
          _replyMsgsMap[msg.messageClientId] = replyMsg;
        } else {
          _replyMsgsMap[msg.messageClientId] = {
            messageClientId: "noFind",
          };
          const {
            scene,
            from,
            to,
            idServer,
            messageClientId,
            time,
            receiverId,
          } = yxReplyMsg;

          if (
            scene &&
            from &&
            to &&
            idServer &&
            messageClientId &&
            time &&
            receiverId
          ) {
            reqMsgs.push({
              scene,
              from,
              to,
              idServer,
              messageClientId,
              time,
              receiverId,
            });
            messageClientIds[idServer] = msg.messageClientId;
          }
        }
      } catch {}
    } else if (msg.threadReply) {
      const yxReplyMsg = msg.threadReply;
      const replyMsg = messages.find(
        (item) => item.messageClientId === yxReplyMsg.messageClientId
      );
      if (replyMsg) {
        _replyMsgsMap[msg.messageClientId] = replyMsg;
      } else {
        _replyMsgsMap[msg.messageClientId] = {
          messageClientId: "noFind",
        };
        const {
          conversationType,
          conversationId,
          senderId,
          receiverId,
          messageServerId,
          messageClientId,
          createTime,
        } = yxReplyMsg;
        if (
          conversationType &&
          conversationId &&
          senderId &&
          receiverId &&
          messageServerId &&
          messageClientId &&
          createTime
        ) {
          reqMsgs.push({
            scene: conversationType,
            from: senderId,
            to: conversationId,
            idServer: messageServerId,
            messageClientId,
            time: createTime,
            receiverId,
          });
          messageClientIds[messageServerId] = msg.messageClientId;
        }
      }
    }
  });

  return { _replyMsgsMap, reqMsgs, messageClientIds };
};

/** 动态更新回复消息 */
const stopMsgsWatch = watch(
  msgs,
  () => {
  if (isMultiSelecting.value) {
    const selectableIds = new Set(
      (msgs.value || []).filter(isSelectableMessage).map(getMessageSelectKey)
    );
    selectedMessageIds.value = selectedMessageIds.value.filter((id) =>
      selectableIds.has(id)
    );
  }

  const messages = msgs.value || [];
  if (messages.length === 0) {
    replyMsgsMap.value = {};
    return;
  }

  const { _replyMsgsMap, reqMsgs, messageClientIds } =
    processReplyMsgs(messages as V2NIMMessageForUI[]);

  if (reqMsgs.length > 0) {
    nim.V2NIMMessageService.getMessageListByRefers(
      reqMsgs.map((item) => ({
        senderId: item.from,
        receiverId: item.receiverId,
        messageClientId: item.messageClientId,
        messageServerId: item.idServer,
        createTime: item.time,
        conversationType: item.scene,
        conversationId: item.to,
      }))
    )
      .then((res: any) => {
        if (res?.length > 0) {
          res.forEach((item: any) => {
            if (item.messageServerId) {
              _replyMsgsMap[messageClientIds[item.messageServerId]] = item;
            }
          });
        }
        replyMsgsMap.value = { ..._replyMsgsMap };
      })
      .catch(() => {
        replyMsgsMap.value = { ..._replyMsgsMap };
      });
  } else {
    replyMsgsMap.value = { ..._replyMsgsMap };
  }
  },
  { immediate: true }
);

/** 设置页面标题 */
const setNavTitle = () => {
  if (
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
  ) {
    title.value = store?.uiStore.getAppellation({
      account: to,
    }) as string;
  } else if (
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    const team = store?.teamStore.teams.get(to);
    const subTitle = `(${team?.memberCount || 0})`;
    title.value = (team?.name || "") + subTitle;
  }
};

onMounted(() => {
  setNavTitle();

  if (msgs.value.length) {
    const _msgs = [...msgs.value].reverse();
    handleHistoryMsgReceipt(_msgs as V2NIMMessage[]);
  }

  nim.V2NIMMessageService.on("onReceiveMessages", onReceiveMessages as any);
  nim.V2NIMTeamService.on("onTeamDismissed", onTeamDismissed);
  nim.V2NIMTeamService.on("onTeamLeft", onTeamLeft);
});

onUnmounted(() => {
  nim.V2NIMTeamService.off("onTeamDismissed", onTeamDismissed);
  nim.V2NIMTeamService.off("onTeamLeft", onTeamLeft);
  nim.V2NIMMessageService.off("onReceiveMessages", onReceiveMessages as any);

  stopMsgsWatch();
  conversationTypeWatch();
  loginStatusWatch();
  loader.dispose();
});
</script>

<style scoped>
.msg-page-wrapper-h5 {
  width: 100%;
  height: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}

.msg-alert {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: auto;
  z-index: 1;
}

.msg-wrapper {
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
}

.msg-wrapper-h5 {
  width: 100%;
  height: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}

.msg-wrapper > message-list {
  height: 100%;
}

.msg-anchor-latest {
  position: absolute;
  right: 18px;
  bottom: 82px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(90deg);
  z-index: 10;
}

.msg-anchor-loading {
  animation: anchor-spin 1s linear infinite;
}

.msg-nav-cancel {
  color: #333;
  font-size: 16px;
  line-height: 24px;
  padding: 0 4px;
}

.msg-multi-action-bar {
  flex-shrink: 0;
  height: 64px;
  padding-bottom: env(safe-area-inset-bottom);
  background: #fff;
  border-top: 1px solid #e6e8eb;
  display: flex;
  align-items: center;
  justify-content: space-around;
  box-sizing: content-box;
}

.msg-multi-action {
  min-width: 96px;
  height: 56px;
  color: #1f2329;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.msg-multi-action.disabled {
  color: #b8b8b8;
}

.msg-multi-action.disabled :deep(img) {
  opacity: 0.35;
}

.msg-multi-action-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes anchor-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
