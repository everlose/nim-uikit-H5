<template>
  <FullScreenModal
    :visible="visible"
    :title="t('chatHistoryText')"
    @back="emit('close')"
  >
    <div class="merged-forward-viewer" :aria-label="title">
      <MessageItem
        v-for="(msg, index) in finalMsgs"
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
import { computed } from "vue";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import FullScreenModal from "../../../CommonComponents/FullScreenModal.vue";
import { t } from "../../../utils/i18n";
import { caculateTimeago } from "../../../utils/date";
import MessageItem from "../message-item.vue";

const props = defineProps<{
  visible: boolean;
  title: string;
  msgs: V2NIMMessageForUI[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const finalMsgs = computed(() => {
  const res: any[] = [];
  props.msgs.forEach((item, index) => {
    if (index === 0 || item.createTime - props.msgs[index - 1].createTime > 5 * 60 * 1000) {
      res.push({
        ...item,
        messageClientId: "time-" + item.createTime,
        messageType: V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
        sendingState: V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
        timeValue: caculateTimeago(item.createTime),
      });
    }
    res.push({ ...item });
  });
  return res;
});
</script>

<style scoped>
.merged-forward-viewer {
  min-height: 100%;
  padding: 18px 0;
  box-sizing: border-box;
}

.merged-forward-viewer :deep(.msg-time) {
  margin-top: 12px;
}

.merged-forward-viewer :deep(.msg-item-wrapper) {
  padding-top: 0;
  padding-bottom: 0;
}
</style>
