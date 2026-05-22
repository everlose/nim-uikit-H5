<template>
  <div v-if="visible" class="fullscreen-modal">
    <div class="fullscreen-modal-header">
      <button class="fullscreen-modal-back" type="button" @click="emit('back')">
        <Icon type="icon-zuojiantou" :size="24" />
      </button>
      <div class="fullscreen-modal-title">{{ title }}</div>
      <div class="fullscreen-modal-spacer"></div>
    </div>
    <div class="fullscreen-modal-body">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Icon from "./Icon.vue";

defineProps<{
  visible: boolean;
  title: string;
}>();

const emit = defineEmits<{
  (e: "back"): void;
}>();
</script>

<style scoped>
.fullscreen-modal {
  position: fixed;
  inset: 0;
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

.fullscreen-modal-back,
.fullscreen-modal-spacer {
  width: 40px;
  min-height: 40px;
  border: 0;
  padding: 0;
  background: transparent;
  display: flex;
  align-items: center;
}

.fullscreen-modal-back {
  justify-content: flex-start;
}

.fullscreen-modal-spacer {
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
