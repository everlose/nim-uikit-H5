<template>
  <div
    :class="`msg-item-wrapper ${
      props.msg.pinState &&
      !(
        props.msg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        props.msg.timeValue !== undefined
      ) &&
      !props.msg.recallType
        ? 'msg-pin'
        : ''
    } ${!props.readonly && props.isMultiSelecting ? 'msg-item-multi-selecting' : ''} ${
      !props.readonly && props.isMultiSelecting && selectable ? 'msg-item-selectable' : ''
    }`"
    :id="MSG_ID_FLAG + props.msg.messageClientId"
    @click.capture="handleMultiSelectItemClick"
  >
    <div v-if="!props.readonly && props.isMultiSelecting && selectable" class="msg-select-column">
      <div class="msg-select-box" :class="{ selected: props.selected }">
        <svg v-if="props.selected" class="msg-select-check" viewBox="0 0 18 18" width="18" height="18" fill="none">
          <path d="M5.15 8.74L8 12.5L14.24 7.18" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    <!-- 消息时间间隔提示 -->
    <div
      class="msg-time"
      v-if="
        props.msg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        props.msg.timeValue !== undefined
      "
    >
      {{ props.msg.timeValue }}
    </div>
    <!-- 撤回消息-可重新编辑 -->
    <div
      class="msg-common"
      :style="{
        flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse',
      }"
      v-else-if="
        props.msg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        props.msg.recallType === 'reCallMsg' &&
        props.msg.canEdit
      "
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
       <MessageBubble :msg="props.msg" :bg-visible="true"
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
        <span class="recall-text">{{ t("recall2") }}</span>
        <text
          class="msg-recall-btn"
          @click="
            () => {
              handleReeditMsg(props.msg);
            }
          "
        >
          {{ t("reeditText") }}
        </text>
      </MessageBubble>
    </div>
    <!-- 撤回消息-不可重新编辑 -->
    <div
      class="msg-common"
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
      v-else-if="
        props.msg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        props.msg.recallType === 'reCallMsg' &&
        !props.msg.canEdit
      "
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
       <MessageBubble :msg="props.msg" :bg-visible="true"
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
        <div class="recall-text">{{ t("you") + t("recall") }}</div>
      </MessageBubble>
    </div>
    <!-- 撤回消息-对方撤回-->
    <div
      class="msg-common"
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
      v-else-if="
        props.msg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        props.msg.recallType === 'beReCallMsg'
      "
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble :msg="props.msg" :bg-visible="true"
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
        <span class="recall-text">{{ !props.msg.isSelf ? t("recall2") : `${t("you") + t("recall")}` }}</span>
      </MessageBubble>
      </div>
    </div>
    <!-- 文本消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
        
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          <ReplyMessage v-if="!!replyMsg" :replyMsg="replyMsg"></ReplyMessage>
          <MessageText :msg="props.msg" :disable-ait="props.readonly"></MessageText>
        </MessageBubble>
      </div>
      <MessageIsRead v-if="props.msg?.isSelf && !props.readonly" :msg="props.msg"></MessageIsRead>
    </div>
    <!-- 合并转发消息 -->
    <div
      class="msg-common"
      v-else-if="isMergedForward"
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
        <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="false"
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          <MergedForwardCard :msg="props.msg" />
        </MessageBubble>
      </div>
      <MessageIsRead v-if="props.msg?.isSelf && !props.readonly" :msg="props.msg"></MessageIsRead>
    </div>
    <!-- 图片消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
        
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          <div
            @click="
              () => {
                //@ts-ignore
                handleImageTouch(props.msg.attachment.url);
              }
            "
          >
          <div
            class="msg-image"
            :style="imageRenderStyle"
            v-if="props.msg.sendingState == V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING"
          >
            <div 
              class="loading-spinner"
            ></div>
          </div>
            <img
              v-else
              class="msg-image"
              :style="imageRenderStyle"
              :lazy-load="true"
              mode="aspectFill"
              :src="imageThumbUrl"
            />
          </div>
        </MessageBubble>
        <!-- 图片预览 -->
        <PreviewImage
          :visible="isPreviewVisible"
          :image-url="imageUrl"
          :onClose="
            () => {
              isPreviewVisible = false;
            }
          "
        />
      </div>
      <MessageIsRead v-if="props.msg?.isSelf && !props.readonly" :msg="props.msg"></MessageIsRead>
    </div>
    <!-- 视频消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
        
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          <div
            class="video-msg-wrapper"
            @click="() => handleVideoTouch(props.msg)"
          >
            <div class="video-play-button">
              <div class="video-play-icon"></div>
            </div>
            <img
              class="msg-image"
              :style="imageRenderStyle"
              :lazy-load="true"
              mode="aspectFill"
              :src="videoFirstFrameDataUrl"
            ></img>
          </div>
        </MessageBubble>
      </div>
      <MessageIsRead v-if="props.msg?.isSelf && !props.readonly" :msg="props.msg"></MessageIsRead>
    </div>
    <!-- 音视频消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
        
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          <span v-if="props.readonly">[{{ callRecordText }}]</span>
          <MessageG2 v-else :msg="props.msg" />
        </MessageBubble>
      </div>
    </div>
    <!-- 文件消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="false"
        
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          <MessageFile :msg="props.msg" />
        </MessageBubble>
      </div>
      <MessageIsRead v-if="props.msg?.isSelf && !props.readonly" :msg="props.msg"></MessageIsRead>
    </div>
    <!-- 语音消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO
      "
      :style="{
        flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse',
      }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
          :voice-text-map="props.voiceTextMap"
          :set-voice-text="props.setVoiceText"
        
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          <span v-if="props.readonly">[{{ t("audioMsgText") }}]</span>
          <MessageAudio
            v-else
            :msg="props.msg"
            :broadcastNewAudioSrc="broadcastNewAudioSrc"
            :voice-text="props.voiceTextMap?.[props.msg.messageClientId]"
          />
        </MessageBubble>
      </div>
      <MessageIsRead v-if="props.msg?.isSelf && !props.readonly" :msg="props.msg"></MessageIsRead>
    </div>
    <!-- 通知消息 -->
    <MessageNotification
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION
      "
      :msg="props.msg"
    />
    <!-- 地理位置消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_LOCATION
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          [{{ t("geoMsgText") }}]
        </MessageBubble>
      </div>
    </div>
    <!-- 机器人消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_ROBOT
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          [{{ t("robotMsgText") }}]
        </MessageBubble>
      </div>
    </div>
    <!-- 提示消息 -->
    <div
      class="msg-common"
      v-else-if="
        props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TIPS
      "
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"
          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          [{{ t("tipMsgText") }}]
        </MessageBubble>
      </div>
    </div>
    <!-- 未知消息 -->
    <div
      class="msg-common"
      :style="{ flexDirection: !props.msg.isSelf ? 'row' : 'row-reverse' }"
      v-else
    >
      <Avatar
        :account="props.msg.senderId"
        :teamId="teamId"
        :goto-user-card="!props.readonly"
        @onLongpress="handleAvatarLongpress"
      />
      <div class="msg-content">
        <div class="msg-name" v-if="props.readonly || (!props.msg.isSelf && isTeamChat)">
          {{ appellation }}
        </div>
         <MessageBubble
          :msg="props.msg"
          :tooltip-visible="true"
          :bg-visible="true"

          :is-multi-selecting="props.isMultiSelecting"
          :on-multi-select="props.onMultiSelect"
          :readonly="props.readonly"
        >
          [{{ t("unknowMsgText") }}]
        </MessageBubble>
      </div>
    </div>
    <div
      v-if="isPinned && !props.readonly"
      :class="props.msg.isSelf ? 'msg-pin-tip msg-pin-tip-self' : 'msg-pin-tip'"
    >
      <Icon type="icon-green-pin" :size="12" />
      <template v-if="isEnglish">
        <span class="msg-pin-tip-label">{{ pinTipLabel }} </span>
        <span class="msg-pin-tip-name">{{ pinTipName }}</span>
      </template>
      <template v-else>
        <span class="msg-pin-tip-name">{{ pinTipName }}</span>
        <span class="msg-pin-tip-label">{{ pinTipLabel }}</span>
      </template>
    </div>
    <div
      v-if="videoPlayerVisible"
      class="video-player-overlay"
      @click="videoPlayerVisible = false"
    >
      <button class="video-player-close" type="button" @click="videoPlayerVisible = false" aria-label="关闭">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="14" fill="#4C4C4C"/>
          <line x1="9" y1="9" x2="18.5" y2="18.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
          <line x1="19" y1="9" x2="9.5" y2="18.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <video :src="videoPlayerUrl" controls autoplay playsinline @click.stop></video>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  ref,
  computed,
  onUnmounted,
  getCurrentInstance,
} from "vue";
import Avatar from "../../CommonComponents/Avatar.vue";
import Icon from "../../CommonComponents/Icon.vue";
import MessageBubble from "./message-bubble.vue";
import { events, MSG_ID_FLAG } from "../../utils/constants";
import { autorun } from "mobx";
import { t } from "../../utils/i18n";
import { getLanguage } from "../../utils/i18n";
import ReplyMessage from "./message-reply.vue";
import MessageFile from "./message-file.vue";
import MessageText from "./message-text.vue";
import MessageAudio from "./message-audio.vue";
import MessageNotification from "./message-notification.vue";
import MessageG2 from "./message-g2.vue";
import MergedForwardCard from "./merged-forward/card.vue";
import PreviewImage from "../../CommonComponents/PreviewImage.vue";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import MessageIsRead from "./message-read.vue";
import emitter from "../../utils/eventBus";
import { getPinOperatorId, isMessagePinned } from "../message-pin/utils";
import { isSelectableMessage } from "./message-multi-select/utils";
import { getMergedForwardCallText, isMergedForwardMsg } from "./merged-forward/utils";
import { getImageAttachmentSize, getImageRenderStyle, getImageThumbUrl } from "../../utils/image";

const isPreviewVisible = ref(false);
const props = withDefaults(
  defineProps<{
    msg: V2NIMMessageForUI & { timeValue?: number };
    index: number;
    replyMsgsMap?: {
      [key: string]: V2NIMMessageForUI;
    };
    broadcastNewAudioSrc: string;
    voiceTextMap?: Record<string, string>;
    setVoiceText?: (messageClientId: string, text: string) => void;
    isMultiSelecting?: boolean;
    selected?: boolean;
    onToggleSelect?: (msg: V2NIMMessageForUI) => void;
    onMultiSelect?: (msg: V2NIMMessageForUI) => void;
    readonly?: boolean;
  }>(),
  {
    isMultiSelecting: false,
    selected: false,
    readonly: false,
  }
);


const { proxy } = getCurrentInstance()!; // 获取组件实例
const store = proxy?.$UIKitStore;
const selectable = computed(() => !props.readonly && isSelectableMessage(props.msg));
const isMergedForward = computed(
  () => !!store && isMergedForwardMsg(store, props.msg)
);

const handleMultiSelectItemClick = (event: Event) => {
  if (!props.isMultiSelecting || !selectable.value) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  props.onToggleSelect?.(props.msg);
};

// 昵称
const appellation = ref("");

// 被回复的消息
const replyMsg = computed(() => {
  return props.replyMsgsMap && props.replyMsgsMap[props.msg.messageClientId];
});


const isReadonly = computed(() => props.readonly);
const canParseConversationId = computed(
  () => !isReadonly.value && !!props.msg.conversationId
);
// 会话类型
const conversationType = computed(() => {
  if (isReadonly.value) {
    return props.msg.conversationType as unknown as V2NIMConst.V2NIMConversationType;
  }
  return proxy?.$NIM.V2NIMConversationIdUtil.parseConversationType(
    props.msg.conversationId
  ) as unknown as V2NIMConst.V2NIMConversationType;
});
const isTeamChat = computed(() =>
  conversationType.value ===
  V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
);
// 会话对象
const to = computed(() => {
  if (!canParseConversationId.value) {
    return "";
  }
  return proxy?.$NIM.V2NIMConversationIdUtil.parseConversationTargetId(
    props.msg.conversationId
  );
});

const mergedMessageServerExtension = computed(() => {
  if (!isReadonly.value || !props.msg.serverExtension) {
    return {};
  }
  try {
    return JSON.parse(props.msg.serverExtension) as {
      mergedMessageNickKey?: string;
      mergedMessageAvatarKey?: string;
    };
  } catch {
    return {};
  }
});

// 获取视频首帧
const videoFirstFrameDataUrl = computed(() => {
  //@ts-ignore
  const url = props.msg.attachment?.url;
  return url ? `${url}${url.includes("?") ? "&" : "?"}vframe=1` : "";
});

// 图片
const imageUrl = computed(() => {
  // 被拉黑
  if (props.msg.messageStatus?.errorCode == 102426) {
    return "https://yx-web-nosdn.netease.im/common/c1f278b963b18667ecba4ee9a6e68047/img-fail.png";
  }
  //@ts-ignore
  return props.msg?.attachment?.url || props.msg.attachment?.file;
});

const imageThumbUrl = computed(() => {
  const { width, height } = getImageAttachmentSize(props.msg.attachment);
  return getImageThumbUrl(imageUrl.value, width, height);
});

const imageRenderStyle = computed(() => {
  const { width, height } = getImageAttachmentSize(props.msg.attachment);
  return getImageRenderStyle(width, height, "chat");
});

// 点击图片预览
const handleImageTouch = (url: string) => {
  if (url) {
    isPreviewVisible.value = true;
  }
};

// 视频播放 overlay 状态
const videoPlayerUrl = ref('')
const videoPlayerVisible = ref(false)

// 点击视频播放
const handleVideoTouch = (msg: V2NIMMessageForUI) => {
   //@ts-ignore
   const url = msg.attachment?.url;
  if (url) {
    // 在当前页面打开视频播放 overlay，不跳转新窗口
    videoPlayerUrl.value = url
    videoPlayerVisible.value = true
  }
};

// 重新编辑消息
const handleReeditMsg = (msg: V2NIMMessageForUI) => {
  emitter.emit(events.ON_REEDIT_MSG, msg);
};

// 监听昵称变化
const uninstallAppellationWatch = autorun(() => {
  if (isReadonly.value) {
    appellation.value =
      mergedMessageServerExtension.value.mergedMessageNickKey ||
      props.msg.senderId;
    return;
  }
  // 昵称展示顺序 群昵称 > 备注 > 个人昵称 > 帐号
  appellation.value = proxy?.$UIKitStore.uiStore.getAppellation({
    account: props.msg.senderId,
    teamId:
      conversationType.value ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
        ? to.value
        : "",
  }) as string;
});

const callRecordText = computed(() => {
  return getMergedForwardCallText(props.msg).slice(1, -1);
});

// 群聊ID
const teamId = computed(() => {
  if (
    conversationType.value ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  ) {
    return to.value;
  }
  return "";
});

const canAitSender = computed(() => {
  return (
    !props.readonly &&
    !props.msg.isSelf &&
    conversationType.value ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
  );
});

const handleAvatarLongpress = () => {
  if (!canAitSender.value) {
    return;
  }

  emitter.emit(events.AIT_TEAM_MEMBER, {
    accountId: props.msg.senderId,
    appellation: proxy?.$UIKitStore.uiStore.getAppellation({
      account: props.msg.senderId,
      teamId: teamId.value,
      ignoreAlias: true,
    }),
  });
};

const isPinned = computed(() => {
  return (
    isMessagePinned(props.msg) &&
    !(
      props.msg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
      props.msg.timeValue !== undefined
    ) &&
    !props.msg.recallType
  );
});

const pinTipLabel = computed(() => t("pinThisText"));
const isEnglish = computed(() => getLanguage() === "en");
const pinTipName = computed(() => {
  const pinInfoMap = store?.msgStore.pinMsgs.map.get(props.msg.conversationId);
  const pinOperatorId = getPinOperatorId(props.msg, pinInfoMap);
  const pinOperatorName = pinOperatorId
    ? store?.uiStore.getAppellation({
        account: pinOperatorId,
        teamId:
          conversationType.value ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
            ? to.value
            : "",
      })
    : "";
  return pinOperatorId === store?.userStore.myUserInfo?.accountId
    ? t("you")
    : pinOperatorName || pinOperatorId;
});

onUnmounted(() => {
  uninstallAppellationWatch();
});
</script>

<style scoped>
.msg-item-wrapper {
  padding: 8px 20px;
  position: relative;
  box-sizing: border-box;
}

.msg-pin {
  background-color: #fffbea;
}

.msg-item-multi-selecting {
  padding-left: 46px;
}

.msg-item-selectable {
  cursor: pointer;
}

.msg-select-column {
  position: absolute;
  left: 0;
  top: 8px;
  width: 40px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.msg-select-box {
  width: 18px;
  height: 18px;
  box-sizing: border-box;
  border: 1px solid #969AA0;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.msg-select-box.selected {
  border-color: #337eff;
  background: #337eff;
}

.msg-select-check {
}

.msg-common {
  display: flex;
  align-items: flex-start;
  font-size: 16px;
}
.msg-pin-tip {
  font-size: 11px;
  font-weight: normal;
  color: #3eaf96;
  margin: 0 50px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
}
.msg-pin-tip-self {
  justify-content: flex-end;
}
.msg-pin-tip-label {
  flex-shrink: 0;
}
.msg-pin-tip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 10px auto;
  position: relative;
  top: 50%;
  transform: translateY(-50%);

}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.msg-content {
  display: flex;
  flex-direction: column;
}

.msg-name {
  font-size: 12px;
  color: #999;
  text-align: left;
  margin-bottom: 4px;
  max-width: 300px;
  padding-left: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.msg-image {
  display: block;
  max-width: 100%;
  background: #f5f6f8;
}

.msg-time {
  margin-top: 8px;
  text-align: center;
  color: #b3b7bc;
  font-size: 12px;
}

.msg-recall-btn {
  margin-left: 5px;
  color: #1861df;
}

.recall-text{
  color: #666666;
}

.video-play-button {
  width: 50px;
  height: 50px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  z-index: 9;
}

.video-play-icon {
  width: 0;
  height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 18px solid #fff;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-40%, -50%);
}

.video-msg-wrapper {
  box-sizing: border-box;
  max-width: 360px;
}

.video-player-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;

  .video-player-close {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    z-index: 10;
  }

  video {
    max-width: 100vw;
    max-height: 70vh;
  }
}
</style>
