<template>
  <div
    ref="itemRef"
    :class="[
      'conversation-item-container',
      {
        'show-action-list': showMoreActions,
        'stick-on-top': conversation.stickTop,
      },
    ]"
    @touchstart="handleTouchStart"
    @click="() => handleConversationItemClick()"
  >
    <div class="conversation-item-content">
      <div class="conversation-item-left">
        <div class="unread" v-if="unread">
          <div class="dot" v-if="isMute"></div>
          <div class="badge" v-else>{{ unread }}</div>
        </div>
        <!-- P2P 单聊展示在线状态 -->
        <AvatarWithStatus
          v-if="conversation.type === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P"
          :account="to"
        />
        <!-- 群聊不展示在线状态 -->
        <Avatar
          v-else
          :account="to"
          :avatar="teamAvatar"
        />
      </div>
      <div class="conversation-item-right">
        <div class="conversation-item-top">
          <Appellation
            class="conversation-item-title"
            v-if="
              conversation.type ===
              V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
            "
            :account="to"
          />
          <span v-else class="conversation-item-title">
            {{ sessionName }}
          </span>
          <span class="conversation-item-time">{{ date }}</span>
        </div>
        <div class="conversation-item-desc">
          <span class="conversation-item-desc-span">
            <span v-if="beMentioned" class="beMentioned">
              {{ "[" + t("someoneText") + "@" + t("meText") + "]" }}
            </span>
            <!-- <ConversationItemIsRead
              v-if="showSessionUnread"
              :conversation="props.conversation"
            ></ConversationItemIsRead> -->
            <span
              v-if="props.conversation.lastMessage"
              class="conversation-item-desc-content"
            >
              <LastMsgContent :lastMessage="props.conversation.lastMessage" />
            </span>
          </span>
          <div class="conversation-item-state">
            <Icon
              v-if="isMute"
              iconClassName="conversation-item-desc-state"
              type="icon-xiaoximiandarao"
              color="#ccc"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="right-action-list">
      <div
        v-for="action in moreActions"
        :key="action.type"
        :class="['right-action-item', action.class]"
        @click="() => handleClick(action.type)"
      >
        {{ action.name }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Avatar from "../CommonComponents/Avatar.vue";
import AvatarWithStatus from "../CommonComponents/AvatarWithStatus.vue";
import Appellation from "../CommonComponents/Appellation.vue";
import Icon from "../CommonComponents/Icon.vue";
import { computed, ref, onMounted, onUnmounted, onUpdated, getCurrentInstance } from "vue";
import dayjs from "dayjs";
import { t } from "../utils/i18n";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type {
  V2NIMConversationForUI,
  V2NIMLocalConversationForUI,
  V2NIMMessageForUI,
} from "@xkit-yx/im-store-v2/dist/types/src/types";
import ConversationItemIsRead from "./conversation-item-read.vue";
import LastMsgContent from "./conversation-item-last-msg-content.vue";
const props = withDefaults(
  defineProps<{
    conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI;
    showMoreActions?: boolean;
  }>(),
  { showMoreActions: false }
);
const { proxy } = getCurrentInstance()!; // 获取组件实例

const emit = defineEmits(["click", "delete", "stickyToTop", "leftSlide"]);

const moreActions = computed(() => {
  return [
    {
      name: props.conversation.stickTop
        ? t("deleteStickTopText")
        : t("addStickTopText"),
      class: "action-top",
      type: "action-top",
    },
    {
      name: t("deleteSessionText"),
      class: "action-delete",
      type: "action-delete",
    },
  ];
});

const handleClick = (type: string) => {
  if (type === "action-top") {
    emit("stickyToTop", props.conversation);
  } else {
    emit("delete", props.conversation);
  }
};

// 群头像
const teamAvatar = computed(() => {
  if (
    props.conversation.type ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    const { avatar } = props.conversation;
    return avatar;
  }
});

// 会话名称
const sessionName = computed(() => {
  if (props.conversation.name) {
    return props.conversation.name;
  }
  return props.conversation.conversationId;
});

const to = computed(() => {
  const res = proxy?.$NIM.V2NIMConversationIdUtil.parseConversationTargetId(
    props.conversation.conversationId
  );
  return res;
});

const date = computed(() => {
  const time =
    props.conversation.lastMessage?.messageRefer.createTime ||
    props.conversation.updateTime;
  // 如果最后一条消息时间戳不存在，则会话列表不显示
  if (!time) {
    return "";
  }
  const _d = dayjs(time);
  const isCurrentDay = _d.isSame(dayjs(), "day");
  const isCurrentYear = _d.isSame(dayjs(), "year");

  if (isCurrentDay) {
    return _d.format("HH:mm");
  }
  if (isCurrentYear) {
    return _d.format(t("timeFormatSameYear"));
  }
  return _d.format(t("timeFormatDiffYear"));
});

const max = 99;

const unread = computed(() => {
  return props.conversation.unreadCount > 0
    ? props.conversation.unreadCount > max
      ? `${max}+`
      : props.conversation.unreadCount + ""
    : "";
});

const isMute = computed(() => {
  return !!props.conversation.mute;
});

const beMentioned = computed(() => {
  const store = proxy?.$UIKitStore;

  if (props.conversation.unreadCount === 0) {
    return false;
  }

  if (props.conversation.aitMsgs?.length) {
    // 从本地内存查找这些@消息
    const aitMessages = store?.msgStore.getMsg(
      props.conversation.conversationId,
      props.conversation.aitMsgs
    );
    if (aitMessages && aitMessages.length > 0) {
      // 找到了@消息，检查是否有消息时间 > 已读时间（即真正未读的@消息）
      const lastReadTime = (props.conversation as V2NIMConversationForUI).lastReadTime ?? 0;
      return aitMessages.some((msg: V2NIMMessageForUI) => msg.createTime > lastReadTime);
    }
    // 本地内存中没找到消息（如页面刷新后消息未加载），fallback 到 lastMessage 检测
  }

  const lastMsg = props.conversation.lastMessage;
  if (!lastMsg?.serverExtension) {
    return false;
  }

  try {
    const ext = JSON.parse(lastMsg.serverExtension);
    if (!ext?.yxAitMsg) {
      return false;
    }

    const myAccountId = proxy?.$NIM.V2NIMLoginService.getLoginUser();
    return myAccountId in ext.yxAitMsg || "ait_all" in ext.yxAitMsg;
  } catch {
    return false;
  }
});

const showSessionUnread = computed(() => {
  const myUserAccountId = proxy?.$NIM.V2NIMLoginService.getLoginUser();
  if (
    props.conversation.type ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
  ) {
    return (
      props?.conversation?.lastMessage?.messageRefer.senderId ===
        myUserAccountId &&
      props?.conversation?.lastMessage?.messageType !==
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL &&
      props?.conversation?.lastMessage?.messageType !==
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION &&
      props?.conversation?.lastMessage?.sendingState ===
        V2NIMConst.V2NIMMessageSendingState
          .V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED &&
      props?.conversation?.lastMessage?.lastMessageState !==
        V2NIMConst.V2NIMLastMessageState.V2NIM_MESSAGE_STATUS_REVOKE
    );
  } else {
    return false;
  }
});

// 滑动阈值 & 左滑显示 action 动画
const SWIPE_THRESHOLD = 60
let startX = 0,
  startY = 0
let swipeTriggered = false
const itemRef = ref<HTMLElement>()

function handleTouchStart(event: TouchEvent) {
  startX = event.changedTouches[0].pageX
  startY = event.changedTouches[0].pageY
  swipeTriggered = false
}

// touchmove 通过原生监听注册，以支持 { passive: false } 调用 preventDefault
function handleTouchMove(event: TouchEvent) {
  if (swipeTriggered) {
    event.preventDefault()
    return
  }
  const diffX = event.changedTouches[0].pageX - startX
  const diffY = event.changedTouches[0].pageY - startY

  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_THRESHOLD) {
    swipeTriggered = true
    event.preventDefault()
    if (diffX < 0) {
      emit("leftSlide", props.conversation)
    } else {
      emit("leftSlide", null)
    }
  }
}

onMounted(() => {
  itemRef.value?.addEventListener('touchmove', handleTouchMove, { passive: false })
})

onUnmounted(() => {
  itemRef.value?.removeEventListener('touchmove', handleTouchMove)
})

function handleConversationItemClick() {
  if (props.showMoreActions) {
    emit("leftSlide", null);
    return;
  }
  emit("click", props.conversation);
}

onUpdated(() => {
  console.log("onUpdated", props.conversation.unreadCount);
});
</script>

<style scoped>
/* 基础容器 */
.conversation-item-container {
  position: relative;
  transition: transform 0.3s;
  z-index: 9;
  touch-action: pan-y;
}

.conversation-item-container.show-action-list {
  transform: translateX(-200px);
}

.conversation-item-container.stick-on-top {
  background: #f3f5f7;
}

.beMentioned {
  color: #ff4d4f;
  margin-right: 4px;
}

.content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右侧操作列表 */
.right-action-list {
  position: absolute;
  top: 0;
  right: -200px;
  bottom: 0;
  width: 200px;
}

.right-action-item {
  width: 100px;
  display: inline-block;
  color: #fff;
  text-align: center;
  height: 72px;
  line-height: 72px;
}

.action-top {
  background: #337eff;
}

.action-delete {
  background: #a8abb6;
}

/* 会话内容 */
.conversation-item-content {
  display: flex;
  align-items: center;
  padding: 10px 20px 10px 15px;
  height: 72px;
  box-sizing: border-box;
  user-select: none;
}

.conversation-item-left {
  position: relative;
}

.conversation-item-desc-span {
  display: flex;
  flex: 1;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
}

.conversation-item-state {
  display: inline-block;
  width: 26px;
  box-sizing: border-box;
  height: 22px;
}
.conversation-item-badge {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
}

.conversation-item-right {
  flex: 1;
  width: 0;
  margin-left: 10px;
}

.conversation-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conversation-item-time {
  font-size: 12px;
  color: #ccc;
  text-align: right;
  width: 105px;
  flex-shrink: 0;
}

.conversation-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(51, 51, 51);
  font-size: 16px;
}

.conversation-item-desc {
  width: 100%;
  font-size: 13px;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  overflow: hidden;
}

.conversation-item-desc-state {
  margin-left: 10px;
}

.conversation-item-desc-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* 未读标记 */
.dot {
  background-color: #ff4d4f;
  color: #fff;
  width: 10px;
  height: 10px;
  border-radius: 5px;
  box-sizing: border-box;
  z-index: 99;
}

.badge {
  background-color: #ff4d4f;
  color: #fff;
  font-size: 12px;
  min-width: 20px;
  height: 20px;
  line-height: 19px;
  border-radius: 10px;
  padding: 0 5px;
  box-sizing: border-box;
  text-align: center;
  z-index: 99;
  position: relative;
}

.unread {
  position: absolute;
  right: -4px;
  top: -2px;
  z-index: 99;
}

.conversation-item-desc-ait {
  display: inline-block;
}
</style>
