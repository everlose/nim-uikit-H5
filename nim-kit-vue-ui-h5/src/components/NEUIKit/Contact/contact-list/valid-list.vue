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
import { onUnmounted, getCurrentInstance, ref, computed, onMounted } from "vue";
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
    updateFriendApplyStatus(
      msg,
      V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED
    );
    markFriendApplyReadOnServer(msg);
    toast.info(t("rejectedText"));
  } catch (error) {
    // 服务端拒绝了这次操作（申请已被处理或已失效）：置为已过期
    if (isJoinActionExpiredError(error)) {
      markFriendApplyExpired(msg);
      return;
    }
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
      updateFriendApplyStatus(
        msg,
        V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED
      );
      markFriendApplyReadOnServer(msg);
      toast.info(t("acceptedText"));
    } catch (error) {
      // 服务端拒绝了这次操作（申请已被处理或已失效）：置为已过期
      if (isJoinActionExpiredError(error)) {
        markFriendApplyExpired(msg);
        return;
      }
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

/** 本地更新验证消息的处理状态
 *  同意/拒绝后服务端不会把状态变更推给操作端（同意只推 onTeamJoined，拒绝只推给群主/管理员端），
 *  不做本地更新的话按钮不会消失 */
const updateTeamJoinActionStatus = (
  msg: V2NIMTeamJoinActionInfoForUI,
  actionStatus: V2NIMTeamJoinActionInfoForUI["actionStatus"]
) => {
  // 对齐 store 处理好友申请的方式（_onFriendAdded 写的是 status + isRead + read 三件套）：
  // 用户已经处理过这条记录了，一起把未读清掉，否则返回联系人页红点还在
  store?.sysMsgStore.updateTeamJoinActionMsg([
    { ...msg, actionStatus, isRead: true, read: true },
  ]);
};

/** 服务端已读：UIKit 的 isRead 只存在本端内存里，不写服务端的话，
 *  重登或其它端拉回来的记录仍旧是未读，红点会复活 */
const markTeamJoinActionReadOnServer = (msg: V2NIMTeamJoinActionInfoForUI) => {
  nim?.V2NIMTeamService.setTeamJoinActionInfoRead(msg).catch(() => {});
};

/** 10w~19w 是服务端返回的业务错误码区间（19w 起是客户端本地错误码，例如超时 191005），
 *  命中说明这次同意/拒绝没有被服务端接受：通常是这条记录已经被处理或已失效
 *  （典型是 109313 邀请/申请不存在，例如被同账号的其它端同意/拒绝过），本地按已过期处理 */
const isJoinActionExpiredError = (error: unknown) => {
  const code = (error as { code?: number })?.code;
  return typeof code === "number" && code > 100000 && code < 190000;
};

/** 主动把这条验证消息置为已过期，避免失效的按钮留在界面上 */
const markJoinActionExpired = (msg: V2NIMTeamJoinActionInfoForUI) => {
  updateTeamJoinActionStatus(
    msg,
    V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_EXPIRED
  );
  toast.info(t("expiredText"));
};

/** 好友侧与群侧的跨端差异（群侧为什么只能靠错误码兜底，注释留存，勿删）：
 *  1. 好友申请/添加有服务端按账号下发的通知协议：同账号任意一端处理完，服务端会把
 *     onFriendAdded / onFriendAddRejected 推给该账号的其它端（SDK 侧由 processSysNotification
 *     解析后 append 到申请列表并 emit），store 的 _onFriendAdded / _onFriendAddRejected 据此把
 *     记录写成 status + isRead + read，所以好友侧各端天然联动，不需要本端兜底；
 *  2. 群侧没有等价通知：同意只回 onTeamJoined（成员变更，store 只做 addTeam，不动验证消息记录），
 *     拒绝只推给群主/管理员，自己拒绝不会发通知给自己其它端；且不开启
 *     enableServerV2TeamJoinActionInfo 时 getTeamJoinActionInfoList 只读本端 SDK 内存里的
 *     本地模型（无网络请求），所以"主动拉一次"也拿不到另一端的结果 → 只能在本端操作失败、
 *     拿到 10w~19w 业务错误码（如 109313 邀请/申请不存在）时把本地状态兜底置为已过期。 */

/** 好友申请：本地更新处理状态 + 清未读（和 store 里 _onFriendAdded 的写法一致） */
const updateFriendApplyStatus = (
  msg: V2NIMFriendAddApplicationForUI,
  status: V2NIMFriendAddApplicationForUI["status"]
) => {
  store?.sysMsgStore.updateFriendApplyMsg([
    { ...msg, status, isRead: true, read: true },
  ]);
};

/** 好友申请的服务端已读 */
const markFriendApplyReadOnServer = (msg: V2NIMFriendAddApplicationForUI) => {
  nim?.V2NIMFriendService.setAddApplicationReadEx(msg).catch(() => {});
};

/** 主动把这条好友申请置为已过期（申请已被处理或已失效） */
const markFriendApplyExpired = (msg: V2NIMFriendAddApplicationForUI) => {
  updateFriendApplyStatus(
    msg,
    V2NIMConst.V2NIMFriendAddApplicationStatus.V2NIM_FRIEND_ADD_APPLICATION_STATUS_EXPIRED
  );
  toast.info(t("expiredText"));
};

/** 主动拉取一次最新的申请/邀请状态，用于多端同步：同账号其它端操作后本端收不到推送。
 *  注意拉回来的记录不带本地 isRead（addTeamJoinActionMsg 是整体覆盖，且群这边没有好友那种
 *  timestamp 守护），而人已经在验证消息页就等于已读，所以拉完重新标记一次本地已读，
 *  避免红点被拉取重新点亮 */
const refreshValidMsgs = async () => {
  try {
    const res = await store?.teamStore.getTeamJoinActionInfoListActive({
      offset: 0,
      limit: 100,
    });
    // store 写入是无条件 map.set，key = teamId_operatorAccountId。
    // 同一个邀请人重复邀请时会返回多条同 key 记录（旧的已失效 + 新的待处理），
    // 数组顺序会让旧记录盖掉新记录（好友那边 addFriendApplyMsg 有 timestamp 守护，群这边没有），
    // 所以这里按 key 取时间戳最新的一条写回
    const newest = new Map<string, V2NIMTeamJoinActionInfoForUI>();
    const infos = res?.infos || [];
    infos.forEach((info) => {
      const key = store?.sysMsgStore.createTeamJoinActionMsgKey(info) || "";
      const existed = newest.get(key);
      if (!existed || info.timestamp >= existed.timestamp) {
        newest.set(key, info);
      }
    });
    store?.sysMsgStore.addTeamJoinActionMsg([...newest.values()]);
  } catch (error) {
    // 拉取失败不阻塞页面
  }

  await store?.friendStore
    .getAddApplicationListActive({ status: [], offset: 0, limit: 100 })
    .catch(() => {});

  // 本地已读 + 服务端已读一起补，重登/其它端才不会又变回未读
  store?.sysMsgStore.setAllApplyMsgRead();
  nim?.V2NIMTeamService.setTeamJoinActionInfoRead().catch(() => {});
  nim?.V2NIMFriendService.setAddApplicationRead().catch(() => {});
};

/** 页面从后台/其它端切回来重新可见时再同步一次 */
const handleVisible = () => {
  if (document.visibilityState === "visible") {
    refreshValidMsgs();
  }
};

onMounted(() => {
  refreshValidMsgs();
  document.addEventListener("visibilitychange", handleVisible);
});

/** 接受群组邀请 */
const handleAcceptTeamInvite = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.acceptTeamInviteActive(msg);
    updateTeamJoinActionStatus(
      msg,
      V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED
    );
    markTeamJoinActionReadOnServer(msg);
    toast.info(t("acceptedText"));
  } catch (error) {
    // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
    if (isJoinActionExpiredError(error)) {
      markJoinActionExpired(msg);
      return;
    }
    toast.info(t("acceptFailedText"));
  }
};

/** 拒绝群组邀请 */
const handleRejectTeamInvite = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.rejectTeamInviteActive(msg);
    updateTeamJoinActionStatus(
      msg,
      V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED
    );
    markTeamJoinActionReadOnServer(msg);
    toast.info(t("rejectedText"));
  } catch (error) {
    // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
    if (isJoinActionExpiredError(error)) {
      markJoinActionExpired(msg);
      return;
    }
    toast.info(t("rejectFailedText"));
  }
};

/** 同意入群申请 */
const handleAcceptTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.acceptJoinApplicationActive(msg);
    updateTeamJoinActionStatus(
      msg,
      V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_AGREED
    );
    markTeamJoinActionReadOnServer(msg);
    toast.info(t("acceptedText"));
  } catch (error) {
    // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
    if (isJoinActionExpiredError(error)) {
      markJoinActionExpired(msg);
      return;
    }
    toast.info(t("acceptFailedText"));
  }
};

/** 拒绝入群申请 */
const handleRejectTeamApply = async (msg: V2NIMTeamJoinActionInfoForUI) => {
  try {
    await store.teamStore.rejectTeamApplyActive(msg);
    updateTeamJoinActionStatus(
      msg,
      V2NIMConst.V2NIMTeamJoinActionStatus.V2NIM_TEAM_JOIN_ACTION_STATUS_REJECTED
    );
    markTeamJoinActionReadOnServer(msg);
    toast.info(t("rejectedText"));
  } catch (error) {
    // 服务端拒绝了这次操作（记录已被处理或已失效）：置为已过期
    if (isJoinActionExpiredError(error)) {
      markJoinActionExpired(msg);
      return;
    }
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
  document.removeEventListener("visibilitychange", handleVisible);
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
