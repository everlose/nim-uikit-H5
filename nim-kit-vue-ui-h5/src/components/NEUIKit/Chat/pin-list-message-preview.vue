<template>
  <template
    v-if="msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT"
  >
    <div
      class="pin-message-preview pin-message-preview-text"
      @click="handleTextPreviewClick"
    >
      <MessageText :msg="msg" />
    </div>
    <PreviewText
      :visible="isPreviewVisible"
      :msg="msg"
      :onClose="() => (isPreviewVisible = false)"
    />
  </template>
  <template
    v-else-if="msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE"
  >
    <img
      class="pin-message-image"
      :src="imageThumbUrl"
      :style="imageRenderStyle"
      :lazy-load="true"
      mode="aspectFill"
      @click="handleImageTouch"
    />
    <PreviewImage
      :visible="isPreviewVisible"
      :image-url="imageUrl"
      :onClose="() => (isPreviewVisible = false)"
    />
  </template>
  <div
    v-else-if="msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO"
    class="pin-message-preview-audio"
  >
    <MessageAudio :msg="msg" mode="audio-in" />
  </div>
  <div
    v-else-if="msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO"
    class="pin-video-msg-wrapper"
    @click="handleVideoTouch"
  >
    <div class="pin-video-play-button">
      <div class="pin-video-play-icon"></div>
    </div>
    <img
      class="pin-message-image"
      :style="imageRenderStyle"
      :src="videoFirstFrameDataUrl"
      :lazy-load="true"
      mode="aspectFill"
    />
  </div>
  <div
    v-else-if="msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE"
    class="pin-message-preview-file"
  >
    <MessageFile :msg="msg" />
  </div>
  <div
    v-else-if="mergedForwardPayload"
    class="pin-message-preview-merged-card"
    @click="openMergedForward"
  >
    <div class="pin-merged-forward-title">
      {{ mergedForwardTitle }}
    </div>
    <div class="pin-merged-forward-abstracts">
      <div
        v-for="(item, index) in mergedForwardPayload.data?.abstracts || []"
        :key="index"
      >
        <span class="pin-merged-forward-sender">{{ item.senderNick }}: </span>
        <span>{{ item.content }}</span>
      </div>
    </div>
  </div>
  <div v-else class="pin-message-preview">[{{ t("unknowMsgText") }}]</div>
  <MergedForwardModal
    v-if="mergedVisible"
    :visible="mergedVisible"
    :title="mergedForwardTitle"
    :msgs="mergedMsgs"
    @close="mergedVisible = false"
  />
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, ref } from "vue";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import MessageText from "./message/message-text.vue";
import MessageAudio from "./message/message-audio.vue";
import MessageFile from "./message/message-file.vue";
import PreviewImage from "../CommonComponents/PreviewImage.vue";
import PreviewText from "../CommonComponents/PreviewText.vue";
import MergedForwardModal from "./message/merged-forward/modal.vue";
import { t } from "../utils/i18n";
import { showToast } from "../utils/toast";
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from "../utils/image";
import { normalizeMergedForwardText, parseMergedForwardPayload } from "./message/merged-forward/utils";

const props = defineProps<{
  msg: V2NIMMessageForUI;
}>();

const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore;
const isPreviewVisible = ref(false);
const mergedMsgs = ref<V2NIMMessageForUI[]>([]);
const mergedVisible = ref(false);

const mergedForwardPayload = computed(() => parseMergedForwardPayload(props.msg));

const mergedForwardTitle = computed(() => {
  const payload = mergedForwardPayload.value;
  const sessionName = payload?.data?.sessionName || payload?.data?.sessionId || "";
  return `${sessionName}${t("messageOfText")}`;
});

const openMergedForward = async () => {
  if (mergedMsgs.value.length) {
    mergedVisible.value = true;
    return;
  }
  const data = mergedForwardPayload.value?.data;
  try {
    if (!data?.url) throw new Error("url missing");
    const res = await fetch(data.url);
    if (!res.ok) throw new Error("fetch failed");
    const text = await res.text();
    const list = store?.msgStore.deserializeMergeMsgs(
      normalizeMergedForwardText(text)
    ) as V2NIMMessageForUI[];
    if (!list?.length) throw new Error("deserialize failed");
    mergedMsgs.value = list;
    mergedVisible.value = true;
  } catch {
    showToast({
      message: t("getMergedForwardMsgFailedText"),
      type: "error",
      duration: 1000,
    });
  }
};

const imageUrl = computed(() => {
  if (props.msg.messageStatus?.errorCode === 102426) {
    return "https://yx-web-nosdn.netease.im/common/c1f278b963b18667ecba4ee9a6e68047/img-fail.png";
  }
  return (props.msg.attachment as any)?.url || (props.msg.attachment as any)?.file || "";
});

const imageThumbUrl = computed(() => {
  const { width, height } = getImageAttachmentSize(props.msg.attachment);
  return getImageThumbUrl(imageUrl.value, width, height);
});

const imageRenderStyle = computed(() => {
  const { width, height } = getImageAttachmentSize(props.msg.attachment);
  return getImageRenderStyle(width, height, "compact");
});

const videoFirstFrameDataUrl = computed(() => {
  const url = (props.msg.attachment as any)?.url;
  return url ? `${url}${url.includes("?") ? "&" : "?"}vframe=1` : "";
});

const handleImageTouch = () => {
  if (imageUrl.value) {
    isPreviewVisible.value = true;
  }
};

const handleTextPreviewClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest("a")) return;
  isPreviewVisible.value = true;
};

const handleVideoTouch = () => {
  const url = (props.msg.attachment as any)?.url;
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};
</script>

<style scoped>
.pin-message-preview-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}

.pin-message-preview {
  color: #666;
  line-height: 20px;
}

.pin-message-preview-merged-card {
  padding: 12px 16px;
  border: 1px solid #edf0f3;
  border-radius: 8px;
  cursor: pointer;
  line-height: 18px;

  &:active {
    background-color: #f5f6f8;
  }
}

.pin-merged-forward-title {
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 500;
  color: #1f2329;
}

.pin-merged-forward-abstracts {
  color: #656a72;
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pin-merged-forward-sender {
  display: inline-block;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  color: #3d4149;
}

.pin-message-image {
  display: block;
  max-width: 100%;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  background: #f5f6f8;
}

.pin-message-preview-audio {
  display: inline-flex;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: #e8eaed;
}

.pin-message-preview-file {
  max-width: min(320px, 68vw);
}

.pin-message-preview-file :deep(.msg-file-wrapper) {
  max-width: 100%;
}

.pin-video-msg-wrapper {
  box-sizing: border-box;
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.pin-video-play-button {
  width: 42px;
  height: 42px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  z-index: 9;
}

.pin-video-play-icon {
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 15px solid #fff;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-40%, -50%);
}
</style>
