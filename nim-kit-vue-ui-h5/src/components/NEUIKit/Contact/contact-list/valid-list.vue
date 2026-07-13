<template>
  <div class="valid-list-container">
    <NavBar :title="t('validMsgText')">
      <template #right>
        <div class="valid-clear-btn" @click="handleClearClick">
          {{ t("clearText") }}
        </div>
      </template>
    </NavBar>

    <!-- Tab 切换 -->
    <div class="valid-tabs">
      <div
        :class="['valid-tab', { 'valid-tab-active': activeTab === 'friend' }]"
        @click="activeTab = 'friend'"
      >
        {{ t("friendTabText") }}
      </div>
      <div
        :class="['valid-tab', { 'valid-tab-active': activeTab === 'team' }]"
        @click="activeTab = 'team'"
      >
        {{ t("teamTabText") }}
      </div>
    </div>

    <div class="valid-list-content">
      <Empty
        v-if="currentList.length === 0"
        :text="t('validEmptyText')"
      />

      <!-- 好友申请列表 -->
      <template v-else-if="activeTab === 'friend'">
        <div
          class="valid-item"
          v-for="msg in friendMsgList"
          :key="msg.timestamp"
        >
          <!-- 已同意 -->
          <template
            v-if="
              msg.status ===
              V2NIMConst.V2NIMFriendAddApplicationStatus
                .V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.applicantAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.applicantAccountId" />
                </div>
                <div class="valid-action">{{ t("applyFriendText") }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-yidu" />
              <span class="valid-state-text">{{
                t("acceptResultText")
              }}</span>
            </div>
          </template>
          <!-- 已拒绝 -->
          <template
            v-else-if="
              msg.status ===
              V2NIMConst.V2NIMFriendAddApplicationStatus
                .V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED
            "
          >
            <template v-if="isMeApplicant(msg)">
              <div class="valid-item-left">
                <Avatar :account="msg.recipientAccountId" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="msg.recipientAccountId" />
                  </div>
                  <div class="valid-action">{{
                    t("beRejectResultText")
                  }}</div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="valid-item-left">
                <Avatar :account="msg.applicantAccountId" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="msg.applicantAccountId" />
                  </div>
                  <div class="valid-action">{{ t("applyFriendText") }}</div>
                </div>
              </div>
              <div class="valid-state">
                <Icon type="icon-shandiao" />
                <span class="valid-state-text">{{
                  t("rejectResultText")
                }}</span>
              </div>
            </template>
          </template>
          <!-- 已过期 -->
          <template
            v-else-if="
              msg.status ===
              V2NIMConst.V2NIMFriendAddApplicationStatus
                .V2NIM_FRIEND_ADD_APPLICATION_STATUS_EXPIRED
            "
          >
            <template v-if="isMeApplicant(msg)">
              <div class="valid-item-left">
                <Avatar :account="msg.recipientAccountId" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="msg.recipientAccountId" />
                  </div>
                  <div class="valid-action">{{
                    t("applyFriendText")
                  }}</div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="valid-item-left">
                <Avatar :account="msg.applicantAccountId" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="msg.applicantAccountId" />
                  </div>
                  <div class="valid-action">{{ t("applyFriendText") }}</div>
                </div>
              </div>
              <div class="valid-state">
                <Icon type="icon-shandiao" />
                <span class="valid-state-text">{{
                  t("expiredText")
                }}</span>
              </div>
            </template>
          </template>
          <!-- 未处理 -->
          <template
            v-else-if="
              msg.status ===
              V2NIMConst.V2NIMFriendAddApplicationStatus
                .V2NIM_FRIEND_ADD_APPLICATION_STATUS_INIT
            "
          >
            <template v-if="!isMeApplicant(msg)">
              <div class="valid-item-left">
                <Avatar :account="msg.applicantAccountId" />
                <div class="valid-name-container">
                  <div class="valid-name">
                    <Appellation :account="msg.applicantAccountId" />
                  </div>
                  <div class="valid-action">{{ t("applyFriendText") }}</div>
                </div>
              </div>
              <div class="valid-buttons">
                <div
                  class="valid-button button-reject"
                  @click="handleRejectApplyFriendClick(msg)"
                >
                  {{ t("rejectText") }}
                </div>
                <div
                  class="valid-button button-accept"
                  @click="handleAcceptApplyFriendClick(msg)"
                >
                  {{ t("acceptText") }}
                </div>
              </div>
            </template>
          </template>
        </div>
      </template>

      <!-- 群组申请/邀请列表 -->
      <template v-else>
        <div
          class="valid-item"
          v-for="msg in teamMsgList"
          :key="msg.timestamp"
        >
          <!-- 申请入群 - 未处理 -->
          <template
            v-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_INIT
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("applyTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-buttons">
              <div
                class="valid-button button-reject"
                @click="handleRejectTeamApply(msg)"
              >
                {{ t("rejectText") }}
              </div>
              <div
                class="valid-button button-accept"
                @click="handleAcceptTeamApply(msg)"
              >
                {{ t("acceptText") }}
              </div>
            </div>
          </template>
          <!-- 申请入群 - 已同意 -->
          <template
            v-else-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("applyTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-yidu" />
              <span class="valid-state-text">{{
                t("acceptResultText")
              }}</span>
            </div>
          </template>
          <!-- 申请入群 - 已拒绝 -->
          <template
            v-else-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("applyTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-shandiao" />
              <span class="valid-state-text">{{
                t("rejectResultText")
              }}</span>
            </div>
          </template>
          <!-- 申请入群 - 已过期 -->
          <template
            v-else-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_APPLICATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("applyTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-shandiao" />
              <span class="valid-state-text">{{
                t("expiredText")
              }}</span>
            </div>
          </template>
          <!-- 邀请入群 - 未处理 -->
          <template
            v-else-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_INVITATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_INIT
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("inviteTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-buttons">
              <div
                class="valid-button button-reject"
                @click="handleRejectTeamInvite(msg)"
              >
                {{ t("rejectText") }}
              </div>
              <div
                class="valid-button button-accept"
                @click="handleAcceptTeamInvite(msg)"
              >
                {{ t("acceptText") }}
              </div>
            </div>
          </template>
          <!-- 邀请入群 - 已同意 -->
          <template
            v-else-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_INVITATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("inviteTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-yidu" />
              <span class="valid-state-text">{{
                t("acceptResultText")
              }}</span>
            </div>
          </template>
          <!-- 邀请入群 - 已拒绝 -->
          <template
            v-else-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_INVITATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{
                  t("rejectTeamInviteText")
                }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-shandiao" />
              <span class="valid-state-text">{{
                t("rejectResultText")
              }}</span>
            </div>
          </template>
          <!-- 邀请入群 - 已过期 -->
          <template
            v-else-if="
              msg.actionType ===
                V2NIMConst.V2NIMTeamJoinActionType
                  .V2NIM_TEAM_JOIN_ACTION_TYPE_INVITATION &&
              msg.actionStatus ===
                V2NIMConst.V2NIMTeamJoinActionStatus
                  .V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED
            "
          >
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("inviteTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-shandiao" />
              <span class="valid-state-text">{{
                t("expiredText")
              }}</span>
            </div>
          </template>
          <!-- 其他已处理状态 -->
          <template v-else>
            <div class="valid-item-left">
              <Avatar :account="msg.operatorAccountId" />
              <div class="valid-name-container">
                <div class="valid-name">
                  <Appellation :account="msg.operatorAccountId" />
                </div>
                <div class="valid-action">{{ t("inviteTeamText") }} {{ teamNameMap[msg.teamId] || msg.teamId }}</div>
              </div>
            </div>
            <div class="valid-state">
              <Icon type="icon-yidu" />
              <span class="valid-state-text">{{
                t("acceptResultText")
              }}</span>
            </div>
          </template>
        </div>
      </template>
    </div>
    <Modal
      :title="clearConfirmTitle"
      :visible="showClearModal"
      :confirm-text="t('acceptText')"
      :cancel-text="t('cancelText')"
      @confirm="handleConfirmClear"
      @cancel="showClearModal = false"
    >
      {{ clearConfirmContent }}
    </Modal>
  </div>
</template>

<script lang="ts" setup>
/** 验证消息页面 */
import { autorun } from "mobx";
import { onUnmounted, getCurrentInstance, ref, computed } from "vue";
import Empty from "../../CommonComponents/Empty.vue";
import Avatar from "../../CommonComponents/Avatar.vue";
import NavBar from "../../CommonComponents/NavBar.vue";
import Modal from "../../CommonComponents/Modal.vue";
import Icon from "../../CommonComponents/Icon.vue";
import { t } from "../../utils/i18n";
import type { V2NIMFriendAddApplicationForUI, V2NIMTeamJoinActionInfoForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import Appellation from "../../CommonComponents/Appellation.vue";
import type { V2NIMMessage } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService";
import RootStore from "@xkit-yx/im-store-v2";
import { toast } from "../../utils/toast";

const friendMsgList = ref<V2NIMFriendAddApplicationForUI[]>([]);
const teamMsgList = ref<V2NIMTeamJoinActionInfoForUI[]>([]);
const activeTab = ref<"friend" | "team">("friend");

const { proxy } = getCurrentInstance()!;
const store = proxy?.$UIKitStore as RootStore;
const nim = proxy?.$NIM;

const currentList = computed(() =>
  activeTab.value === "friend" ? friendMsgList.value : teamMsgList.value
);

const clearConfirmTitle = computed(() =>
  activeTab.value === "friend"
    ? t("clearFriendConfirmTitle")
    : t("clearTeamConfirmTitle")
);

const clearConfirmContent = computed(() =>
  activeTab.value === "friend"
    ? t("clearFriendConfirmContent")
    : t("clearTeamConfirmContent")
);

const showClearModal = ref(false);

/** 清空当前 tab 数据 */
const handleClearClick = () => {
  showClearModal.value = true;
};

/** 确认清空 */
const handleConfirmClear = () => {
  showClearModal.value = false;
  if (activeTab.value === "friend") {
    store.sysMsgStore.deleteFriendApplyMsg(friendMsgList.value);
    nim.V2NIMFriendService.clearAllAddApplication().catch(() => {});
  } else {
    store.sysMsgStore.deleteTeamJoinActionMsg(teamMsgList.value);
    nim.V2NIMTeamService.clearAllTeamJoinActionInfo().catch(() => {});
  }
};

/** 是否是我发起的申请 */
const isMeApplicant = (data: V2NIMFriendAddApplicationForUI) => {
  return data.applicantAccountId === store.userStore.myUserInfo.accountId;
};

/** 拒绝好友申请 */
const handleRejectApplyFriendClick = async (
  msg: V2NIMFriendAddApplicationForUI
) => {
  try {
    await store.friendStore.rejectAddApplicationActive(msg);
    toast.info(t("rejectedText"));
  } catch (error) {
    toast.info(t("rejectFailedText"));
  }
};

/** 接受好友申请 */
const handleAcceptApplyFriendClick = async (
  msg: V2NIMFriendAddApplicationForUI
) => {
  try {
    try {
      await store.friendStore.acceptAddApplicationActive(msg);
      toast.info(t("acceptedText"));
    } catch (error) {
      toast.info(t("acceptFailedText"));
      return;
    }

    const textMsg = nim.V2NIMMessageCreator.createTextMessage(
      t("passFriendAskText")
    ) as unknown as V2NIMMessage;

    await store.msgStore.sendMessageActive({
      msg: textMsg,
      conversationId: nim.V2NIMConversationIdUtil.p2pConversationId(
        msg.operatorAccountId
      ),
    });
  } catch (error) {
    console.log("error", error);
  }
};

/** 接受群组邀请 */
const handleAcceptTeamInvite = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.acceptTeamInviteActive(msg);
    toast.info(t("acceptedText"));
  } catch (error) {
    toast.info(t("acceptFailedText"));
  }
};

/** 拒绝群组邀请 */
const handleRejectTeamInvite = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.rejectTeamInviteActive(msg);
    toast.info(t("rejectedText"));
  } catch (error) {
    toast.info(t("rejectFailedText"));
  }
};

/** 同意入群申请 */
const handleAcceptTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.acceptJoinApplicationActive(msg);
    toast.info(t("acceptedText"));
  } catch (error) {
    toast.info(t("acceptFailedText"));
  }
};

/** 拒绝入群申请 */
const handleRejectTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.rejectTeamApplyActive(msg);
    toast.info(t("rejectedText"));
  } catch (error) {
    toast.info(t("rejectFailedText"));
  }
};

/** 监听好友申请 */
const friendMsgWatch = autorun(() => {
  friendMsgList.value = store?.sysMsgStore.friendApplyMsgs || [];
  store?.sysMsgStore.friendApplyMsgs?.map((item) => {
    store?.userStore.getUserActive(item.applicantAccountId);
  });
});

/** 群组名称缓存 */
const teamNameMap = ref<Record<string, string>>({});

/** 监听群组申请 */
const teamMsgWatch = autorun(() => {
  teamMsgList.value = store?.sysMsgStore.teamJoinActionMsgs || [];
  store?.sysMsgStore.teamJoinActionMsgs?.map((item) => {
    store?.userStore.getUserActive(item.operatorAccountId);
    // 获取群名称，优先从已加入群列表查找，否则通过 SDK 查询
    if (!teamNameMap.value[item.teamId]) {
      const joinedTeam = (store?.uiStore.teamList || []).find((t: any) => t.teamId === item.teamId)
      if (joinedTeam?.name) {
        teamNameMap.value = { ...teamNameMap.value, [item.teamId]: joinedTeam.name }
      } else {
        store?.teamStore.getTeamActive(item.teamId, item.teamType).then((team: any) => {
          if (team?.name) {
            teamNameMap.value = { ...teamNameMap.value, [item.teamId]: team.name }
          }
        })
      }
    }
  });
});

onUnmounted(() => {
  friendMsgWatch();
  teamMsgWatch();
});
</script>

<style scoped>
.valid-list-container {
  height: 100vh;
  box-sizing: border-box;
  background-color: #fff;
  overflow-y: auto;
}

.valid-tabs {
  display: flex;
  background-color: #fff;
}

.valid-tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 15px;
  color: #666;
  cursor: pointer;
  position: relative;
}

.valid-tab-active {
  color: #337eef;
  font-weight: 500;
}

.valid-tab-active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: #337eef;
  border-radius: 2px;
}

.valid-clear-btn {
  font-size: 14px;
  cursor: pointer;
}

.valid-list-content {
  height: calc(
    100% - 60px - var(--status-bar-height) - 48px
  );
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.valid-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  padding: 0 20px;
}

.valid-name-container {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  flex: 1;
  padding-right: 20px;
}

.valid-name {
  font-size: 16px;
  color: #000;
  max-width: 35vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.valid-action {
  color: #888;
  font-size: 14px;
  max-width: 40vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.valid-item-left {
  display: flex;
  align-items: center;
}

.valid-buttons {
  display: flex;
  align-items: center;
}

.valid-button {
  margin: 0;
  width: 60px;
  height: 32px;
  line-height: 32px;
  font-size: 14px;
  text-align: center;
  border-radius: 3px;
  background-color: #fff;
}

.button-reject {
  color: #000;
  border: 1px solid #d9d9d9;
  margin-right: 10px;
}

.button-accept {
  color: #337eef;
  border: 1px solid #337eef;
}

.valid-state {
  display: flex;
  align-items: center;
}

.valid-state-text {
  margin-left: 10px;
  color: #000;
}
</style>
