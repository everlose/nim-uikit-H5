export type AudioRecorderState =
  | "idle"
  | "checking"
  | "requesting-permission"
  | "recording"
  | "encoding"
  | "unsupported"
  | "error";

export type AudioRecorderErrorKind =
  | "unsupported"
  | "permission"
  | "too_short"
  | "recording"
  | "encoding"
  | "cancelled";

export interface AudioRecorderResult {
  file: File;
  durationMs: number;
}

export interface AudioRecorderSnapshot {
  state: AudioRecorderState;
  durationMs: number;
  error?: AudioRecorderError;
}

export interface AudioRecorderErrorOptions {
  kind: AudioRecorderErrorKind;
  cause?: unknown;
}

export class AudioRecorderError extends Error {
  readonly kind: AudioRecorderErrorKind;
  readonly cause?: unknown;

  constructor(message: string, options: AudioRecorderErrorOptions) {
    super(message);
    this.name = "AudioRecorderError";
    this.kind = options.kind;
    this.cause = options.cause;
  }
}

export type CaptureWorkletMessage =
  { type: "pcm"; samples: Float32Array } | { type: "flushed" };

export type CaptureWorkletCommand = { type: "flush" } | { type: "abort" };

export type EncoderWorkerCommand =
  | { type: "init"; sampleRate: number; channels: 1; bitrate: 128 }
  | { type: "encode"; samples: Float32Array }
  | { type: "finalize" }
  | { type: "abort" };

export type EncoderWorkerMessage =
  | { type: "ready" }
  | { type: "encoded"; data: Uint8Array }
  | { type: "complete"; data: Uint8Array }
  | { type: "aborted" }
  | { type: "error"; message: string };
