<template>
  <Teleport to="body">
    <div class="msg-location-viewer" @click="emit('close')">
      <div class="msg-location-viewer-close" @click="emit('close')">
        <Icon
          color="#929299"
          :iconStyle="{ fontWeight: '200' }"
          :size="18"
          type="icon-guanbi"
        />
      </div>
      <div class="msg-location-viewer-card" @click.stop>
        <MessageLocation :msg="msg" full-screen />
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import Icon from "../../CommonComponents/Icon.vue";
import MessageLocation from "./message-location.vue";

/**
 * 地理位置消息全屏查看。
 *
 * H5 不接入高德等付费三方地图 SDK，这里只展示占位图 + 地理标题 + 详细地址。
 * 回复消息里被引用的地理位置与消息气泡里的地理位置共用该组件，保证两处表现一致。
 */
defineProps<{ msg: V2NIMMessageForUI }>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>

<style scoped>
.msg-location-viewer {
  position: fixed;
  right: 0;
  bottom: 0;
  top: 0;
  left: 0;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  z-index: 999999999;
}

.msg-location-viewer-card {
  box-sizing: border-box;
  max-width: 90vw;
  padding: 16px 20px;
}

.msg-location-viewer-close {
  position: fixed;
  right: 20px;
  top: 60px;
  z-index: 999999;
}
</style>
