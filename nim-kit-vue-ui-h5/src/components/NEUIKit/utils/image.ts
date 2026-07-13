import type { CSSProperties } from "vue";

export type ImagePreviewMode = "chat" | "compact";
export type ImageRenderStyle = CSSProperties;

const DEFAULT_VIEWPORT_WIDTH = 375;
const DEFAULT_VIEWPORT_HEIGHT = 667;
const EXTREME_ASPECT_RATIO = 4;

const getViewportSize = () => {
  if (typeof window === "undefined") {
    return {
      width: DEFAULT_VIEWPORT_WIDTH,
      height: DEFAULT_VIEWPORT_HEIGHT,
    };
  }

  return {
    width: window.innerWidth || DEFAULT_VIEWPORT_WIDTH,
    height: window.innerHeight || DEFAULT_VIEWPORT_HEIGHT,
  };
};

const appendQuery = (url: string, query: string) => {
  if (!url) return "";

  const hashIndex = url.indexOf("#");
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  return `${urlWithoutHash}${urlWithoutHash.includes("?") ? "&" : "?"}${query}${hash}`;
};

export const getImageAttachmentSize = (attachment?: unknown) => {
  const imageAttachment = attachment as { width?: number; height?: number } | undefined;
  return {
    width: Number(imageAttachment?.width) || 0,
    height: Number(imageAttachment?.height) || 0,
  };
};

/**
 * 计算图片在屏幕上的实际显示尺寸（vw 单位），对齐 Android 的图片宽度 clamp 规则：
 * width = clamp(originW_px / screenW * 100, minEdge, maxWidth)，height = width / ratio
 */
const getDisplaySize = (originWidth: number, originHeight: number, mode: ImagePreviewMode) => {
  const minEdge = mode === "compact" ? 111 / 3.75 : 25;
  const maxWidth = mode === "compact" ? 222 / 3.75 : 45;

  if (originWidth > 0 && originHeight > 0) {
    const { width: viewportWidth } = getViewportSize();
    const widthInVw = (originWidth / viewportWidth) * 100;
    const width = Math.min(Math.max(widthInVw, minEdge), maxWidth);
    const height = width / (originWidth / originHeight);
    return { width, height };
  }

  return { width: minEdge, height: minEdge };
};

export const getImageThumbUrl = (url: string, originWidth = 0, originHeight = 0) => {
  if (!url) return "";
  if (/^(blob|data):/i.test(url)) return url;

  const { width: vw, height: vh } = getViewportSize();

  if (originWidth > 0 && originHeight > 0) {
    const { width: displayW, height: displayH } = getDisplaySize(originWidth, originHeight, "chat");
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
    const thumbW = Math.ceil((displayW / 100) * vw * dpr);
    const thumbH = Math.ceil((displayH / 100) * vw * dpr);
    const ratio = originWidth / originHeight;
    const sizeSeparator = ratio > EXTREME_ASPECT_RATIO ? "z" : "x";

    return appendQuery(url, `thumbnail=${thumbW}${sizeSeparator}${thumbH}&imageView`);
  }

  const thumbSize = Math.floor(Math.min(vw, vh) / 2);
  return appendQuery(url, `thumbnail=${thumbSize}x${thumbSize}&imageView`);
};

export const getImageRenderStyle = (
  originWidth = 0,
  originHeight = 0,
  mode: ImagePreviewMode = "chat"
): ImageRenderStyle => {
  const { width, height } = getDisplaySize(originWidth, originHeight, mode);
  const maxHeight = "45vh";
  const aspectRatio = originWidth > 0 && originHeight > 0 ? `${originWidth} / ${originHeight}` : "1 / 1";

  return {
    width: `${width}vw`,
    height: `min(${maxHeight}, ${height}vw)`,
    aspectRatio,
    objectFit: "cover",
  };
};
