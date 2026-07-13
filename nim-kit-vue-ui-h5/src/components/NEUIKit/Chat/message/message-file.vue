<template>
  <div
    class="msg-file-wrapper"
    @click="() => downloadFile(url, name)"
  >
    <div
      :class="!msg.isSelf ? 'msg-file msg-file-in' : 'msg-file msg-file-out'"
    >
      <div
        class="msg-file-icon-wrapper"
        :class="{ 'msg-file-icon-wrapper-uploading': isUploading }"
        :style="progressStyle"
      >
        <Icon :type="iconType" :size="32" iconClassName="msg-file-icon"></Icon>
        <div v-if="isUploading" class="msg-file-upload-ring"></div>
      </div>
      <div class="msg-file-content">
        <div class="msg-file-title">
          <div class="msg-file-title-prefix">{{ prefixName }}</div>
          <div class="msg-file-title-suffix">{{ ext }}</div>
        </div>
        <div class="msg-file-size">{{ parseFileSize(size) }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getFileType, parseFileSize } from "@xkit-yx/utils";
import Icon from "../../CommonComponents/Icon.vue";
import { computed } from "vue";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import type { V2NIMMessageFileAttachment } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import { downloadFile } from "../../utils/file";

const props = withDefaults(defineProps<{ msg: V2NIMMessageForUI }>(), {});

const fileIconMap = {
  pdf: "icon-PPT",
  word: "icon-Word",
  excel: "icon-Excel",
  ppt: "icon-PPT",
  zip: "icon-RAR1",
  txt: "icon-qita",
  img: "icon-tupian2",
  audio: "icon-yinle",
  video: "icon-shipin",
};

const {
  name = "",
  url = "",
  ext = "",
  size = 0,
} = (props.msg.attachment as V2NIMMessageFileAttachment) || {};

// 去掉扩展名的文件名前缀
const index = name.lastIndexOf(".");
const prefixName = index > -1 ? name.slice(0, index) : name;

// 获取文件类型图标
const iconType = fileIconMap[getFileType(ext)] || "icon-weizhiwenjian";

const uploadProgress = computed(() => {
  const progress = Number((props.msg as V2NIMMessageForUI & { uploadProgress?: number }).uploadProgress || 0);
  return Math.max(0, Math.min(100, progress));
});

const isUploading = computed(
  () =>
    props.msg.sendingState ===
      V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING &&
    uploadProgress.value < 100
);

const progressStyle = computed(() => ({
  "--file-upload-progress": `${uploadProgress.value * 3.6}deg`,
}));
</script>

<style scoped>
.msg-file-wrapper {
  height: fit-content;
  display: block;
  max-width: 63vw;
  padding: 0;
  box-sizing: border-box;
}
/* 文件消息基础样式 */
.msg-file {
  height: 56px;
  max-width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #dee0e2;
  box-sizing: border-box;
  background-color: #FFF;
}

.msg-file-icon-wrapper {
  position: relative;
  /* width: 40px; */
  height: 40px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
}

.msg-file-icon-wrapper-uploading::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.42);
  z-index: 2;
}

.msg-file-icon-wrapper :deep(.msg-file-icon) {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
}

.msg-file-upload-ring {
  position: absolute;
  top: 10px;
  right: 10px;
  bottom: 10px;
  left: 10px;
  border-radius: 50%;
  background: conic-gradient(
    #fff var(--file-upload-progress),
    rgba(255, 255, 255, 0.34) 0
  );
  z-index: 3;
}

.msg-file-upload-ring::after {
  content: "";
  position: absolute;
  top: 4px;
  right: 4px;
  bottom: 4px;
  left: 4px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
}

/* 接收的文件消息 */
.msg-file-in {
  margin-left: 8px;
}

/* 发送的文件消息 */
.msg-file-out {
  margin-right: 8px;
}

/* 文件内容区域 */
.msg-file-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  margin-left: 12px;
  flex: 1;
  min-width: 0;
}

/* 文件标题区域 */
.msg-file-title {
  color: #000;
  font-size: 14px;
  font-weight: 400;
  display: flex;
  min-width: 0;
  line-height: 1;
}

/* 文件名前缀 */
.msg-file-title-prefix {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件名后缀 */
.msg-file-title-suffix {
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件名 */
.msg-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件大小 */
.msg-file-size {
  color: #999;
  font-size: 10px;
  line-height: 1;
}
</style>
