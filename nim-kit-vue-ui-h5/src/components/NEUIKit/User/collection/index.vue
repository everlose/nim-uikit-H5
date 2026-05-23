<template>
  <div class="collection-wrapper">
    <NavBar :title="t('collectionText')" />
    <div v-if="loading" class="collection-loading">
      {{ t("loadingMoreText") }}
    </div>
    <Empty v-else-if="items.length === 0" :text="t('noCollectionsText')" />
    <div v-else ref="listRef" class="collection-list" @scroll="handleScroll">
      <div
        v-for="item in items"
        :key="item.collection.collectionId || item.collection.uniqueId"
        class="collection-list-item"
        @click="handleItemClick(item.msg)"
      >
        <div class="collection-list-item-header">
          <Avatar
            :account="item.msg.senderId"
            :teamId="getConversationTargetId(item.msg)"
            size="40"
          />
          <div class="collection-list-item-meta">
            <div class="collection-list-item-name">
              {{ getSenderName(item.msg) }}
            </div>
            <div class="collection-conversation-name">
              {{ t("collectionFromText") }} {{ getConversationName(item.msg) }}
            </div>
          </div>
          <div class="collection-list-more" @click.stop="openActionPopup(item)">
            <Icon type="icon-More" :size="22" />
          </div>
        </div>
        <div class="collection-list-item-content">
          <MessageText
            v-if="
              item.msg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
            "
            class="collection-message-preview collection-message-preview-text"
            :msg="item.msg"
          />
          <img
            v-else-if="
              item.msg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE
            "
            class="collection-message-image"
            :src="getCollectionImageThumbUrl(item.msg)"
            :style="getCollectionImageStyle(item.msg)"
          />
          <div
            v-else-if="
              item.msg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO
            "
            class="collection-audio-preview"
            @click.stop
          >
            <div class="msg-bg msg-bg-in">
              <MessageAudio
                :msg="item.msg"
                mode="audio-in"
                broadcastNewAudioSrc=""
              />
            </div>
          </div>
          <div
            v-else-if="
              item.msg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
            "
            class="collection-video-message"
          >
            <div class="collection-video-play-button">
              <div class="collection-video-play-icon"></div>
            </div>
            <img
              class="collection-video-cover"
              :src="getVideoFirstFrameUrl(item.msg)"
              :style="getCollectionImageStyle(item.msg)"
            />
          </div>
          <div
            v-else-if="
              item.msg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE
            "
            class="collection-file-preview"
            @click.stop
          >
            <MessageFile :msg="item.msg" />
          </div>
          <div v-else class="collection-message-preview">
            {{ getMessagePreview(item.msg) }}
          </div>
        </div>
        <div class="collection-list-item-time">
          {{ formatCollectionTime(item.collectionTime) }}
        </div>
      </div>
      <div v-if="loadingMore" class="collection-load-more">
        {{ t("loadingMoreText") }}
      </div>
      <div v-else-if="!hasMore" class="collection-load-more">
        {{ t("noMoreText") }}
      </div>
    </div>

    <BottomPopup
      v-model="actionPopupVisible"
      :showHeader="false"
      :showCancel="false"
      :showConfirm="false"
      @cancel="closeActionPopup"
    >
      <div v-if="actionItem" class="collection-action-sheet">
        <div class="collection-action-group">
          <div class="collection-action" @click="handleDelete(actionItem)">
            {{ t("deleteText") }}
          </div>
          <div
            v-if="
              actionItem.msg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
            "
            class="collection-action"
            @click="handleCopy(actionItem.msg)"
          >
            {{ t("copyText") }}
          </div>
          <div class="collection-action" @click="handleForward(actionItem.msg)">
            {{ t("forwardText") }}
          </div>
        </div>
        <div class="collection-action-cancel" @click="closeActionPopup">
          {{ t("cancelText") }}
        </div>
      </div>
    </BottomPopup>

    <MessageForward
      v-if="forwardMsg"
      v-model="forwardVisible"
      :msgIdClient="forwardMsg.messageClientId"
      :conversation-id="forwardMsg.conversationId"
      :msg="forwardMsg"
      @close="closeForward"
    />

    <PreviewImage
      v-if="
        previewMsg?.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE
      "
      :visible="true"
      :imageUrl="getAttachmentUrl(previewMsg)"
      :onClose="closePreview"
    />

    <div
      v-else-if="
        previewMsg?.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
      "
      class="collection-preview-mask"
      @click="closePreview"
    >
      <div class="collection-video-preview" @click.stop>
        <video :src="getAttachmentUrl(previewMsg)" controls autoplay />
        <div class="collection-preview-close" @click="closePreview">×</div>
      </div>
    </div>

    <PreviewText
      v-else-if="
        previewMsg?.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
      "
      :visible="true"
      :msg="previewMsg"
      :onClose="closePreview"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, onMounted, ref } from "vue";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type {
  V2NIMCollection,
  V2NIMCollectionOption,
  V2NIMMessageFileAttachment,
} from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import NavBar from "../../CommonComponents/NavBar.vue";
import Avatar from "../../CommonComponents/Avatar.vue";
import Empty from "../../CommonComponents/Empty.vue";
import Icon from "../../CommonComponents/Icon.vue";
import BottomPopup from "../../CommonComponents/BottomPopup.vue";
import PreviewImage from "../../CommonComponents/PreviewImage.vue";
import PreviewText from "../../CommonComponents/PreviewText.vue";
import MessageForward from "../../Chat/message/message-forward.vue";
import MessageText from "../../Chat/message/message-text.vue";
import MessageAudio from "../../Chat/message/message-audio.vue";
import MessageFile from "../../Chat/message/message-file.vue";
import { t } from "../../utils/i18n";
import { copyText } from "../../utils";
import { showModal } from "../../utils/modal";
import { showToast } from "../../utils/toast";
import { getMsgContentTipByType } from "../../utils/msg";
import {
  getMessageCollectionConverter,
  MESSAGE_COLLECTION_TYPE,
  MessageCollectionItem,
  normalizeMessageCollections,
} from "../../utils/collection";
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from "../../utils/image";

const PAGE_SIZE = 20;

const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore;
const nim = proxy?.$NIM;
const items = ref<MessageCollectionItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const listRef = ref<HTMLElement>();
const lastCollection = ref<V2NIMCollection>();
const actionCollectionId = ref("");
const forwardVisible = ref(false);
const forwardMsg = ref<V2NIMMessageForUI>();
const previewMsg = ref<V2NIMMessageForUI>();
const converter = computed(() => getMessageCollectionConverter(nim));

const actionItem = computed(() =>
  items.value.find(
    (item) => item.collection.collectionId === actionCollectionId.value
  )
);
const actionPopupVisible = computed({
  get: () => !!actionItem.value,
  set: (value: boolean) => {
    if (!value) {
      closeActionPopup();
    }
  },
});

const formatCollectionTime = (time: number) => {
  const date = new Date(time);
  const now = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `${hour}:${minute}`;
  }
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
};

const getAttachmentUrl = (msg?: V2NIMMessageForUI) => {
  return ((msg?.attachment as { url?: string } | undefined)?.url || "") as string;
};

const getCollectionImageThumbUrl = (msg?: V2NIMMessageForUI) => {
  const url = getAttachmentUrl(msg);
  const { width, height } = getImageAttachmentSize(msg?.attachment);
  return getImageThumbUrl(url, width, height);
};

const getCollectionImageStyle = (msg?: V2NIMMessageForUI) => {
  const { width, height } = getImageAttachmentSize(msg?.attachment);
  return getImageRenderStyle(width, height, "compact");
};

const getVideoFirstFrameUrl = (msg?: V2NIMMessageForUI) => {
  const url = getAttachmentUrl(msg);
  return url ? `${url}${url.includes("?") ? "&" : "?"}vframe=1` : "";
};

const getFileDownloadUrl = (msg: V2NIMMessageForUI) => {
  const attachment = msg.attachment as V2NIMMessageFileAttachment | undefined;
  const url = attachment?.url || "";
  if (!url) {
    return "";
  }
  const name = attachment?.name || "";
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(
    name
  )}`;
};

const getConversationTargetId = (msg: V2NIMMessageForUI) => {
  return nim.V2NIMConversationIdUtil.parseConversationTargetId(
    msg.conversationId
  );
};

const getConversationType = (msg: V2NIMMessageForUI) => {
  return (
    msg.conversationType ||
    (nim.V2NIMConversationIdUtil.parseConversationType(
      msg.conversationId
    ) as unknown as V2NIMConst.V2NIMConversationType)
  );
};

const getConversationName = (msg: V2NIMMessageForUI) => {
  const conversationType = getConversationType(msg);
  const targetId = getConversationTargetId(msg);
  if (
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    return store?.teamStore.teams.get(targetId)?.name || targetId;
  }
  return store?.uiStore.getAppellation({ account: targetId }) || targetId;
};

const getSenderName = (msg: V2NIMMessageForUI) => {
  const conversationType = getConversationType(msg);
  const targetId = getConversationTargetId(msg);
  return (
    store?.uiStore.getAppellation({
      account: msg.senderId,
      teamId:
        conversationType ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
          ? targetId
          : "",
    }) || msg.senderId
  );
};

const getMessagePreview = (msg: V2NIMMessageForUI) => {
  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE) {
    return (
      (msg.attachment as V2NIMMessageFileAttachment | undefined)?.name ||
      `[${t("fileMsgText")}]`
    );
  }
  return getMsgContentTipByType(msg);
};

const loadCollections = async (isLoadMore = false) => {
  if (isLoadMore && (!hasMore.value || loadingMore.value)) {
    return;
  }
  if (!isLoadMore && loading.value) {
    return;
  }

  if (isLoadMore) {
    loadingMore.value = true;
  } else {
    loading.value = true;
    hasMore.value = true;
    lastCollection.value = undefined;
  }

  try {
    const option: V2NIMCollectionOption = {
      collectionType: MESSAGE_COLLECTION_TYPE,
      limit: PAGE_SIZE,
      direction: V2NIMConst.V2NIMQueryDirection.V2NIM_QUERY_DIRECTION_DESC,
    };
    if (isLoadMore && lastCollection.value) {
      option.anchorCollection = lastCollection.value;
    }

    const collections = await store?.msgStore.getCollectionListByOptionActive(
      option
    );
    const collectionList = collections || [];
    lastCollection.value =
      collectionList[collectionList.length - 1] || lastCollection.value;
    const nextItems = normalizeMessageCollections(
      collectionList,
      converter.value
    );
    items.value = isLoadMore ? [...items.value, ...nextItems] : nextItems;
    hasMore.value = collectionList.length >= PAGE_SIZE;
  } catch {
    showToast({ message: t("getHistoryMsgFailedText"), type: "info" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const handleScroll = () => {
  const el = listRef.value;
  if (!el || loading.value || loadingMore.value || !hasMore.value) {
    return;
  }
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
    loadCollections(true);
  }
};

const openActionPopup = (item: MessageCollectionItem) => {
  actionCollectionId.value = item.collection.collectionId;
};

const closeActionPopup = () => {
  actionCollectionId.value = "";
};

const handleDelete = async (item: MessageCollectionItem) => {
  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    closeActionPopup();
    showToast({ message: t("offlineText"), type: "info" });
    return;
  }

  closeActionPopup();
  showModal({
    title: t("deleteText"),
    content: t("deleteCollectionConfirmText"),
    confirmText: t("deleteText"),
    onConfirm: async () => {
      try {
        await store?.msgStore.removeCollectionsActive([item.collection]);
        items.value = items.value.filter(
          (collectionItem) =>
            collectionItem.collection.collectionId !==
            item.collection.collectionId
        );
        showToast({ message: t("deleteMsgSuccessText"), type: "info" });
      } catch {
        showToast({ message: t("deleteCollectionFailedText"), type: "info" });
      }
    },
  });
};

const handleCopy = async (msg: V2NIMMessageForUI) => {
  try {
    if (
      msg.messageType !==
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ||
      !msg.text
    ) {
      throw new Error("Unsupported copy message");
    }
    await copyText(msg.text);
    showToast({ message: t("copySuccessText"), type: "info" });
  } catch {
    showToast({ message: t("copyFailText"), type: "info" });
  } finally {
    closeActionPopup();
  }
};

const handleForward = (msg: V2NIMMessageForUI) => {
  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    showToast({ message: t("offlineText"), type: "info" });
    return;
  }

  store?.uiStore.selectConversation(msg.conversationId);
  forwardMsg.value = msg;
  forwardVisible.value = true;
  closeActionPopup();
};

const closeForward = () => {
  forwardVisible.value = false;
  forwardMsg.value = undefined;
};

const handleItemClick = (msg: V2NIMMessageForUI) => {
  if (
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
  ) {
    previewMsg.value = msg;
    return;
  }

  if (msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE) {
    const url = getFileDownloadUrl(msg);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
};

const closePreview = () => {
  previewMsg.value = undefined;
};

onMounted(() => {
  loadCollections();
});
</script>

<style scoped>
.collection-wrapper {
  min-height: 100vh;
  background: #f5f6f8;
}

.collection-loading {
  padding: 24px 0;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.collection-list {
  height: calc(100vh - 50px);
  overflow-y: auto;
  padding: 10px 12px 20px;
  box-sizing: border-box;
}

.collection-list-item {
  display: flex;
  flex-direction: column;
  padding: 12px 12px 10px;
  background: #fff;
  border-radius: 8px;
}

.collection-list-item + .collection-list-item {
  margin-top: 10px;
}

.collection-list-item-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.collection-list-item-meta {
  flex: 1;
  min-width: 0;
}

.collection-list-item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #222;
  font-size: 15px;
  line-height: 22px;
}

.collection-conversation-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #999;
  font-size: 12px;
  line-height: 18px;
}

.collection-list-item-content {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eef0f3;
}

.collection-list-item-time {
  margin-top: 10px;
  color: #999;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.collection-message-preview {
  display: -webkit-box;
  overflow: hidden;
  color: #333;
  font-size: 14px;
  line-height: 20px;
  word-break: break-word;
  text-overflow: ellipsis;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.collection-message-preview-text :deep(.msg-text) {
  display: -webkit-box;
  max-height: 60px;
  overflow: hidden;
  line-height: 20px;
  text-align: left;
  text-overflow: ellipsis;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.collection-message-image {
  display: block;
  max-width: 100%;
  border-radius: 6px;
  object-fit: cover;
  background: #f5f6f8;
}

.collection-video-message {
  position: relative;
  display: inline-block;
}

.collection-video-cover {
  display: block;
  max-width: 100%;
  border-radius: 6px;
  object-fit: cover;
  background: #f5f6f8;
}

.collection-video-play-button {
  width: 40px;
  height: 40px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  z-index: 1;
}

.collection-video-play-icon {
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 14px solid #fff;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-40%, -50%);
}

.collection-file-preview {
  display: inline-block;
  max-width: 100%;
}

.collection-file-preview :deep(.msg-file-in) {
  margin-left: 0;
}

.collection-file-preview :deep(.msg-file-out) {
  margin-right: 0;
}

.collection-audio-preview {
  display: inline-block;
}

.collection-audio-preview .msg-bg {
  display: inline-block;
  max-width: 63vw;
  padding: 12px 16px;
  overflow: hidden;
}

.collection-audio-preview .msg-bg-in {
  margin-left: 0;
  border-radius: 0 8px 8px 8px;
  background-color: #e8eaed;
}

.collection-list-more {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collection-load-more {
  padding: 14px 0;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.collection-action-sheet {
  background: #eff1f4;
  margin: -16px;
}

.collection-action-group {
  background: #fff;
}

.collection-action,
.collection-action-cancel {
  height: 48px;
  line-height: 48px;
  text-align: center;
  color: #333;
  font-size: 16px;
  border-bottom: 1px solid #f1f2f5;
}

.collection-action-cancel {
  margin-top: 8px;
  background: #fff;
}

.collection-preview-mask {
  position: fixed;
  z-index: 9999;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.9);
}

.collection-video-preview {
  position: relative;
  max-width: 100%;
  max-height: 100%;
}

.collection-video-preview video {
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
  background: #000;
}

.collection-preview-close {
  position: fixed;
  top: 20px;
  right: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  z-index: 999;
}
</style>
