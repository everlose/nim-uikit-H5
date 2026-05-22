<template>
  <div class="avatar-with-status">
    <Avatar :account="account" v-bind="$attrs" />
    <div
      v-if="showStatus"
      :class="['status-dot', isOnline ? 'online' : 'offline']"
    />
  </div>
</template>

<script lang="ts" setup>
/**
 * 带在线状态圆点的头像组件
 * 在头像右下角展示用户的在线/离线状态
 */
import { autorun } from 'mobx'
import { ref, onUnmounted, getCurrentInstance } from 'vue'
import Avatar from './Avatar.vue'
import { checkUserOnline } from '../utils/userStatus'

const props = withDefaults(
  defineProps<{
    /** 用户账号 */
    account: string
    /** 是否显示在线状态圆点，默认 true */
    showStatus?: boolean
  }>(),
  {
    showStatus: true,
  }
)

const { proxy } = getCurrentInstance()!

const isOnline = ref(false)

// 使用 MobX autorun 监听状态变化
// 注意：需要显式读取 stateMap 来建立 MobX 依赖追踪
// 直接调用 getUserStatus 时，如果 key 不存在，MobX 不会追踪后续的添加操作
const dispose = autorun(() => {
  const stateMap = proxy?.$UIKitStore?.subscriptionStore?.stateMap
  const userStatus = stateMap?.get(props.account)
  isOnline.value = checkUserOnline(userStatus)
})

onUnmounted(() => {
  dispose()
})
</script>

<style scoped>
.avatar-with-status {
  position: relative;
  display: inline-block;
}

.status-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-sizing: border-box;
}

.status-dot.online {
  background-color: #00b853;
}

.status-dot.offline {
  background-color: #cccccc;
}
</style>
