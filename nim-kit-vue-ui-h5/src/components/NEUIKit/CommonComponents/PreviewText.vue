<template>
  <div
    v-if="visible && msg"
    class="text-preview-mask"
    @click="handleClose"
  >
    <div class="text-preview-body" @click.stop>
      <div class="text-preview-content">
        <MessageText :msg="msg" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onUnmounted, watch } from "vue";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import MessageText from "../Chat/message/message-text.vue";

const props = defineProps<{
  visible: boolean;
  msg?: V2NIMMessageForUI;
  onClose?: () => void;
}>();

const handleClose = () => {
  props.onClose?.();
};

watch(
  () => props.visible,
  (visible) => {
    document.body.style.overflow = visible ? "hidden" : "";
  },
  { immediate: true }
);

onUnmounted(() => {
  document.body.style.overflow = "";
});
</script>

<style scoped>
.text-preview-mask {
  position: fixed;
  z-index: 9999;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  background: #eef3f7;
}

.text-preview-body {
  position: relative;
  width: 100%;
  max-width: calc(100vw - 48px);
  max-height: 78vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.text-preview-content {
  color: #333;
  font-size: 28px;
  line-height: 38px;
  text-align: center;
  word-break: break-word;
}

.text-preview-content :deep(.msg-text) {
  text-align: center;
}
</style>
