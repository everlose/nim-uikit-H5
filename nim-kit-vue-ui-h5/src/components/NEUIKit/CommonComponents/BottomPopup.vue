<template>
  <Transition name="bottom-popup-slide">
    <div class="bottom-popup" v-if="modelValue">
      <div class="popup-mask" @click="handleCancel"></div>
      <div class="popup-content">
        <div class="popup-header" v-if="showHeader">
          <button
            class="cancel-btn"
            v-if="showCancel"
            type="button"
            :aria-label="t('cancelText')"
            @click="handleCancel"
          >
            <Icon type="icon-jiantou" :size="18" />
          </button>
          <div v-if="title" class="popup-title">{{ title }}</div>
          <div class="confirm-btn" v-if="showConfirm" @click="handleConfirm">
            {{ t("okText") }}
          </div>
          <div v-else class="popup-header-placeholder"></div>
        </div>
        <div class="popup-body">
          <slot></slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { t } from "../utils/i18n";
import Icon from "./Icon.vue";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  showHeader?: boolean; // 是否显示头部
  showCancel?: boolean; // 是否显示取消按钮
  showConfirm?: boolean; // 是否显示确定按钮
  title?: string;
}>(), {
  showHeader: true,
  showCancel: true,
  showConfirm: true,
  title: "",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const handleConfirm = () => {
  emit("confirm");
  emit("update:modelValue", false);
};

const handleCancel = () => {
  emit("cancel");
  emit("update:modelValue", false);
};
</script>

<style scoped>
.bottom-popup {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 9999;
}

.popup-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
}

.popup-content {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fff;
  border-radius: 12px 12px 0 0;
}

/* Transition animations */
.bottom-popup-slide-enter-active,
.bottom-popup-slide-leave-active {
  transition: opacity 0.3s ease-out;
}

.bottom-popup-slide-enter-active .popup-content,
.bottom-popup-slide-leave-active .popup-content {
  transition: transform 0.3s ease-out;
}

.bottom-popup-slide-enter-from,
.bottom-popup-slide-leave-to {
  opacity: 0;
}

.bottom-popup-slide-enter-from .popup-content,
.bottom-popup-slide-leave-to .popup-content {
  transform: translateY(100%);
}

.popup-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid #eee;
  box-sizing: border-box;
}

.cancel-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: #999;
}

.cancel-btn :deep(.icon) {
  transform: rotate(90deg);
}

.popup-title {
  position: absolute;
  left: 50%;
  max-width: 220px;
  transform: translateX(-50%);
  overflow: hidden;
  color: #222;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popup-header-placeholder {
  width: 40px;
  height: 40px;
}

.confirm-btn {
  color: #337eff;
  font-size: 16px;
}

.popup-body {
  padding: 16px;
}
</style>
