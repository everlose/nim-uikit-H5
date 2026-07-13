<template>
  <div class="input-root">
    <!-- 当回复消息时，输入框上需要展示被回复的消息-->
    <div v-if="isReplyMsg" class="reply-message-wrapper">
      <div class="reply-message-close" @click="removeReplyMsg">
        <Icon
          color="#929299"
          :iconStyle="{ fontWeight: '200' }"
          :size="13"
          type="icon-guanbi"
        />
      </div>
      <div class="reply-line">｜</div>
      <div class="reply-title">{{ t("replyText") }}</div>
      <div v-if="replyMsg" class="reply-to">
        <Appellation
          :account="replyMsg.senderId"
          :team-id="
            props.conversationType ===
            V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
              ? to
              : ''
          "
          color="#929299"
          :fontSize="13"
        >
        </Appellation>
      </div>
      <div class="reply-to-colon">:</div>
      <div
        v-if="replyMsg && replyMsg.messageClientId === 'noFind'"
        class="reply-noFind"
      >
        {{ t("replyNotFindText") }}
      </div>
      <div class="reply-message" v-else>
        <message-one-line
          v-if="
            replyMsg &&
            replyMsg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
          "
          :text="replyMsg.text"
        />
        <div v-else>
          {{
            replyMsg?.messageType
              ? `[${
                  REPLY_MSG_TYPE_MAP[replyMsg.messageType] || "Unsupported Type"
                }]`
              : "[Unknown]"
          }}
        </div>
      </div>
    </div>
    <div class="msg-input-wrapper">
      <div class="input-inner">
        <!-- 当从表情面板切换到文字输入时，直接唤起键盘，会导致input框滚动消失，故此处需要一个fake Input兼容下，保证先隐藏表情/其他面板，再弹出键盘 -->
        <div v-show="showFakeInput" @click="onHideFakeInput" class="fake-input">
          <div v-if="inputText" class="input-text">{{ inputText }}</div>
          <div v-else class="input-placeholder">
            {{
              isTeamMute ? t("teamMutePlaceholder") : t("chatInputPlaceHolder")
            }}
          </div>
        </div>
        <Input
          v-show="!showFakeInput"
          ref="msgInputRef"
          id="msg-input"
          class="msg-input-input"
          :placeholder="
            isTeamMute ? t('teamMutePlaceholder') : t('chatInputPlaceHolder')
          "
          v-model="inputText"
          :disabled="isTeamMute"
          :confirm-hold="true"
          cursor-spacing="20"
          adjust-position="true"
          confirm-type="send"
          :inputStyle="{
            padding: '0 10px',
          }"
          @confirm="handleSendTextMsg"
          @blur="handleInputBlur"
          @focus="handleInputFocus"
          @input="handleInputChange"
        >
        </Input>
      </div>

      <!-- 操作栏：四列布局，与 Android 对齐 -->
      <div class="input-action-bar">
        <div class="input-action-icon" @click="handleEmojiVisible">
          <Icon :size="24" :type="emojiVisible ? 'icon-emoji-active' : 'icon-emoji-normal'" />
        </div>
        <div class="input-action-icon">
          <input
            type="file"
            ref="imageInput"
            accept="image/*,video/*"
            class="file-input-overlay"
            :style="{ pointerEvents: isTeamMute ? 'none' : 'auto' }"
            @change="onImageSelected"
          />
          <Icon :size="24" type="icon-tupian" />
        </div>
        <div class="input-action-icon input-action-empty" />
        <div
          class="input-action-icon input-send-more"
          :class="{ active: sendMoreVisible }"
          @click="handleSendMoreVisible"
        >
          <Icon :type="sendMoreVisible ? 'icon-more-active' : 'icon-more-normal'" :size="24" />
        </div>
      </div>

      <!-- 更多操作扩展区 -->
      <div v-if="sendMoreVisible" class="send-more-expand" @click.stop>
        <div class="send-more-expand-item" @click="handleCameraClick">
          <div class="send-more-expand-icon">
            <Icon :size="26" type="icon-paishe" />
          </div>
          <div class="send-more-expand-label">拍摄</div>
        </div>
        <div class="send-more-expand-item">
          <input
            type="file"
            ref="fileInput"
            accept="*/*"
            class="file-input-overlay"
            :style="{ pointerEvents: isTeamMute ? 'none' : 'auto' }"
            @change="onFileSelected"
          />
          <div class="send-more-expand-icon">
            <Icon :size="26" type="icon-wenjian" />
          </div>
          <div class="send-more-expand-label">{{ t("fileText") }}</div>
        </div>
        <!-- 隐藏的拍照和摄像 input（由 ActionSheet 触发） -->
        <input type="file" ref="cameraPhotoInput" accept="image/*" capture="environment" style="display:none" @change="onCameraPhotoSelected" />
        <input type="file" ref="cameraVideoInput" accept="video/*" capture="environment" style="display:none" @change="onCameraVideoSelected" />
      </div>
    </div>
    <!-- 表情面板 -->
    <div v-if="emojiVisible" class="msg-emoji-panel" @click.stop="() => {}">
      <Face
        @emojiClick="handleEmoji"
        @emojiDelete="handleEmojiDelete"
        @emojiSend="handleSendTextMsg"
      />
    </div>
  </div>
  <BottomPopup
    v-model="mentionPopupVisible"
    @cancel="mentionPopupVisible = false"
    :showConfirm="false"
    :showCancel="true"
    :title="t('chooseMentionText')"
  >
    <MentionChooseList
      :teamId="props.to"
      @handleMemberClick="handleMentionSelect"
      @item-click="handleMentionSelect"
    ></MentionChooseList>
  </BottomPopup>
  <!-- 拍摄 ActionSheet：选择拍照还是摄像 -->
  <ActionSheet
    v-model="cameraSheetVisible"
    :actions="cameraActions"
    @close="cameraSheetVisible = false"
  />
</template>

<script lang="ts" setup>
import Face from "./face.vue";
import Icon from "../../CommonComponents/Icon.vue";
import {
  ref,
  getCurrentInstance,
  computed,
  onUnmounted,
  onMounted,
  nextTick,
} from "vue";
import {
  ALLOW_AT,
  events,
  REPLY_MSG_TYPE_MAP,
  AT_ALL_ACCOUNT,
} from "../../utils/constants";
import { emojiMap } from "../../utils/emoji";
import { t } from "../../utils/i18n";
import MessageOneLine from "../../CommonComponents/MessageOneLine.vue";
import Appellation from "../../CommonComponents/Appellation.vue";
import { replaceEmoji } from "../../utils";
import { autorun } from "mobx";
import emitter from "../../utils/eventBus";
import Input from "../../CommonComponents/Input.vue";
import type {
  V2NIMTeam,
  V2NIMTeamChatBannedMode,
  V2NIMTeamMember,
} from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMTeamService";
import type {
  V2NIMMessageForUI,
  YxServerExt,
  YxAitMsg,
} from "@xkit-yx/im-store-v2/dist/types/src/types";
import type { V2NIMMessage } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService";
import { toast } from "../../utils/toast";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import BottomPopup from "../../CommonComponents/BottomPopup.vue";
import ActionSheet from "../../CommonComponents/ActionSheet.vue";
import MentionChooseList from "./mention-choose-list.vue";

const { proxy } = getCurrentInstance()!; // 获取组件实例
const store = proxy?.$UIKitStore;

const props = withDefaults(
  defineProps<{
    conversationType: V2NIMConst.V2NIMConversationType;
    to: string;
    replyMsgsMap?: {
      [key: string]: V2NIMMessageForUI;
    };
  }>(),
  {}
);
const emit = defineEmits<{
  (e: "send-message"): void;
}>();

const conversationId =
  props.conversationType ===
  V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
    ? proxy?.$NIM.V2NIMConversationIdUtil.p2pConversationId(props.to)
    : proxy?.$NIM.V2NIMConversationIdUtil.teamConversationId(props.to);

const inputText = ref("");

// 发送更多面板flag
const sendMoreVisible = ref(false);
// 表情面板flag
const emojiVisible = ref(false);

// 用于解决表情面板和键盘冲突，导致输入框滚动消失问题
const showFakeInput = ref(false);

// 拍摄 ActionSheet 显示状态
const cameraSheetVisible = ref(false);

// 回复消息相关
const isReplyMsg = ref(false);
const isFocus = ref(false);
const replyMsg = ref<V2NIMMessageForUI>();

//输入框ref
const msgInputRef = ref();

// 群相关
const team = ref<V2NIMTeam>();
const teamMembers = ref<V2NIMTeamMember[]>([]);
const teamMute = ref<V2NIMTeamChatBannedMode>(
  V2NIMConst.V2NIMTeamChatBannedMode.V2NIM_TEAM_CHAT_BANNED_MODE_UNBAN
);

// 是否是群主
const isTeamOwner = ref(false);
// 是否是群管理员
const isTeamManager = ref(false);
// 群禁言状态
const isTeamMute = ref(false);

// @消息相关
const mentionPopupVisible = ref(false);
const cursorPosition = ref(0); // 记录光标位置
const atPosition = ref(0); // 记录@符号的位置
const selectedAtMembers = ref<{ accountId: string; appellation: string }[]>([]); // 选中@成员
const prevInputText = ref("");

// 更新群禁言
const updateTeamMute = () => {
  if (
    teamMute.value ===
    V2NIMConst.V2NIMTeamChatBannedMode.V2NIM_TEAM_CHAT_BANNED_MODE_UNBAN
  ) {
    isTeamMute.value = false;
    return;
  }
  // 群主或者群管理员在群禁言时，可以发送消息
  if (isTeamOwner.value || isTeamManager.value) {
    isTeamMute.value = false;
    return;
  }
  isTeamMute.value = true;
  return;
};

// 点击表情输入框，隐藏表情面板，显示键盘，但在safari浏览器因苹果的安全策略，无法主动唤起键盘，需要用户手动点击
const onHideFakeInput = () => {
  showFakeInput.value = false;
  // 先将表情面板和发送更多面板隐藏
  emojiVisible.value = false;
  sendMoreVisible.value = false;

  // 延迟一小段时间后再隐藏假输入框并聚焦真输入框
  const timer = setTimeout(() => {
    // 确保DOM已更新后再聚焦
    nextTick(() => {
      try {
        const input = document.getElementById("msg-input");
        input?.focus();
      } catch (error) {
        console.log("error", error);
      }
      clearTimeout(timer);
    });
  }, 100);
};

/** 是否允许@ 所有人 */
const allowAtAll = computed(() => {
  let ext: YxServerExt = {};
  try {
    ext = JSON.parse((team.value || {}).serverExtension || "{}");
  } catch (error) {
    //
  }
  if (ext[ALLOW_AT] === "manager") {
    return isTeamOwner.value || isTeamManager.value;
  }
  return true;
});

/** 处理选中的@ 成员 */
const onAtMembersExtHandler = () => {
  let ext: YxServerExt;
  if (selectedAtMembers.value.length) {
    selectedAtMembers.value
      .filter((member) => {
        if (!allowAtAll.value && member.accountId === AT_ALL_ACCOUNT) {
          return false;
        }
        return true;
      })
      .forEach((member) => {
        const substr = `@${member.appellation}`;
        const positions: number[] = [];
        let pos = inputText.value?.indexOf(substr);
        while (pos !== -1) {
          positions.push(pos);
          pos = inputText.value?.indexOf(substr, pos + 1);
        }
        if (positions.length) {
          if (!ext) {
            ext = {
              yxAitMsg: {
                [member.accountId]: {
                  text: substr,
                  segments: [],
                },
              },
            };
          } else {
            (ext.yxAitMsg as YxAitMsg)[member.accountId] = {
              text: substr,
              segments: [],
            };
          }
          positions.forEach((position) => {
            const start = position;
            (ext?.yxAitMsg as YxAitMsg)[member.accountId].segments.push({
              start,
              end: start + substr.length,
              broken: false,
            });
          });
        }
      });
  }
  // @ts-ignore
  return ext;
};
const findNewAtPosition = (newText: string, prevText: string): number => {
  const prevAtCount = (prevText.match(/@/g) || []).length;
  const newAtCount = (newText.match(/@/g) || []).length;

  if (newAtCount <= prevAtCount) {
    return -1;
  }

  for (let i = 0; i < newText.length; i++) {
    if (newText[i] !== "@") {
      continue;
    }

    const prefixAtCount = (newText.substring(0, i).match(/@/g) || []).length;
    const prevPrefixAtCount = (
      prevText.substring(0, Math.min(i, prevText.length)).match(/@/g) || []
    ).length;

    if (prefixAtCount > prevPrefixAtCount) {
      return i;
    }
  }

  return newText.lastIndexOf("@");
};

// TODO: 暂时注释掉@成员整体删除相关逻辑，改为逐字删除
// 原逻辑：删除@成员时整体删除"@王允"，因为做文本替换导致光标跳到末尾
//
// const findDeletePosition = (...) => { ... }
//
// const removeAtMemberResidue = (...) => { ... }
//
// const handleAtMemberDelete = (...) => { ... }

const getInputValueFromEvent = (event): string => {
  if (typeof event === "string") {
    return event;
  }
  return event?.target?.value ?? inputText.value;
};

// 处理输入框内容变化 @相关时使用
const handleInputChange = (event) => {
  const value = getInputValueFromEvent(event);
  const prevValue = prevInputText.value;

  // 获取当前光标位置
  if (msgInputRef.value && msgInputRef.value.inputRef) {
    cursorPosition.value = msgInputRef.value.inputRef.selectionStart || 0;
  }

  // TODO: 暂时注释掉@成员整体删除逻辑，改为逐字删除
  // 原逻辑：删除@成员时整体删除"@王允"，导致光标跳到末尾
  // 现在作为普通input，逐字删除即可
  // if (value.length < prevValue.length && selectedAtMembers.value.length > 0) {
  //   const { text, membersToKeep } = handleAtMemberDelete(value, prevValue);
  //   inputText.value = text;
  //   prevInputText.value = text;
  //   selectedAtMembers.value = membersToKeep;
  //   return;
  // }

  prevInputText.value = value;

  if (
    props.conversationType !==
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    mentionPopupVisible.value = false;
    return;
  }

  if (
    value.length > prevValue.length &&
    findNewAtPosition(value, prevValue) !== -1
  ) {
    atPosition.value = findNewAtPosition(value, prevValue);
    cursorPosition.value = atPosition.value + 1;
    mentionPopupVisible.value = true;
    msgInputRef.value.inputRef.blur();
  } else {
    mentionPopupVisible.value = false;
  }
};

// 滚动到底部
const scrollBottom = () => {
  emitter.emit(events.ON_SCROLL_BOTTOM);
};

// 发送文本消息
const handleSendTextMsg = () => {
  if (inputText.value.trim() === "") return;
  emit("send-message");
  let text = replaceEmoji(inputText.value);
  const textMsg = proxy?.$NIM.V2NIMMessageCreator.createTextMessage(text);
  const ext = onAtMembersExtHandler();

  store?.msgStore
    .sendMessageActive({
      msg: textMsg as unknown as V2NIMMessage,
      conversationId,
      serverExtension: selectedAtMembers.value.length && (ext as any),
      sendBefore: () => {
        scrollBottom();
      },
    })
    .catch(() => {
      toast.info(t("sendMsgFailedText"));
    })
    .finally(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          emitter.emit(events.ON_SCROLL_BOTTOM);
        });
      });
    });

  inputText.value = "";
  prevInputText.value = "";
  selectedAtMembers.value = [];
  isReplyMsg.value = false;
};

// 移除回复消息
const removeReplyMsg = () => {
  store?.msgStore.removeReplyMsgActive(
    replyMsg?.value?.conversationId as string
  );
  isReplyMsg.value = false;
};

// 显示表情面板
const handleEmojiVisible = () => {
  if (isTeamMute.value) return;
  emojiVisible.value = true;

  showFakeInput.value = true;
  sendMoreVisible.value = false;
  emitter.emit(events.ON_SCROLL_BOTTOM);
};

// 点击表情
const handleEmoji = (emoji: { key: string; type: string }) => {
  inputText.value += emoji.key;
};

// 删除表情
const handleEmojiDelete = () => {
  let target = "";
  const isEmojiEnd = Object.keys(emojiMap).reduce((prev, cur) => {
    const isEnd = inputText.value.endsWith(cur);
    if (isEnd) {
      target = cur;
    }
    return prev || isEnd;
  }, false);
  if (isEmojiEnd && target) {
    inputText.value = inputText.value.replace(target, "");
  } else {
    inputText.value = inputText.value.slice(0, -1);
  }
};

/** 显示发送更多"+"面板 */
const handleSendMoreVisible = () => {
  if (isTeamMute.value) return;
  emojiVisible.value = false;
  sendMoreVisible.value = !sendMoreVisible.value;
  showFakeInput.value = true;
  emitter.emit(events.ON_SCROLL_BOTTOM);
};

// 文件输入引用
const imageInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const cameraPhotoInput = ref<HTMLInputElement | null>(null);
const cameraVideoInput = ref<HTMLInputElement | null>(null);
const FILE_SIZE_LIMIT = 200 * 1024 * 1024;

// 拍摄：显示 ActionSheet 选择拍照还是摄像
const handleCameraClick = () => {
  if (isTeamMute.value) return;
  cameraSheetVisible.value = true;
};

const handleCameraAction = (type: "photo" | "video") => {
  cameraSheetVisible.value = false;
  if (type === "photo") {
    cameraPhotoInput.value?.click();
  } else {
    cameraVideoInput.value?.click();
  }
};

const cameraActions = computed(() => [
  { text: "拍照", onClick: () => handleCameraAction("photo") },
  { text: "摄像", onClick: () => handleCameraAction("video") },
]);

const isFileSizeValid = (file: File, input?: HTMLInputElement | null) => {
  if (file.size <= FILE_SIZE_LIMIT) return true;
  toast.info(t("fileSizeLimitText"));
  if (input) {
    input.value = "";
  }
  return false;
};

// 处理相册选择（图片和视频）
const onImageSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;
  if (!isFileSizeValid(file, imageInput.value)) return;
  emit("send-message");

  const isVideo = file.type.startsWith("video/");
  const fileMsg = isVideo
    ? proxy?.$NIM.V2NIMMessageCreator.createVideoMessage(file)
    : file.size > 20 * 1024 * 1024
      ? proxy?.$NIM.V2NIMMessageCreator.createFileMessage(file)
      : proxy?.$NIM.V2NIMMessageCreator.createImageMessage(file);

  try {
    await store?.msgStore.sendMessageActive({
      msg: fileMsg as unknown as V2NIMMessage,
      conversationId,
      progress: () => true,
      sendBefore: () => {
        scrollBottom();
      },
    });

    scrollBottom();
  } catch (err) {
    scrollBottom();
    toast.info(
      isVideo ? t("sendVideoFailedText") : t("sendImageFailedText")
    );
  } finally {
    // 清空 input 的值，这样用户可以重复选择同一个文件
    if (imageInput.value) {
      imageInput.value.value = "";
    }
  }
};

const onFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;
  if (!isFileSizeValid(file, fileInput.value)) return;
  emit("send-message");

  try {
    const fileMsg = proxy?.$NIM.V2NIMMessageCreator.createFileMessage(file);

    await store?.msgStore.sendMessageActive({
      msg: fileMsg as unknown as V2NIMMessage,
      conversationId,
      progress: () => true,
      sendBefore: () => {
        scrollBottom();
      },
    });

    scrollBottom();
  } catch (err) {
    scrollBottom();
    toast.info(t("sendFileFailedText"));
  } finally {
    // 清空 input 的值，这样用户可以重复选择同一个文件
    if (fileInput.value) {
      fileInput.value.value = "";
    }
  }
};

// 处理拍照选择
const onCameraPhotoSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!isFileSizeValid(file, cameraPhotoInput.value)) return;
  emit("send-message");

  const fileMsg = proxy?.$NIM.V2NIMMessageCreator.createImageMessage(file);
  try {
    await store?.msgStore.sendMessageActive({
      msg: fileMsg as unknown as V2NIMMessage,
      conversationId,
      progress: () => true,
      sendBefore: () => scrollBottom(),
    });
    scrollBottom();
  } catch (err) {
    scrollBottom();
    toast.info(t("sendImageFailedText"));
  } finally {
    if (cameraPhotoInput.value) cameraPhotoInput.value.value = "";
  }
};

// 处理摄像选择
const onCameraVideoSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!isFileSizeValid(file, cameraVideoInput.value)) return;
  emit("send-message");

  const fileMsg = proxy?.$NIM.V2NIMMessageCreator.createVideoMessage(file);
  try {
    await store?.msgStore.sendMessageActive({
      msg: fileMsg as unknown as V2NIMMessage,
      conversationId,
      progress: () => true,
      sendBefore: () => scrollBottom(),
    });
    scrollBottom();
  } catch (err) {
    scrollBottom();
    toast.info(t("sendVideoFailedText"));
  } finally {
    if (cameraVideoInput.value) cameraVideoInput.value.value = "";
  }
};

// 输入框聚焦
const handleInputFocus = () => {
  isFocus.value = true;
  // 记录当前光标位置
  if (msgInputRef.value && msgInputRef.value.inputRef) {
    cursorPosition.value = msgInputRef.value.inputRef.selectionStart || 0;
  }
};

// 输入框失焦
const handleInputBlur = () => {
  isFocus.value = false;
};

// 处理mention选择
const handleMentionSelect = (member) => {
  const nickInTeam = member.appellation;
  selectedAtMembers.value = [
    ...selectedAtMembers.value.filter(
      (item) => item.accountId !== member.accountId
    ),
    member,
  ];

  // 在@符号位置插入@xxx，而不是追加到末尾
  const currentText = inputText.value;
  const beforeAt = currentText.substring(0, atPosition.value);
  const afterAt = currentText.substring(atPosition.value + 1); // +1 跳过@符号
  const newInputText = beforeAt + "@" + nickInTeam + " " + afterAt;

  // 更新input框的内容
  inputText.value = newInputText;
  prevInputText.value = newInputText;

  handleCloseMention();

  // 设置光标位置到插入内容之后
  nextTick(() => {
    if (msgInputRef.value && msgInputRef.value.inputRef) {
      const newCursorPos = atPosition.value + nickInTeam.length + 2; // @xxx + 空格
      msgInputRef.value.inputRef.setSelectionRange(newCursorPos, newCursorPos);
    }
  });
};

// 关闭mention
const handleCloseMention = () => {
  mentionPopupVisible.value = false;
};

let uninstallTeamWatch = () => {};

onMounted(() => {
  uninstallTeamWatch = autorun(() => {
    if (
      props.conversationType ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
    ) {
      const _team = store?.teamStore.teams.get(props.to);

      teamMembers.value = store?.teamMemberStore.getTeamMember(
        props.to
      ) as V2NIMTeamMember[];

      const myUser = store?.userStore.myUserInfo;
      isTeamOwner.value = _team?.ownerAccountId == myUser?.accountId;
      isTeamManager.value = teamMembers.value
        .filter(
          (item) =>
            item.memberRole ===
            V2NIMConst.V2NIMTeamMemberRole.V2NIM_TEAM_MEMBER_ROLE_MANAGER
        )
        .some(
          (member) => member.accountId === (myUser ? myUser.accountId : "")
        );
      team.value = _team;
      if (_team) {
        teamMute.value = _team.chatBannedMode;
      }
      updateTeamMute();
    }
  });

  // 撤回后，重新编辑消息
  emitter.on(events.ON_REEDIT_MSG, (_msg) => {
    const msg = _msg as V2NIMMessageForUI;
    const _replyMsg = props.replyMsgsMap?.[msg.messageClientId];
    // 此处将 replyMsg.value 置空是为了解决：撤回普通消息1，撤回回复消息2，重新编辑消息2，再重新编辑消息1，输入框上方依然显示消息2的引用，消息1发送出去消息消息2的引用消息
    replyMsg.value = undefined;
    isReplyMsg.value = false;
    store?.msgStore.removeReplyMsgActive(msg.conversationId);
    // 如果重新编辑的是回复消息，则需要将回复消息展示在输入框上方
    if (_replyMsg?.messageClientId) {
      _replyMsg && store?.msgStore.replyMsgActive(_replyMsg);
      replyMsg.value = _replyMsg;
      isReplyMsg.value = true;
    }

    inputText.value = msg?.oldText || "";
    prevInputText.value = msg?.oldText || "";
    selectedAtMembers.value = [];
    isFocus.value = true;

    if (msg?.serverExtension) {
      try {
        const ext = JSON.parse(msg.serverExtension) as YxServerExt;
        if (ext?.yxAitMsg) {
          const atMembers: { accountId: string; appellation: string }[] = [];
          for (const accountId of Object.keys(ext.yxAitMsg)) {
            const aitInfo = ext.yxAitMsg[accountId];
            if (aitInfo?.text) {
              const appellation = aitInfo.text.startsWith("@")
                ? aitInfo.text.substring(1)
                : aitInfo.text;
              atMembers.push({ accountId, appellation });
            }
          }

          if (atMembers.length > 0) {
            selectedAtMembers.value = atMembers;
          }
        }
      } catch {
        // ignore
      }
    }
  });
  // 回复消息
  emitter.on(events.REPLY_MSG, (msg) => {
    isReplyMsg.value = true;
    isFocus.value = true;
    replyMsg.value = msg as V2NIMMessageForUI;
  });

  // @提及成员
  emitter.on(events.AIT_TEAM_MEMBER, (member) => {
    const beReplyMember = member as { accountId: string; appellation: string };
    selectedAtMembers.value = [
      ...selectedAtMembers.value.filter(
        (item) => item.accountId !== beReplyMember.accountId
      ),
      beReplyMember,
    ];
    const newInputText =
      inputText.value + "@" + beReplyMember.appellation + " ";
    /** 更新input框的内容 */
    inputText.value = newInputText;
    prevInputText.value = newInputText;
  });

  // 关闭表情、语音、发送更多面板
  emitter.on(events.CLOSE_PANEL, () => {
    emojiVisible.value = false;
    sendMoreVisible.value = false;
  });
});

onUnmounted(() => {
  removeReplyMsg();
  uninstallTeamWatch();
});
</script>

<style scoped>
.input-root {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: auto;
  max-height: 300px;
}

.msg-input-wrapper {
  width: 100%;
  background-color: #eff1f3;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  z-index: 999;
  display: flex;
  flex-direction: column;
  padding: 8px 0 0;
  box-sizing: border-box;
}

.msg-input-input {
  background-color: #fff;
  font-size: 16px;
  border-radius: 6px;
  -webkit-tap-highlight-color: transparent;
}

.input-inner {
  width: 100%;
  padding: 0 12px;
  box-sizing: border-box;
}

.input-action-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 8px 12px;
  box-sizing: border-box;
}

.input-action-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  border-radius: 6px;
  -webkit-tap-highlight-color: transparent;
  justify-self: center;
}

.input-action-icon:active {
  background-color: rgba(0, 0, 0, 0.05);
}

.input-action-empty {
  cursor: default;
}

.input-action-empty:active {
  background-color: transparent;
}

.input-send-more {
  justify-self: end;
}

.send-more-expand {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 8px 12px 12px;
  box-sizing: border-box;
}

.send-more-expand-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  position: relative;
  justify-self: center;
}

.send-more-expand-icon {
  width: 56px;
  height: 56px;
  background-color: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-more-expand-label {
  font-size: 11px;
  color: #747475;
  margin-top: 6px;
  text-align: center;
}

.msg-emoji-panel {
  width: 100%;
  background-color: #fff;
  z-index: 1;
}

.reply-message-wrapper {
  display: flex;
  font-size: 13px;
  background-color: #eff1f2;
  height: 25px;
  padding-top: 6px;
  align-items: center;
  color: #929299;
}

.reply-message-wrapper .reply-noFind {
  width: fit-content;
}

.reply-message-wrapper .reply-to-colon {
  flex-basis: 3px;
  margin-right: 2px;
}

.reply-message-wrapper .reply-message-close {
  flex-basis: 14px;
  margin-left: 10px;
  display: flex;
  align-items: center;
}

.reply-message-wrapper .reply-message {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-message-wrapper .reply-message message-one-line {
  flex: 1;
  font-size: 13px;
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.reply-message-wrapper .reply-title {
  flex-basis: 30px;
  white-space: nowrap;
  margin-right: 5px;
}

.reply-message-wrapper .reply-to {
  max-width: 120px;
  flex: 0 0 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.fake-input {
  background-color: #fff;
  height: 40px;
  line-height: 40px;
  font-size: 16px;
  padding: 0 12px;
  border-radius: 6px;
}

.input-text {
  white-space: nowrap;
  color: #000;
}

.input-placeholder {
  background-color: #fff;
  height: 40px;
  line-height: 40px;
  font-size: 16px;
  border-radius: 6px;
  color: #c0c4cc;
}

.file-input-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}
</style>
