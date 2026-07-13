<template>
  <Teleport to="body">
    <div v-if="visible" class="fullscreen-modal">
    <div class="fullscreen-modal-header">
      <div class="fullscreen-modal-left">
        <slot name="left">
          <button class="fullscreen-modal-back" type="button" @click="emit('back')">
            <Icon type="icon-zuojiantou" :size="24" />
          </button>
        </slot>
      </div>
      <div class="fullscreen-modal-title">{{ title }}</div>
      <div class="fullscreen-modal-right">
        <slot name="right"></slot>
      </div>
    </div>
    <div class="fullscreen-modal-body">
      <slot></slot>
    </div>
  </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { watch } from "vue";
import Icon from "./Icon.vue";
import emitter from "../utils/eventBus";
import { events } from "../utils/constants";

const props = defineProps<{
  visible: boolean;
  title: string;
}>();

const emit = defineEmits<{
  (e: "back"): void;
}>();

// 打开全屏页面时停止语音播放
watch(() => props.visible, (newVal) => {
  if (newVal) {
    emitter.emit(events.AUDIO_STOP_ALL);
  }
});
</script>

<style scoped>
.fullscreen-modal {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #1f2329;
}

.fullscreen-modal-header {
  position: relative;
  flex: 0 0 auto;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  box-sizing: border-box;
  background: #fff;
}

.fullscreen-modal-left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.fullscreen-modal-back {
  width: 40px;
  min-height: 40px;
  border: 0;
  padding: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.fullscreen-modal-right {
  min-width: 40px;
  min-height: 40px;
  border: 0;
  padding: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.fullscreen-modal-title {
  position: absolute;
  left: 50%;
  max-width: 230px;
  transform: translateX(-50%);
  font-size: 16px;
  font-weight: 500;
  line-height: 25px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fullscreen-modal-body {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  background: #fff;
  -webkit-overflow-scrolling: touch;
}
</style>
