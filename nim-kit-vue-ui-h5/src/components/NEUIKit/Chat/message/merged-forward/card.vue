<template>
  <div
    :class="`msg-bg ${msg.isSelf ? 'msg-bg-out' : 'msg-bg-in'} merged-forward-card`"
    @click="openMergedForward"
  >
    <div class="merged-forward-card-content">
      <div class="merged-forward-title">
        <span class="merged-forward-title-session">{{ sessionName }}</span>
        <span class="merged-forward-title-suffix">{{ t("messageOfText") }}</span>
      </div>
      <div class="merged-forward-abstracts">
        <span
          v-for="(item, index) in data?.abstracts || []"
          :key="`${item.userAccId}-${index}`"
        >
          <span class="merged-forward-sender">{{ item.senderNick }}: </span>
          <span>{{ item.content }}</span>
          <br v-if="index < (data?.abstracts || []).length - 1" />
        </span>
      </div>
      <div class="merged-forward-footer">{{ t("chatHistoryText") }}</div>
    </div>
  </div>
  <MergedForwardModal
    :visible="visible"
    :title="title"
    :msgs="mergedMsgs"
    @close="visible = false"
  />
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, ref } from "vue";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import { t } from "../../../utils/i18n";
import { showToast } from "../../../utils/toast";
import MergedForwardModal from "./modal.vue";
import {
  normalizeMergedForwardText,
  parseMergedForwardPayload,
} from "./utils";

const props = defineProps<{
  msg: V2NIMMessageForUI;
}>();

const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore;
const visible = ref(false);
const mergedMsgs = ref<V2NIMMessageForUI[]>([]);
const payload = computed(() => parseMergedForwardPayload(props.msg));
const data = computed(() => payload.value?.data);
const sessionName = computed(
  () => data.value?.sessionName || data.value?.sessionId || ""
);
const title = computed(() => `${sessionName.value}${t("messageOfText")}`);

const openMergedForward = async () => {
  if (mergedMsgs.value.length) {
    visible.value = true;
    return;
  }

  try {
    if (!data.value?.url) {
      throw new Error("Merged forward url missing");
    }
    const res = await fetch(data.value.url);
    if (!res.ok) {
      throw new Error("Merged forward fetch failed");
    }
    const text = await res.text();
    const list = store?.msgStore.deserializeMergeMsgs(
      normalizeMergedForwardText(text)
    ) as V2NIMMessageForUI[];
    if (!list?.length) {
      throw new Error("Merged forward deserialize failed");
    }
    mergedMsgs.value = list;
    visible.value = true;
  } catch {
    showToast({
      message: t("getMergedForwardMsgFailedText"),
      type: "error",
      duration: 1000,
    });
  }
};
</script>

<style scoped>
.merged-forward-card {
  width: 63vw;
  max-width: none;
  overflow: hidden;
  padding: 8px;
  background-color: #c9def4;
  cursor: pointer;
}

.msg-bg-in {
  border-radius: 0 8px 8px 8px;
  margin-left: 8px;
}

.msg-bg-out {
  border-radius: 8px 0 8px 8px;
  margin-right: 8px;
}

.merged-forward-card-content {
  background-color: #fff;
  border-radius: 8px 0 8px 8px;
  padding: 12px 16px;
  min-width: 0;
}

.merged-forward-title {
  margin-bottom: 8px;
  display: flex;
  min-width: 0;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}

.merged-forward-title-session {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merged-forward-title-suffix {
  flex: 0 0 auto;
}

.merged-forward-abstracts {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #656a72;
  font-size: 13px;
  line-height: 18px;
}

.merged-forward-sender {
  display: inline-block;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  color: #3d4149;
}

.merged-forward-footer {
  margin: 10px -16px 0;
  padding: 8px 16px 0;
  border-top: 1px solid #edf0f3;
  color: #8b9099;
  font-size: 12px;
  line-height: 17px;
}
</style>
