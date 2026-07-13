<template>
  <BottomPopup
    v-model="visible"
    :showHeader="false"
    :showCancel="false"
    :showConfirm="false"
    @cancel="$emit('close')"
    class="action-sheet-popup"
  >
    <div class="action-sheet">
      <div class="action-sheet-group">
        <div
          v-for="(action, index) in actions"
          :key="index"
          class="action-sheet-item"
          @click="action.onClick"
        >
          {{ action.text }}
        </div>
      </div>
      <div class="action-sheet-cancel" @click="handleClose">
        {{ t("cancelText") }}
      </div>
    </div>
  </BottomPopup>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { t } from "../utils/i18n";
import BottomPopup from "./BottomPopup.vue";

interface ActionSheetAction {
  text: string;
  onClick: () => void;
}

const props = defineProps<{
  modelValue: boolean;
  actions: ActionSheetAction[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "close"): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const handleClose = () => {
  emit("close");
  emit("update:modelValue", false);
};
</script>

<style scoped>
.action-sheet-popup :deep(.popup-content) {
  left: 0;
  right: 0;
  background: transparent;
  border-radius: 0;
  padding: 0 12px calc(env(safe-area-inset-bottom) + 30px);
  box-sizing: border-box;
}

.action-sheet-popup :deep(.popup-body) {
  padding: 0;
  max-height: none;
  overflow: visible;
}

.action-sheet {
  width: 100%;
}

.action-sheet-group,
.action-sheet-cancel {
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
}

.action-sheet-cancel {
  margin-top: 12px;
}

.action-sheet-item,
.action-sheet-cancel {
  width: 100%;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0;
  color: #333;
  font-size: 14px;
  text-align: center;
}

.action-sheet-item + .action-sheet-item {
  border-top: 1px solid #dedede;
}
</style>
