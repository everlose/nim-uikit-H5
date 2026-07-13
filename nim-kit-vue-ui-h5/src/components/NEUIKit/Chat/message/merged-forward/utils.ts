import { V2NIMConst } from "nim-web-sdk-ng/dist/esm/nim";
import type { V2NIMMessage } from "nim-web-sdk-ng/dist/esm/nim/src/V2NIMMessageService";
import type { V2NIMMessageForUI } from "@xkit-yx/im-store-v2/dist/types/src/types";
import type RootStore from "@xkit-yx/im-store-v2/dist/types/src";
import type { NIM } from "nim-web-sdk-ng/dist/esm/nim";
import { getMsgContentTipByType } from "../../../utils/msg";
import { t } from "../../../utils/i18n";

export const MERGED_FORWARD_TYPE = 101;
export const MERGED_FORWARD_LIMIT = 100;
export const MERGED_FORWARD_MAX_DEPTH = 3;
export const ONE_BY_ONE_FORWARDABLE_MESSAGE_TYPE_WHITELIST = [
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO,
];
export const MERGE_FORWARDABLE_MESSAGE_TYPE_WHITELIST = [
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO,
  V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL,
];

export interface MergedForwardAbstract {
  senderNick: string;
  content: string;
  userAccId: string;
}

export interface MergedForwardPayload {
  type: typeof MERGED_FORWARD_TYPE;
  data: {
    abstracts?: MergedForwardAbstract[];
    depth?: number;
    md5?: string;
    sessionId?: string;
    sessionName?: string;
    url?: string;
  };
}

const parseJson = (value: unknown) => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return typeof value === "object" ? value : undefined;
};

export const parseMergedForwardPayload = (msg?: {
  messageType?: V2NIMConst.V2NIMMessageType;
  attachment?: unknown;
  content?: unknown;
  text?: string;
}): MergedForwardPayload | undefined => {
  if (
    !msg ||
    msg.messageType !==
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM
  ) {
    return undefined;
  }

  const candidates = [
    (msg.attachment as any)?.raw,
    (msg as any).content,
    msg.text,
  ];

  for (const candidate of candidates) {
    const payload = parseJson(candidate) as MergedForwardPayload | undefined;
    if (payload?.type === MERGED_FORWARD_TYPE && payload.data) {
      return payload;
    }
  }

  return undefined;
};

export const getMergedForwardDepth = (msg: V2NIMMessageForUI): number => {
  const payload = parseMergedForwardPayload(msg);
  return Number(payload?.data?.depth || 0);
};

export const isMergedForwardMsg = (
  store: RootStore,
  msg: V2NIMMessageForUI
): boolean => {
  return !!store.msgStore.isChatMergedForwardMsg(msg);
};

export const hasForwardableBaseState = (msg?: V2NIMMessageForUI): boolean => {
  return !!(
    msg &&
    !msg.recallType &&
    msg.sendingState ===
      V2NIMConst.V2NIMMessageSendingState
        .V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED &&
    !isMessageStatusFailed(msg) &&
    msg.messageType !==
      V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION
  );
};

export const isMessageStatusFailed = (msg?: V2NIMMessageForUI): boolean => {
  const errorCode = msg?.messageStatus?.errorCode;
  return errorCode !== undefined && errorCode !== 200;
};

export const isForwardableMessageType = (
  msg: V2NIMMessageForUI,
  whitelist = ONE_BY_ONE_FORWARDABLE_MESSAGE_TYPE_WHITELIST
): boolean => {
  return whitelist.includes(msg.messageType);
};

export const isForwardableMergedCustomMessage = (
  store: RootStore,
  msg: V2NIMMessageForUI,
  options?: { checkDepth?: boolean }
): boolean => {
  if (
    msg.messageType !==
    V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM
  ) {
    return false;
  }
  if (!isMergedForwardMsg(store, msg)) {
    return false;
  }
  return !options?.checkDepth || getMergedForwardDepth(msg) < MERGED_FORWARD_MAX_DEPTH;
};

export const isMergeForwardableMessage = (
  store: RootStore,
  msg: V2NIMMessageForUI
): boolean => {
  if (!hasForwardableBaseState(msg)) {
    return false;
  }

  if (
    msg.messageType ===
    V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM
  ) {
    return isForwardableMergedCustomMessage(store, msg, { checkDepth: true });
  }

  return isForwardableMessageType(msg, MERGE_FORWARDABLE_MESSAGE_TYPE_WHITELIST);
};

export const getSourceSessionInfo = (
  store: RootStore,
  nim: NIM,
  conversationId: string
) => {
  const sessionId =
    nim.V2NIMConversationIdUtil.parseConversationTargetId(conversationId);
  const conversationType =
    nim.V2NIMConversationIdUtil.parseConversationType(
      conversationId
    ) as unknown as V2NIMConst.V2NIMConversationType;
  const sessionName =
    conversationType ===
    V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
      ? store.teamStore.teams.get(sessionId)?.name || sessionId
      : store.userStore.users.get(sessionId)?.name || sessionId;

  return {
    sessionId,
    sessionName,
  };
};

export const getMergedForwardAbstracts = (
  store: RootStore,
  msgs: V2NIMMessageForUI[],
  chatHistoryText: string
): MergedForwardAbstract[] => {
  return [...msgs]
    .sort((a, b) => a.createTime - b.createTime)
    .slice(0, 3)
    .map((msg) => {
      const senderId = (msg as any).__kit__senderId || msg.senderId;
      const senderNick = store.userStore.users.get(senderId)?.name || senderId;
      const content = getMergedForwardAbstractContent(
        store,
        msg,
        chatHistoryText
      );

      return {
        senderNick,
        content,
        userAccId: senderId,
      };
    });
};

export const getMergedForwardCallText = (msg: V2NIMMessageForUI): string => {
  return (msg.attachment as any)?.type == 1
    ? `[${t("voiceCallText")}]`
    : `[${t("videoCallText")}]`;
};

export const getMergedForwardAbstractContent = (
  store: RootStore,
  msg: V2NIMMessageForUI,
  chatHistoryText: string
) => {
  if (
    msg.messageType ===
    V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_AUDIO
  ) {
    return `[${t("audioMsgText")}]`;
  }
  if (
    msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CALL
  ) {
    return getMergedForwardCallText(msg);
  }
  return getMsgContentTipByType({
    messageType: msg.messageType,
    text: isMergedForwardMsg(store, msg)
      ? `[${chatHistoryText}]`
      : msg.text || "",
  });
};

export const normalizeMergedForwardText = (mergeMsg: string): string => {
  return (mergeMsg || "").replace(/("12"\s*:\s*)(\d+)/g, '$1"$2"');
};

const md5Add = (x: number, y: number) => {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
};

const md5Rotate = (num: number, count: number) =>
  (num << count) | (num >>> (32 - count));

const md5Round = (
  q: number,
  a: number,
  b: number,
  x: number,
  s: number,
  t: number
) => md5Add(md5Rotate(md5Add(md5Add(a, q), md5Add(x, t)), s), b);

const md5F = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  md5Round((b & c) | (~b & d), a, b, x, s, t);
const md5G = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  md5Round((b & d) | (c & ~d), a, b, x, s, t);
const md5H = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  md5Round(b ^ c ^ d, a, b, x, s, t);
const md5I = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
  md5Round(c ^ (b | ~d), a, b, x, s, t);

const stringToMd5Blocks = (input: string) => {
  const bytes = new TextEncoder().encode(input);
  const blocks: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    blocks[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }
  blocks[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  blocks[(((bytes.length + 8) >> 6) + 1) * 16 - 2] = bytes.length * 8;
  return blocks;
};

const toHex = (num: number) => {
  let result = "";
  for (let i = 0; i < 4; i += 1) {
    result += ((num >> (i * 8)) & 0xff).toString(16).padStart(2, "0");
  }
  return result;
};

const getTextMd5 = (input: string) => {
  const x = stringToMd5Blocks(input);
  let a = 0x67452301;
  let b = -0x10325477;
  let c = -0x67452302;
  let d = 0x10325476;

  for (let i = 0; i < x.length; i += 16) {
    const oldA = a;
    const oldB = b;
    const oldC = c;
    const oldD = d;

    a = md5F(a, b, c, d, x[i], 7, -680876936);
    d = md5F(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5F(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5F(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5F(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5F(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5F(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5F(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5F(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5F(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5F(c, d, a, b, x[i + 10], 17, -42063);
    b = md5F(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5F(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5F(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5F(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5F(b, c, d, a, x[i + 15], 22, 1236535329);

    a = md5G(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5G(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5G(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5G(b, c, d, a, x[i], 20, -373897302);
    a = md5G(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5G(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5G(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5G(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5G(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5G(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5G(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5G(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5G(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5G(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5G(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5G(b, c, d, a, x[i + 12], 20, -1926607734);

    a = md5H(a, b, c, d, x[i + 5], 4, -378558);
    d = md5H(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5H(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5H(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5H(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5H(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5H(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5H(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5H(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5H(d, a, b, c, x[i], 11, -358537222);
    c = md5H(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5H(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5H(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5H(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5H(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5H(b, c, d, a, x[i + 2], 23, -995338651);

    a = md5I(a, b, c, d, x[i], 6, -198630844);
    d = md5I(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5I(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5I(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5I(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5I(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5I(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5I(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5I(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5I(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5I(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5I(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5I(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5I(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5I(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5I(b, c, d, a, x[i + 9], 21, -343485551);

    a = md5Add(a, oldA);
    b = md5Add(b, oldB);
    c = md5Add(c, oldC);
    d = md5Add(d, oldD);
  }

  return `${toHex(a)}${toHex(b)}${toHex(c)}${toHex(d)}`;
};

export const sendMergedForwardMessage = async ({
  store,
  nim,
  msgs,
  conversationId,
  sourceConversationId,
  appVersion,
  chatHistoryText,
  comment,
}: {
  store: RootStore;
  nim: NIM;
  msgs: V2NIMMessageForUI[];
  conversationId: string;
  sourceConversationId: string;
  appVersion: string;
  chatHistoryText: string;
  comment?: string;
}) => {
  // 合并转发消息中发送者昵称应使用用户真实昵称，而非备注名
  // 临时覆盖 getAppellation 以避免 serializeMergeMsgs 内部取到备注
  const originalGetAppellation = store.uiStore.getAppellation.bind(store.uiStore);
  store.uiStore.getAppellation = (options: { account: string; teamId?: string; ignoreAlias?: boolean }) => {
    return store.userStore.users.get(options.account)?.name || options.account;
  };
  const { content, depth } = store.msgStore.serializeMergeMsgs(
    msgs as unknown as V2NIMMessage[],
    {
      appVersion,
      sdkVersion: (nim as any).version || "",
    }
  );
  store.uiStore.getAppellation = originalGetAppellation;
  const mergedMsgsFile = new File([content], "mergedMsgs.txt", {
    type: "text/plain",
  });
  const url = await store.storageStore.uploadFileActive(mergedMsgsFile);
  const md5 = getTextMd5(content);
  const { sessionId, sessionName } = getSourceSessionInfo(
    store,
    nim,
    sourceConversationId
  );
  const payload: MergedForwardPayload = {
    type: MERGED_FORWARD_TYPE,
    data: {
      abstracts: getMergedForwardAbstracts(store, msgs, chatHistoryText),
      depth,
      md5,
      sessionId,
      sessionName,
      url,
    },
  };
  const customMsg = nim.V2NIMMessageCreator.createCustomMessage(
    `[${chatHistoryText}]`,
    JSON.stringify(payload)
  );

  const promises: Promise<any>[] = [
    store.msgStore.sendMessageActive({
      msg: customMsg as unknown as V2NIMMessage,
      conversationId,
    })
  ];

  if (comment) {
    const textMsg = nim.V2NIMMessageCreator.createTextMessage(comment);
    promises.push(
      store.msgStore.sendMessageActive({
        msg: textMsg as unknown as V2NIMMessage,
        conversationId,
      })
    );
  }

  await Promise.all(promises);
};
