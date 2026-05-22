<template>
  <div class="pin-list-wrapper">
    <NavBar :title="t('pinText')" />
    <div v-if="loading" class="pin-list-loading">
      {{ t("loadingMoreText") }}
    </div>
    <Empty v-else-if="pinInfos.length === 0" :text="t('noPinListText')" />
    <div v-else class="pin-list">
      <div
        v-for="pinInfo in visiblePins"
        :key="getPinMessage(pinInfo)?.messageClientId"
        class="pin-list-item"
      >
        <div
          class="pin-list-item-top"
          @click="openChatAtMessage(getPinMessage(pinInfo))"
        >
          <Avatar
            :account="getPinMessage(pinInfo)?.senderId || ''"
            :teamId="targetId"
            size="40"
          />
          <div class="pin-list-item-main">
            <div class="pin-list-item-name">
              {{ getSenderName(getPinMessage(pinInfo)) }}
            </div>
            <div class="pin-list-item-time">
              {{ formatPinTime(getPinMessage(pinInfo)?.createTime || 0) }}
            </div>
          </div>
          <div
            class="pin-list-more"
            @click.stop="openActionPopup(getPinMessage(pinInfo))"
          >
            <Icon type="icon-More" :size="22" />
          </div>
        </div>
        <div class="pin-message-preview-wrapper" @click.stop>
          <PinListMessagePreview :msg="getPinMessage(pinInfo)!" />
        </div>
      </div>
      <div
        v-if="visibleCount < pinInfos.length"
        class="pin-list-load-more"
        @click="loadMore"
      >
        {{ t("viewMoreText") }}
      </div>
    </div>
    <BottomPopup
      v-model="actionPopupVisible"
      :showHeader="false"
      :showCancel="false"
      :showConfirm="false"
      @cancel="closeActionPopup"
      class="pin-list-action-popup"
    >
      <div v-if="actionMsg" class="pin-list-action-sheet">
        <div class="pin-list-action-group">
          <div class="pin-list-action" @click="handleUnpin(actionMsg)">
            {{ t("unpinText") }}
          </div>
          <div
            v-if="
              actionMsg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
            "
            class="pin-list-action"
            @click="handleActionCopy(actionMsg)"
          >
            {{ t("copyText") }}
          </div>
          <div
            v-if="
              actionMsg.messageType !==
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO
            "
            class="pin-list-action"
            @click="handleActionForward(actionMsg)"
          >
            {{ t("forwardText") }}
          </div>
        </div>
        <div class="pin-list-action-cancel" @click="closeActionPopup">
          {{ t("cancelText") }}
        </div>
      </div>
    </BottomPopup>
    <MessageForward
      v-if="forwardMsgId"
      v-model="forwardVisible"
      :msgIdClient="forwardMsgId"
      :conversation-id="conversationId"
      :msg="forwardMsg"
      @close="closeForward"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, onMounted, onUnmounted, ref } from "vue";
import { autorun } from "mobx";
import { useRouter } from "vue-router";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import type { PinInfo } from "@xkit-yx/im-store-v2/dist/types/src/pinMsgsMap";
import NavBar from "../CommonComponents/NavBar.vue";
import Avatar from "../CommonComponents/Avatar.vue";
import Empty from "../CommonComponents/Empty.vue";
import Icon from "../CommonComponents/Icon.vue";
import BottomPopup from "../CommonComponents/BottomPopup.vue";
import MessageForward from "./message/message-forward.vue";
import PinListMessagePreview from "./pin-list-message-preview.vue";
import { t } from "../utils/i18n";
import { copyText } from "../utils";
import { showToast } from "../utils/toast";
import { neUiKitRouterPath } from "../utils/uikitRouter";
import { getMessageRefer } from "./message-pin/utils";

const PAGE_SIZE = 20;

const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore;
const nim = proxy?.$NIM;
const router = useRouter();
const conversationId =
  (router.currentRoute.value.query.conversationId as string) || "";
const pinInfos = ref<PinInfo[]>([]);
const visibleCount = ref(PAGE_SIZE);
const loading = ref(false);
const actionMsg = ref<V2NIMMessageForUI>();
const actionPopupVisible = ref(false);
const forwardVisible = ref(false);
const forwardMsgId = ref("");
const forwardMsg = ref<V2NIMMessageForUI>();
let prevLoginStatus = store?.connectStore.loginStatus;
let loginStatusWatch = () => {};
let pinMapWatch = () => {};

const conversationType = conversationId
  ? (nim.V2NIMConversationIdUtil.parseConversationType(
      conversationId
    ) as unknown as V2NIMConst.V2NIMConversationType)
  : V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P;
const targetId = conversationId
  ? nim.V2NIMConversationIdUtil.parseConversationTargetId(conversationId)
  : "";

const formatPinTime = (time: number) => {
  const date = new Date(time);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
};

const getPinMessage = (pinInfo?: PinInfo) => {
  return pinInfo?.message as V2NIMMessageForUI | undefined;
};

const normalizePinInfos = (list: PinInfo[]) => {
  return [...list]
    .filter((item) => item.pinState > 0 && getPinMessage(item))
    .sort(
      (a, b) =>
        (getPinMessage(b)?.createTime || b.updateTime || 0) -
        (getPinMessage(a)?.createTime || a.updateTime || 0)
    );
};

const visiblePins = computed(() =>
  pinInfos.value.slice(0, visibleCount.value)
);

const getSenderName = (msg?: V2NIMMessageForUI) => {
  if (!msg) {
    return "";
  }
  return store?.uiStore.getAppellation({
    account: msg.senderId,
    teamId:
      conversationType ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
        ? targetId
        : "",
  });
};

const loadPinList = async (forceUpdate = false) => {
  if (!conversationId) {
    return;
  }
  loading.value = true;
  try {
    const list = await (store?.msgStore.getPinnedMessageListActive as any)(
      conversationId,
      forceUpdate
    );
    pinInfos.value = normalizePinInfos(list || []);
  } catch {
    showToast({
      message: t("getHistoryMsgFailedText"),
      type: "info",
    });
  } finally {
    loading.value = false;
  }
};

const handleCopy = async (msg: V2NIMMessageForUI) => {
  if (
    msg.messageType !==
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ||
    !msg.text
  ) {
    showToast({ message: t("copyFailText"), type: "info" });
    return;
  }

  try {
    await copyText(msg.text);
    showToast({ message: t("copySuccessText"), type: "info" });
  } catch {
    showToast({ message: t("copyFailText"), type: "info" });
  }
};

const handleUnpin = async (msg: V2NIMMessageForUI) => {
  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    showToast({ message: t("networkError"), type: "info" });
    return;
  }

  try {
    await store?.msgStore.unpinMessageActive(getMessageRefer(msg));
    pinInfos.value = pinInfos.value.filter(
      (item) => item.messageRefer.messageClientId !== msg.messageClientId
    );
    closeActionPopup();
    showToast({ message: t("unpinSuccessText"), type: "info" });
  } catch {
    showToast({ message: t("unpinFailedText"), type: "info" });
  }
};

const openActionPopup = (msg?: V2NIMMessageForUI) => {
  if (!msg) {
    return;
  }
  actionMsg.value = msg;
  actionPopupVisible.value = true;
};

const closeActionPopup = () => {
  actionPopupVisible.value = false;
  actionMsg.value = undefined;
};

const handleActionCopy = async (msg: V2NIMMessageForUI) => {
  await handleCopy(msg);
  closeActionPopup();
};

const handleActionForward = (msg: V2NIMMessageForUI) => {
  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    showToast({ message: t("offlineText"), type: "info" });
    return;
  }

  store?.uiStore.selectConversation(conversationId);
  forwardMsg.value = msg;
  forwardMsgId.value = msg.messageClientId;
  forwardVisible.value = true;
  closeActionPopup();
};

const closeForward = () => {
  forwardVisible.value = false;
  forwardMsgId.value = "";
  forwardMsg.value = undefined;
};

const openChatAtMessage = async (msg?: V2NIMMessageForUI) => {
  if (!msg) {
    return;
  }
  await store?.uiStore.selectConversation(conversationId);
  router.push({
    path: neUiKitRouterPath.chat,
    query: {
      conversationId,
      anchorMessageClientId: msg.messageClientId,
    },
  });
};

const loadMore = () => {
  visibleCount.value = Math.min(
    visibleCount.value + PAGE_SIZE,
    pinInfos.value.length
  );
};

onMounted(() => {
  loadPinList();

  loginStatusWatch = autorun(() => {
    const loginStatus = store?.connectStore.loginStatus;
    const shouldReload =
      prevLoginStatus !==
        V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED &&
      loginStatus ===
        V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED &&
      conversationId;
    prevLoginStatus = loginStatus;
    if (shouldReload) {
      loadPinList(true);
    }
  });

  pinMapWatch = autorun(() => {
    if (!conversationId) {
      return;
    }
    const pinMap = store?.msgStore.pinMsgs.map.get(conversationId);
    if (!pinMap) {
      return;
    }
    pinInfos.value = normalizePinInfos([...pinMap.values()]);
  });
});

onUnmounted(() => {
  loginStatusWatch();
  pinMapWatch();
});
</script>

<style scoped>
.pin-list-wrapper {
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: #fff;
}

.pin-list-loading {
  padding: 24px 0;
  text-align: center;
  color: #a6adb6;
  font-size: 14px;
}

.pin-list {
  padding: 14px 14px 20px;
}

.pin-list-wrapper :deep(.nav-bar-wrapper) {
  border-bottom: 1px solid #e6e6e6;
}

.pin-list-item {
  min-height: 72px;
  margin-bottom: 10px;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  overflow: hidden;
}

.pin-list-item-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  cursor: pointer;
}

.pin-list-item-main {
  min-width: 0;
  flex: 1;
}

.pin-list-item-name {
  min-width: 0;
  color: #333;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin-list-item-time {
  flex: 0 0 auto;
  color: #a6adb6;
  font-size: 12px;
}

.pin-message-preview-wrapper {
  padding: 12px;
  border-top: 1px solid #e6e6e6;
  color: #333;
  font-size: 14px;
  cursor: default;
}

.pin-list-more {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #656a72;
}

.pin-list-load-more {
  padding: 14px 0;
  text-align: center;
  color: #a6adb6;
  font-size: 14px;
}

.pin-list-action-popup :deep(.popup-content) {
  left: 0;
  right: 0;
  background: transparent;
  border-radius: 0;
  padding: 0 12px calc(env(safe-area-inset-bottom) + 10px);
  box-sizing: border-box;
}

.pin-list-action-popup :deep(.popup-body) {
  padding: 0;
  max-height: none;
  overflow: visible;
}

.pin-list-action-sheet {
  width: 100%;
}

.pin-list-action-group,
.pin-list-action-cancel {
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
}

.pin-list-action,
.pin-list-action-cancel {
  width: 100%;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0;
  color: #222;
  font-size: 16px;
  line-height: 56px;
  text-align: center;
}

.pin-list-action + .pin-list-action {
  border-top: 1px solid #e6e6e6;
}

.pin-list-action-cancel {
  margin-top: 8px;
  background: #fff;
}
</style>
