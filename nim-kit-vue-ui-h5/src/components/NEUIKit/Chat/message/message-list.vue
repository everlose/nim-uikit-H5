<template>
  <div class="msg-list-wrapper" @touchstart="handleTapMessageList">
    <div
      id="message-scroll-list"
      class="message-scroll-list"
      ref="messageListRef"
      @scroll="handleScroll"
    >
      <div v-show="hasOlder" @click="onLoadMore" class="view-more-text">
        {{ loadingOlder ? t("loadingMoreText") : t("viewMoreText") }}
      </div>
      <div class="msg-tip" v-show="!hasOlder">{{ t("noMoreText") }}</div>
      <div v-for="(item, index) in finalMsgs" :key="item.messageClientId">
        <MessageItem
          :msg="item"
          :index="index"
          :key="item.messageClientId"
          :reply-msgs-map="replyMsgsMap"
          :broadcastNewAudioSrc="broadcastNewAudioSrc"
          :voice-text-map="props.voiceTextMap"
          :set-voice-text="props.setVoiceText"
          :is-multi-selecting="props.isMultiSelecting"
          :selected="
            props.selectedMessageIds.includes(getMessageSelectKey(item))
          "
          :on-toggle-select="props.onToggleSelect"
          :on-multi-select="props.onMultiSelect"
        />
      </div>
      <div v-if="anchorMode && loadingNewer" class="msg-tip">
        {{ t("loadingMoreText") }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  ref,
  computed,
  onBeforeMount,
  onUnmounted,
  getCurrentInstance,
  nextTick,
  onMounted,
  watch,
} from "vue";
import MessageItem from "./message-item.vue";
import { caculateTimeago } from "../../utils/date";
import { t } from "../../utils/i18n";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import { autorun } from "mobx";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import type { V2NIMTeam } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMTeamService";
import emitter from "../../utils/eventBus";
import { events, MSG_ID_FLAG } from "../../utils/constants";
import { getMessageSelectKey } from "./message-multi-select/utils";

const props = withDefaults(
  defineProps<{
    msgs: V2NIMMessageForUI[];
    conversationType: V2NIMConst.V2NIMConversationType;
    to: string;
    loadingOlder?: boolean;
    hasOlder?: boolean;
    replyMsgsMap?: {
      [key: string]: V2NIMMessageForUI;
    };
    voiceTextMap?: Record<string, string>;
    setVoiceText?: (messageClientId: string, text: string) => void;
    anchorMessageClientId?: string;
    anchorMode?: boolean;
    loadingNewer?: boolean;
    autoScrollToBottom?: boolean;
    onLoadOlder?: (firstMsg?: V2NIMMessageForUI) => void | Promise<unknown>;
    onLoadNewer?: (lastMsg?: V2NIMMessageForUI) => void | Promise<unknown>;
    isMultiSelecting?: boolean;
    selectedMessageIds?: string[];
    onToggleSelect?: (msg: V2NIMMessageForUI) => void;
    onMultiSelect?: (msg: V2NIMMessageForUI) => void;
  }>(),
  {
    loadingOlder: false,
    hasOlder: true,
    anchorMessageClientId: "",
    anchorMode: false,
    loadingNewer: false,
    autoScrollToBottom: true,
    isMultiSelecting: false,
    selectedMessageIds: () => [],
  }
);

const { proxy } = getCurrentInstance()!;
const messageListRef = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let resizeRafId = 0;
let onViewportResize: (() => void) | null = null;
const broadcastNewAudioSrc = ref<string>("");
const anchorScrolled = ref(false);
const anchorScrollId = ref("");
const pagingLock = ref(false);
const pendingPagination = ref<{
  direction: "older" | "newer";
  prevScrollHeight: number;
  prevScrollTop: number;
} | null>(null);

const isNormalMsg = (item: any) =>
  !(
    item.messageType ===
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
    ["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
  );

// 处理完的最终消息列表
const finalMsgs = computed(() => {
  const res: V2NIMMessageForUI[] = [];
  props.msgs.forEach((item, index) => {
    if (
      index > 0 &&
      item.createTime - props.msgs[index - 1].createTime > 5 * 60 * 1000
    ) {
      res.push({
        ...item,
        messageClientId: "time-" + item.createTime,
        messageType: V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
        sendingState:
          V2NIMConst.V2NIMMessageSendingState
            .V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
        // @ts-ignore
        timeValue: caculateTimeago(item.createTime),
      });
    }
    res.push({
      ...item,
    });
  });

  return res;
});

const getFirstNormalMsg = () => finalMsgs.value.find(isNormalMsg);

const getLastNormalMsg = () => {
  const normalMsgs = finalMsgs.value.filter(isNormalMsg);
  return normalMsgs[normalMsgs.length - 1];
};

// 消息滑动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
};

const scrollToAnchor = () => {
  if (!props.anchorMessageClientId) {
    return false;
  }
  const el = document.getElementById(
    `${MSG_ID_FLAG}${props.anchorMessageClientId}`
  );
  if (!el) {
    return false;
  }
  el.scrollIntoView({ block: "center" });
  return true;
};

const unlockPaginationAfterRender = () => {
  requestAnimationFrame(() => {
    const pending = pendingPagination.value;
    if (!pending || props.loadingOlder || props.loadingNewer) {
      return;
    }

    if (messageListRef.value && pending.direction === "older") {
      const nextScrollHeight = messageListRef.value.scrollHeight;
      messageListRef.value.scrollTop =
        pending.prevScrollTop + (nextScrollHeight - pending.prevScrollHeight);
    }

    requestAnimationFrame(() => {
      if (props.loadingOlder || props.loadingNewer) {
        return;
      }
      pagingLock.value = false;
      pendingPagination.value = null;
    });
  });
};

const startPagination = (
  direction: "older" | "newer",
  load: () => void | Promise<unknown>
) => {
  if (pagingLock.value || !messageListRef.value) {
    return;
  }

  pagingLock.value = true;
  pendingPagination.value = {
    direction,
    prevScrollHeight: messageListRef.value.scrollHeight,
    prevScrollTop: messageListRef.value.scrollTop,
  };

  Promise.resolve(load()).finally(() => {
    setTimeout(() => {
      if (!props.loadingOlder && !props.loadingNewer) {
        unlockPaginationAfterRender();
      }
    }, 0);
  });
};

// 加载更多消息
const onLoadMore = () => {
  if (pagingLock.value || props.loadingOlder || !props.onLoadOlder) {
    return;
  }
  const msg = getFirstNormalMsg();
  if (!msg) {
    return;
  }
  startPagination("older", () => props.onLoadOlder?.(msg));
};

const handleScroll = () => {
  if (!messageListRef.value) {
    return;
  }
  if (pagingLock.value || props.loadingOlder || props.loadingNewer) {
    return;
  }

  const { scrollTop, scrollHeight, clientHeight } = messageListRef.value;
  if (
    props.anchorMode &&
    props.onLoadNewer &&
    scrollHeight - scrollTop - clientHeight < 24
  ) {
    const msg = getLastNormalMsg();
    if (msg) {
      startPagination("newer", () => props.onLoadNewer?.(msg));
    }
  }
  if (props.anchorMode && scrollTop < 24) {
    onLoadMore();
  }
};

// 点击消息列表
const handleTapMessageList = () => {
  const activeElement = document.activeElement as HTMLElement;
  if (activeElement && activeElement.tagName === "INPUT") {
    activeElement.blur();
  }

  emitter.emit(events.CLOSE_PANEL);
};

let teamWatch = () => {};

onBeforeMount(() => {
  let team: V2NIMTeam | undefined = undefined;

  teamWatch = autorun(() => {
    team = proxy?.$UIKitStore.teamStore.teams.get(props.to);
  });

  if (
    props.conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    proxy?.$UIKitStore.teamMemberStore.getTeamMemberActive({
      teamId: props.to,
      queryOption: {
        limit: Math.max((team as unknown as V2NIMTeam)?.memberLimit || 0, 200),
        roleQueryType: 0,
      },
    });
  }

  emitter.on(events.ON_LOAD_MORE, onLoadMore);
});

onMounted(() => {
  if (props.autoScrollToBottom) {
    emitter.on(events.ON_SCROLL_BOTTOM, scrollToBottom);
  }

  setTimeout(() => {
    if (props.anchorMessageClientId) {
      if (scrollToAnchor()) {
        anchorScrolled.value = true;
        anchorScrollId.value = props.anchorMessageClientId;
      }
    } else if (props.autoScrollToBottom) {
      scrollToBottom();
    }
  }, 100);

  // 记录上一次的状态，用于判断 resize 前用户是否在底部
  const prevState = { clientHeight: 0, distanceFromBottom: 0 };

  // 滚动容器高度变化时（键盘弹起/收起、网络断开提示条等），若用户之前在底部附近则保持滚到底部
  const scrollEl = messageListRef.value;
  const scrollToBottomIfNear = () => {
    const el = messageListRef.value;
    if (!el) return;
    const { scrollHeight, scrollTop, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const wasNearBottom = prevState.distanceFromBottom < 48;
    const isNearBottom = distanceFromBottom < 48;
    // 容器变矮（键盘弹起）时，之前用户在底部附近 → 需要保持滚到底部
    const containerShrunk = clientHeight < prevState.clientHeight;

    if (isNearBottom || (wasNearBottom && containerShrunk)) {
      el.scrollTop = scrollHeight;
    }

    prevState.clientHeight = clientHeight;
    prevState.distanceFromBottom = distanceFromBottom;
  };

  if (scrollEl) {
    resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(scrollToBottomIfNear);
    });
    resizeObserver.observe(scrollEl);
  }

  // H5 键盘弹起/收起时 visualViewport 变化，但容器 CSS 尺寸可能不变，ResizeObserver 不触发
  onViewportResize = () => {
    scrollToBottomIfNear();
  };
  window.visualViewport?.addEventListener('resize', onViewportResize);
});

watch(
  () => [props.anchorMessageClientId, finalMsgs.value.length],
  () => {
    if (!props.anchorMessageClientId) {
      return;
    }
    if (anchorScrollId.value !== props.anchorMessageClientId) {
      anchorScrolled.value = false;
      anchorScrollId.value = props.anchorMessageClientId;
    }
    if (anchorScrolled.value) {
      return;
    }

    setTimeout(() => {
      if (scrollToAnchor()) {
        anchorScrolled.value = true;
      }
    }, 100);
  }
);

watch(
  () => [finalMsgs.value.length, props.loadingOlder, props.loadingNewer],
  () => {
    const pending = pendingPagination.value;
    if (!pending || props.loadingOlder || props.loadingNewer) {
      return;
    }
    unlockPaginationAfterRender();
  }
);

watch(
  () => props.autoScrollToBottom,
  (autoScroll, oldAutoScroll) => {
    if (oldAutoScroll) {
      emitter.off(events.ON_SCROLL_BOTTOM, scrollToBottom);
    }
    if (autoScroll) {
      emitter.on(events.ON_SCROLL_BOTTOM, scrollToBottom);
    }
  }
);

onUnmounted(() => {
  emitter.off(events.ON_SCROLL_BOTTOM, scrollToBottom);
  emitter.off(events.ON_LOAD_MORE, onLoadMore);
  teamWatch();
  resizeObserver?.disconnect();
  resizeObserver = null;
  cancelAnimationFrame(resizeRafId);
  if (onViewportResize) {
    window.visualViewport?.removeEventListener('resize', onViewportResize);
    onViewportResize = null;
  }
});
</script>

<style scoped>
.msg-list-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  height: 100%;
  box-sizing: border-box;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  background-color: #fff;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.msg-tip {
  text-align: center;
  color: #b3b7bc;
  font-size: 12px;
  margin-top: 10px;
  width: 100%;
}

.block {
  width: 100%;
  height: 40px;
}

.message-scroll-list {
  height: 100%;
  box-sizing: border-box;
  padding-bottom: 1px;
  overflow-y: auto;
  width: 100%;
}

.view-more-text {
  text-align: center;
  color: #b3b7bc;
  font-size: 15px;
  margin-top: 20px;
}
</style>
