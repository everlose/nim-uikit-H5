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
  <div v-else class="pin-message-preview">[{{ t("unknowMsgText") }}]</div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import MessageText from "./message/message-text.vue";
import MessageAudio from "./message/message-audio.vue";
import MessageFile from "./message/message-file.vue";
import PreviewImage from "../CommonComponents/PreviewImage.vue";
import PreviewText from "../CommonComponents/PreviewText.vue";
import { t } from "../utils/i18n";
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from "../utils/image";

const props = defineProps<{
  msg: V2NIMMessageForUI;
}>();

const isPreviewVisible = ref(false);

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
