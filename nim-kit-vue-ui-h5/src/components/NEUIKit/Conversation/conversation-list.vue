<template>
  <div class="conversation-wrapper" @click="hideAddDropdown">
    <div class="navigation-bar">
      <div class="logo-box">
        <img
          src="https://yx-web-nosdn.netease.im/common/bbcd9929e31bfee02663fc0bcdabe1c5/yx-logo.png"
          class="logo-img"
        />
        <div>{{ t("appText") }}</div>
      </div>
      <div class="right-actions">
        <div class="button-icon-search" @click.stop="goToSearchPage">
          <Icon type="icon-sousuo" :size="20" />
        </div>
        <div :class="buttonClass">
          <div class="button-icon-add" @click.stop="showAddDropdown">
            <Icon type="icon-add" :size="20" />
          </div>
          <div v-if="addDropdownVisible" class="dropdown-container" @click.stop>
          <div class="add-menu-list">
            <div class="add-menu-item" @click="onDropdownClick('addFriend')">
              <Icon type="icon-tianjiahaoyou" :style="{ marginRight: '5px' }" />
              {{ t("addFriendText") }}
            </div>
            <div class="add-menu-item" @click="onDropdownClick('createGroup')">
              <Icon
                type="icon-chuangjianqunzu"
                :style="{ marginRight: '5px' }"
              />
              {{ t("createTeamText") }}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
    <NetworkAlert />
    <div class="security-tip">
      <svg class="security-tip-icon" width="14" height="14" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 0C4.706 0 0 4.706 0 10.5S4.706 21 10.5 21 21 16.294 21 10.5 16.294 0 10.5 0zm.75 15h-1.5v1.5h1.5V15zm-1.5-2V4.5h1.5V13h-1.5z" fill="#FC596A"/>
      </svg>{{ t("securityTipText") }}<span class="security-tip-report" @click="handleReportClick">{{ t("reportText") }}</span>
    </div>
    <div v-if="!conversationList || conversationList.length === 0" class="conversation-list-wrapper">
      <Empty
        v-if="conversationList.length === 0"
        :text="t('conversationEmptyText')"
      />
    </div>
    <div
      v-else
      class="conversation-list-wrapper"
      ref="listWrapper"
      @scroll="handleScroll"
    >
      <div
        v-for="conversation in conversationList"
        :key="conversation.conversationId"
      >
        <ConversationItem
          :key="conversation.conversationId"
          :showMoreActions="
            currentMoveSessionId === conversation.conversationId
          "
          :conversation="conversation"
          @delete="handleSessionItemDeleteClick"
          @stickyToTop="handleSessionItemStickTopChange"
          @click="handleSessionItemClick"
          @leftSlide="handleSessionItemLeftSlide"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
/** 会话列表主界面 */
import { onUnmounted, ref, getCurrentInstance } from "vue";
import { autorun } from "mobx";
import Icon from "../CommonComponents/Icon.vue";
import NetworkAlert from "../CommonComponents/NetworkAlert.vue";
import Empty from "../CommonComponents/Empty.vue";
import ConversationItem from "./conversation-item.vue";
import { t } from "../utils/i18n";
import { showToast } from "../utils/toast";
import { showModal } from "../utils/modal";
import type {
  V2NIMConversationForUI,
  V2NIMLocalConversationForUI,
} from "@xkit-yx/im-store-v2/dist/types/src/types";
import { useRouter } from "vue-router";
import { neUiKitRouterPath } from "../utils/uikitRouter";
import { onMounted } from "vue";
import { trackInit } from "../utils/reporter";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import { clearVoiceTextCache } from "../Chat/voiceTextCache";

const conversationList = ref<
  (V2NIMConversationForUI | V2NIMLocalConversationForUI)[]
>([]);
const addDropdownVisible = ref(false);

const currentMoveSessionId = ref("");

let buttonClass = "button-box";

const router = useRouter();

const { proxy } = getCurrentInstance()!; // 获取组件实例
const store = proxy?.$UIKitStore;
const nim = proxy?.$NIM;

trackInit("ContactUIKit", nim?.options?.appkey);

/**是否是云端会话 */
const enableV2CloudConversation = store?.sdkOptions?.enableV2CloudConversation;

const listWrapper = ref<HTMLElement | null>(null);
const loading = ref(false);

onMounted(() => {
  clearVoiceTextCache();
  store?.uiStore.selectConversation("");
});

// 处理滚动事件
const handleScroll = async (e: Event) => {
  const target = e.target as HTMLElement;
  if (!target) return;

  // 判断是否滚动到底部
  const isBottom =
    target.scrollHeight - target.scrollTop <= target.clientHeight + 1;

  if (isBottom && !loading.value) {
    loading.value = true;
    const limit = store?.localOptions.conversationLimit || 100;
    try {
      // 这里添加加载更多会话的逻辑
      if (enableV2CloudConversation) {
        const offset =
          store.uiStore.conversations[store.uiStore.conversations.length - 1]
            ?.sortOrder;
        await store?.conversationStore?.getConversationListActive(
          offset,
          limit
        );
      } else {
        const offset = store?.uiStore.localConversations[
          store.uiStore.localConversations.length - 1
        ]?.sortOrder as number;
        await store?.localConversationStore?.getConversationListActive(
          offset,
          limit
        );
      }
    } catch (error) {
      console.error("加载更多会话失败:", error);
    } finally {
      loading.value = false;
    }
  }
};

/** 会话左滑 */
const handleSessionItemLeftSlide = (
  conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI | null
) => {
  // 微信小程序点击也会触发左滑事件，但此时 conversation 为 null
  if (conversation) {
    currentMoveSessionId.value = conversation.conversationId;
  } else {
    currentMoveSessionId.value = "";
  }
};

let flag = false;
// 点击会话
const handleSessionItemClick = async (
  conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI
) => {
  if (flag) return;
  currentMoveSessionId.value = "";
  try {
    flag = true;

    // 群聊会话：进入前检查群是否仍然有效（已解散等）
    if (
      conversation.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
    ) {
      try {
        const teamId =
          nim.V2NIMConversationIdUtil.parseConversationTargetId(
            conversation.conversationId
          );
        const team = await store.teamStore.getTeamForceActive(teamId);
        if (!team.isValidTeam) {
          showModal({
            title: t("tipText"),
            content: t("chatTeamInvalidText"),
            cancelText: "",
            onConfirm: () => {
              if (enableV2CloudConversation) {
                store.conversationStore?.deleteConversationActive(
                  conversation.conversationId
                );
              } else {
                store.localConversationStore?.deleteConversationActive(
                  conversation.conversationId
                );
              }
            },
          });
          return;
        }
      } catch {
        // getTeamForceActive 失败时允许继续进入（由 Chat 页面的兜底检查处理）
      }
    }

    // 处理@消息相关
    if (
      conversation.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ||
      conversation.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_SUPER_TEAM
    ) {
      if (store?.sdkOptions?.enableV2CloudConversation) {
        await store?.conversationStore?.markConversationReadActive(
          conversation.conversationId
        );
      } else {
        await store?.localConversationStore?.markConversationReadActive(
          conversation.conversationId
        );
      }
    }

    await store?.uiStore.selectConversation(conversation.conversationId);
    router.push(`${neUiKitRouterPath.chat}?conversationId=${conversation.conversationId}`);
  } catch {
    showToast({
      message: t("selectSessionFailText"),
      type: "info",
    });
  } finally {
    flag = false;
  }
};

// 删除会话
const handleSessionItemDeleteClick = async (
  conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI
) => {
  if (
    store?.connectStore.loginStatus !==
    V2NIMConst.V2NIMLoginStatus.V2NIM_LOGIN_STATUS_LOGINED
  ) {
    showToast({
      message: t("networkError"),
      type: "info",
    });
    return;
  }
  try {
    if (enableV2CloudConversation) {
      await store?.conversationStore?.deleteConversationActive(
        conversation.conversationId
      );
    } else {
      await store?.localConversationStore?.deleteConversationActive(
        conversation.conversationId
      );
    }
    currentMoveSessionId.value = "";
  } catch {
    showToast({
      message: t("deleteSessionFailText"),
      type: "info",
    });
  }
};

// 置顶会话
const handleSessionItemStickTopChange = async (
  conversation: V2NIMConversationForUI | V2NIMLocalConversationForUI
) => {
  if (conversation.stickTop) {
    try {
      if (enableV2CloudConversation) {
        await store?.conversationStore?.stickTopConversationActive(
          conversation.conversationId,
          false
        );
      } else {
        await store?.localConversationStore?.stickTopConversationActive(
          conversation.conversationId,
          false
        );
      }
    } catch {
      showToast({
        message: t("deleteStickTopFailText"),
        type: "info",
      });
    }
  } else {
    try {
      if (enableV2CloudConversation) {
        await store?.conversationStore?.stickTopConversationActive(
          conversation.conversationId,
          true
        );
      } else {
        await store?.localConversationStore?.stickTopConversationActive(
          conversation.conversationId,
          true
        );
      }
    } catch {
      showToast({
        message: t("addStickTopFailText"),
        type: "info",
      });
    }
  }
};

const showAddDropdown = () => {
  addDropdownVisible.value = true;
};

const hideAddDropdown = () => {
  addDropdownVisible.value = false;
};

const onDropdownClick = (urlType: "addFriend" | "createGroup") => {
  addDropdownVisible.value = false;
  setTimeout(() => {
    router.push({
      name: urlType === "addFriend" ? "AddFriend" : "TeamCreate",
    });
  }, 0);
};

/** 跳转至搜索页面 */
const goToSearchPage = () => {
  router.push(neUiKitRouterPath.conversationSearch);
};

/** 举报点击 */
const handleReportClick = () => {
  window.open("https://yunxin.163.com/survey/report", "_blank");
};

/** 监听会话列表 */
const conversationListWatch = autorun(() => {
  const _conversationList = enableV2CloudConversation
    ? store?.uiStore?.conversations
    : store?.uiStore?.localConversations;

  conversationList.value = _conversationList?.sort(
    (
      a: V2NIMConversationForUI | V2NIMLocalConversationForUI,
      b: V2NIMConversationForUI | V2NIMLocalConversationForUI
    ) => b.sortOrder - a.sortOrder
  ) as (V2NIMConversationForUI | V2NIMLocalConversationForUI)[];

  // todo
  // setTabUnread();
});

onUnmounted(() => {
  addDropdownVisible.value = false;
  conversationListWatch();
});
</script>

<style scoped>
.conversation-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fff;
}

.navigation-bar {
  flex: 0 0 60px;
  height: 60px;
  border-bottom: 1px solid #e9eff5;
  padding-left: 20px;
  padding-right: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  width: 100%;
  box-sizing: border-box;
  opacity: 1;
  z-index: 999;
}

.security-tip {
  padding: 6px 16px;
  background: #fff5e1;
  width: 100%;
  box-sizing: border-box;
  font-size: 13px;
  line-height: 150%;
  color: #eb9718;
}

.security-tip-icon {
  vertical-align: text-top;
  margin-right: 4px;
}

.security-tip-report {
  color: #3370ff;
  cursor: pointer;
}

.conversation-list-wrapper {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.logo-box {
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 500;
  color: #000;
}
.logo-img {
  width: 32px;
  height: 32px;
  margin-right: 10px;
}

.logo-title {
  font-size: 20px;
  font-weight: 500;
  color: #000;
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.button-icon-search {
  cursor: pointer;
  color: #333;
}

.button-box {
  position: relative;
}

.dropdown-container {
  position: absolute;
  top: 100%;
  right: 30px;
  min-width: 122px;
  min-height: 40px;
  background-color: #fff;
  border: 1px solid #e6e6e6;
  box-shadow: 0px 4px 7px rgba(133, 136, 140, 0.25);
  border-radius: 8px;
  color: #000;
  z-index: 99;
}

.add-menu-list {
  padding: 15px 10px;
}
.add-menu-item {
  white-space: nowrap;
  font-size: 16px;
  padding-left: 5px;
  margin-bottom: 10px;
  height: 30px;
  line-height: 30px;
  display: flex;
  align-items: center;
}
.add-menu-item:last-child {
  margin-bottom: 0;
}

.conversation-block {
  width: 100%;
  height: 72px;
}
</style>
