<template>
  <div
    class="message-location"
    :class="[
      props.isSelf ? 'message-location-out' : 'message-location-in',
      props.fullScreen ? 'message-location-full' : '',
      props.onViewLocation ? 'message-location-clickable' : '',
    ]"
    @click="props.onViewLocation?.()"
  >
    <div v-if="location.title" class="message-location-title">{{ location.title }}</div>
    <div v-if="location.address" class="message-location-address">{{ location.address }}</div>
    <div
      class="message-location-map"
      :style="{ backgroundImage: `url(${locationPlaceholder})` }"
      aria-hidden="true"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import locationPlaceholder from "../../static/location-default.png";
import { normalizeLocationMessage } from "./message-location";
import "./message-location.css";

const props = defineProps<{
  msg: V2NIMMessageForUI;
  isSelf?: boolean;
  /** 点击查看地理位置的入口。不传时卡片不可点击（例如置顶列表、收藏页里的消息预览） */
  onViewLocation?: () => void;
  /** 全屏查看时的排版：放宽宽度，地理标题与详细地址完整展示不截断 */
  fullScreen?: boolean;
}>();
const location = computed(() => normalizeLocationMessage(props.msg.text, props.msg.attachment));
</script>
