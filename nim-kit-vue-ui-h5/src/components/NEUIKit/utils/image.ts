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

export const getImageThumbUrl = (url: string, originWidth = 0, originHeight = 0) => {
  if (!url) return "";
  if (/^(blob|data):/i.test(url)) return url;

  const { width, height } = getViewportSize();
  const thumbSize = Math.floor(Math.min(width, height) / 2);
  const ratio = originWidth > 0 && originHeight > 0 ? originWidth / originHeight : 0;
  const sizeSeparator = ratio > EXTREME_ASPECT_RATIO ? "z" : "x";

  return appendQuery(url, `thumbnail=${thumbSize}${sizeSeparator}${thumbSize}&imageView`);
};

export const getImageRenderStyle = (
  originWidth = 0,
  originHeight = 0,
  mode: ImagePreviewMode = "chat"
): ImageRenderStyle => {
  const minEdge = mode === "compact" ? 111 / 3.75 : 25;
  const maxWidth = mode === "compact" ? 222 / 3.75 : 45;
  const maxHeight = "45vh";
  const ratio = originWidth > 0 && originHeight > 0 ? originWidth / originHeight : 1;
  const aspectRatio = originWidth > 0 && originHeight > 0 ? `${originWidth} / ${originHeight}` : "1 / 1";

  if (ratio >= 1) {
    const width = Math.min(maxWidth, ratio * minEdge);
    const height = width / ratio;
    return {
      width: `${width}vw`,
      height: `min(${maxHeight}, ${height}vw)`,
      aspectRatio,
      objectFit: "cover",
    };
  }

  const height = minEdge / ratio;

  return {
    width: `${minEdge}vw`,
    height: `min(${maxHeight}, ${height}vw)`,
    aspectRatio,
    objectFit: "cover",
  };
};
