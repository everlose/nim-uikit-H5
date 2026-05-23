<template>
  <div>
    <div
      v-if="
        props.lastMessage.lastMessageState ===
        V2NIMConst.V2NIMLastMessageState.V2NIM_MESSAGE_STATUS_REVOKE
      "
    >
      {{ t("recall") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION
      "
    >
      {{ t("conversationNotificationText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.sendingState ===
        V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED
      "
    >
      {{ t("conversationSendFailText") }}
    </div>

    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE
      "
    >
      {{ translateMsg("fileMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE
      "
    >
      {{ translateMsg("imgMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        isMergedForward
      "
    >
      {{ translateMsg("chatHistoryText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM
      "
    >
      {{ props.lastMessage.text || translateMsg("customMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO
      "
    >
      {{ translateMsg("audioMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL
      "
    >
      {{ translateMsg("callMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_LOCATION
      "
    >
      {{ translateMsg("geoMsgText") }}
    </div>

    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_ROBOT
      "
    >
      {{ translateMsg("robotMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TIPS
      "
    >
      {{ translateMsg("tipMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
      "
    >
      {{ translateMsg("videoMsgText") }}
    </div>
    <div
      v-else-if="
        props.lastMessage.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
      "
      class="msg-conversation-text-wrap"
    >
      <template v-for="item in textArr">
        <template v-if="item.type === 'text'">
          <span class="msg-conversation-text">{{ item.value }}</span>
        </template>
        <template v-else-if="item.type === 'emoji'">
          <span class="msg-conversation-text-emoji">
            <Icon :type="EMOJI_ICON_MAP_CONFIG[item.value]" :size="16" />
          </span>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import Icon from "../CommonComponents/Icon.vue";
import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import { t } from "../utils/i18n";
import type { V2NIMLastMessage } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMConversationService";
import { EMOJI_ICON_MAP_CONFIG, emojiRegExp } from "../utils/emoji";
import { parseMergedForwardPayload } from "../Chat/message/merged-forward/utils";
const props = withDefaults(
  defineProps<{
    lastMessage: V2NIMLastMessage;
  }>(),
  {}
);

// 筛选出文本和表情
const parseTextWithEmoji = (text: string) => {
  if (!text) return [];
  const matches: {
    type: "emoji" | "text";
    value: string;
    index: number;
  }[] = [];
  let match;
  const regexEmoji = emojiRegExp;
  regexEmoji.lastIndex = 0;

  let lastIndex = 0;
  while ((match = regexEmoji.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) {
        matches.push({
          type: "text",
          value: textBefore,
          index: lastIndex,
        });
      }
    }

    matches.push({
      type: "emoji",
      value: match[0],
      index: match.index,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      matches.push({
        type: "text",
        value: remainingText,
        index: lastIndex,
      });
    }
  }

  return matches.sort((a, b) => a.index - b.index);
};

const textArr = computed(() => {
  return parseTextWithEmoji(props.lastMessage.text as string);
});

const isMergedForward = computed(() => {
  return !!parseMergedForwardPayload(props.lastMessage as any);
});

const translateMsg = (key: string): string => {
  const text =
    {
      textMsgText: t("textMsgText"),
      customMsgText: t("customMsgText"),
      audioMsgText: t("audioMsgText"),
      videoMsgText: t("videoMsgText"),
      fileMsgText: t("fileMsgText"),
      callMsgText: t("callMsgText"),
      geoMsgText: t("geoMsgText"),
      imgMsgText: t("imgMsgText"),
      notiMsgText: t("notiMsgText"),
      robotMsgText: t("robotMsgText"),
      tipMsgText: t("tipMsgText"),
      unknowMsgText: t("unknowMsgText"),
      chatHistoryText: t("chatHistoryText"),
    }[key] || "";
  return `[${text}]`;
};
</script>

<style scoped>
.wrapper {
  flex: 1;
  font-size: 13px;
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.msg-conversation-text {
  font-size: 13px !important;
  height: 22px;
  line-height: 22px;
  width: 100%;
  display: inline;
  margin-right: 4px;
}

.msg-conversation-text:last-child {
  margin-right: 0;
}

.msg-conversation-text-wrap {
  width: 100%;
  line-height: 22px;
  height: 22px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-sizing: border-box;
  font-size: 14px;
}
.msg-conversation-text-emoji {
  display: inline-flex;
  width: 18px;
  height: 18px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.msg-conversation-text-emoji-wx {
  display: inline-flex;
  width: 18px;
  height: 18px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  position: relative;
  bottom: 4px;
}
</style>
