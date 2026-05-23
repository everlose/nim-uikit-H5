<template>
  <FullScreenModal
    :visible="visible"
    :title="t('chatHistoryText')"
    @back="emit('close')"
  >
    <div class="merged-forward-viewer" :aria-label="title">
      <MessageItem
        v-for="(msg, index) in msgs"
        :key="msg.messageClientId || `${msg.createTime}-${index}`"
        :msg="msg"
        :index="index"
        broadcastNewAudioSrc=""
        readonly
      />
    </div>
  </FullScreenModal>
</template>

<script lang="ts" setup>
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import FullScreenModal from "../../../CommonComponents/FullScreenModal.vue";
import { t } from "../../../utils/i18n";
import MessageItem from "../message-item.vue";

defineProps<{
  visible: boolean;
  title: string;
  msgs: V2NIMMessageForUI[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>

<style scoped>
.merged-forward-viewer {
  min-height: 100%;
  padding: 18px 0;
  box-sizing: border-box;
}
</style>
