import type {
  AudioRecorderErrorKind,
  AudioRecorderResult,
  AudioRecorderSnapshot,
  AudioRecorderState,
  CaptureWorkletCommand,
  CaptureWorkletMessage,
  EncoderWorkerCommand,
  EncoderWorkerMessage,
} from "./types";
import { AudioRecorderError } from "./types";

export const AUDIO_MIN_DURATION_MS = 1000;
export const AUDIO_MAX_DURATION_MS = 60_000;

type SnapshotListener = (snapshot: AudioRecorderSnapshot) => void;
type RecorderCallbacks = {
  onComplete?: (result: AudioRecorderResult) => void;
  onError?: (error: AudioRecorderError) => void;
};

type WorkerWaiter = {
  match: (message: EncoderWorkerMessage) => boolean;
  resolve: (message: EncoderWorkerMessage) => void;
  reject: (error: Error) => void;
  timer: number;
};

const getAudioContextConstructor = () => {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
};

const isLocalHost = () => {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
};

const createError = (
  message: string,
  kind: AudioRecorderErrorKind,
  cause?: unknown,
) => new AudioRecorderError(message, { kind, cause });

export class AudioRecorder {
  private state: AudioRecorderState = "idle";
  private durationMs = 0;
  private error?: AudioRecorderError;
  private readonly listeners = new Set<SnapshotListener>();
  private callbacks: RecorderCallbacks = {};
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private worker: Worker | null = null;
  private workerWaiters = new Set<WorkerWaiter>();
  private outputChunks: Uint8Array[] = [];
  private pcmSamples = 0;
  private recordingStartedAt = 0;
  private durationTimer?: number;
  private maxDurationTimer?: number;
  private cancelRequested = false;
  private prepared = false;
  private disposed = false;
  private operationGeneration = 0;
  private captureFlushReject: ((error: Error) => void) | null = null;
  private resourceGeneration: number | null = null;

  constructor(callbacks: RecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  getSnapshot(): AudioRecorderSnapshot {
    return {
      state: this.state,
      durationMs: this.durationMs,
      error: this.error,
    };
  }

  subscribe(listener: SnapshotListener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  setCallbacks(callbacks: RecorderCallbacks) {
    this.callbacks = callbacks;
  }

  async start() {
    if (this.disposed) return;
    if (
      this.state !== "idle" &&
      this.state !== "unsupported" &&
      this.state !== "error"
    )
      return;
    const operationGeneration = ++this.operationGeneration;
    this.cancelRequested = false;
    const prepared = await this.prepare(operationGeneration);

    if (!prepared || !this.isOperationActive(operationGeneration)) return;

    this.setState("requesting-permission");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.bindStreamInterruptionHandlers(this.stream);
    } catch (error) {
      if (!this.isOperationActive(operationGeneration)) {
        this.stopStream();
        return;
      }
      this.resetToIdle();
      throw createError(
        "Microphone permission was not granted",
        "permission",
        error,
      );
    }

    if (!this.isOperationActive(operationGeneration)) {
      this.stopStream();
      return;
    }

    try {
      await this.context?.resume();
      if (!this.isOperationActive(operationGeneration)) return;
      if (!(await this.initEncoder(operationGeneration))) return;
      this.createCaptureGraph(operationGeneration);
      this.outputChunks = [];
      this.pcmSamples = 0;
      this.durationMs = 0;
      this.recordingStartedAt = performance.now();
      this.setState("recording");
      this.durationTimer = window.setInterval(() => {
        this.durationMs = performance.now() - this.recordingStartedAt;
        this.emit();
      }, 200);
      this.maxDurationTimer = window.setTimeout(() => {
        void this.stop()
          .then((result) => {
            if (result && this.isOperationActive(operationGeneration)) {
              this.callbacks.onComplete?.(result);
            }
          })
          .catch((error) => {
            if (this.isOperationActive(operationGeneration)) {
              this.reportError(error);
            }
          });
      }, AUDIO_MAX_DURATION_MS);
    } catch (error) {
      this.cleanupCapture();
      if (!this.isOperationActive(operationGeneration)) return;
      const recorderError =
        error instanceof AudioRecorderError
          ? error
          : createError(
              "Audio recording could not be started",
              "recording",
              error,
            );
      this.setState("error", recorderError);
      this.callbacks.onError?.(recorderError);
      throw recorderError;
    }
  }

  async stop(): Promise<AudioRecorderResult | null> {
    if (this.state !== "recording") return null;
    const operationGeneration = this.operationGeneration;
    this.clearTimers();
    this.setState("encoding");

    try {
      await this.flushCapture(operationGeneration);
      if (!this.isOperationActive(operationGeneration)) return null;
      const complete = await this.requestWorker(
        { type: "finalize" },
        (message) => message.type === "complete",
      );
      if (!this.isOperationActive(operationGeneration)) return null;
      if (complete.type !== "complete")
        throw new Error("MP3 encoder did not finalize");
      if (complete.data.length) this.outputChunks.push(complete.data);

      const durationMs = Math.round(
        (this.pcmSamples / (this.context?.sampleRate || 1)) * 1000,
      );
      const chunks = this.outputChunks;
      this.cleanupCapture();
      this.resetToIdle();

      if (durationMs < AUDIO_MIN_DURATION_MS) {
        throw createError("Audio recording is too short", "too_short");
      }

      const file = new File(chunks as BlobPart[], `recording-${Date.now()}.mp3`, {
        type: "audio/mpeg",
      });
      return { file, durationMs };
    } catch (error) {
      this.cleanupCapture();
      if (!this.isOperationActive(operationGeneration)) return null;
      const recorderError =
        error instanceof AudioRecorderError
          ? error
          : createError("Audio encoding failed", "encoding", error);
      this.setState(
        recorderError.kind === "too_short" ? "idle" : "error",
        recorderError,
      );
      if (recorderError.kind !== "too_short")
        this.callbacks.onError?.(recorderError);
      throw recorderError;
    }
  }

  async cancel() {
    if (this.disposed) return;
    this.cancelRequested = true;
    this.operationGeneration += 1;
    this.clearTimers();
    this.rejectPendingOperations(new Error("Audio recorder operation canceled"));
    if (this.captureNode) this.postCapture({ type: "abort" });
    this.cleanupCapture();
    this.outputChunks = [];
    this.pcmSamples = 0;
    this.resetToIdle();
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelRequested = true;
    this.operationGeneration += 1;
    this.clearTimers();
    this.rejectPendingOperations(new Error("Audio recorder disposed"));
    this.cleanupCapture();
    this.worker?.terminate();
    this.worker = null;
    await this.context?.close().catch(() => undefined);
    this.context = null;
    this.prepared = false;
    this.callbacks = {};
    this.listeners.clear();
  }

  private async prepare(operationGeneration: number): Promise<boolean> {
    if (!this.isOperationActive(operationGeneration)) return false;
    this.setState("checking");
    const unsupportedReason = this.getUnsupportedReason();
    if (unsupportedReason) {
      const error = createError(unsupportedReason, "unsupported");
      this.setState("unsupported", error);
      throw error;
    }
    if (this.prepared && this.context && this.worker) {
      this.setState("idle");
      return true;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor)
      throw createError("AudioContext is not supported", "unsupported");

    try {
      if (!this.prepared && (this.context || this.worker)) {
        await this.disposePreparedResources(this.resourceGeneration ?? undefined);
        if (!this.isOperationActive(operationGeneration)) return false;
      }
      this.context = new AudioContextConstructor();
      this.resourceGeneration = operationGeneration;
      await this.context.audioWorklet.addModule(
        new URL("./audio-capture.worklet.js", import.meta.url).href,
      );
      if (!this.isOperationActive(operationGeneration)) {
        await this.disposePreparedResources(operationGeneration);
        return false;
      }
      this.worker = new Worker(
        new URL("./audio-encoder.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = this.handleWorkerMessage;
      this.worker.onerror = (event) =>
        this.reportError(
          createError(
            event.message || "Encoder worker failed",
            "encoding",
            event,
          ),
        );
      if (!(await this.initEncoder(operationGeneration))) {
        await this.disposePreparedResources(operationGeneration);
        return false;
      }
      const probeSamples = new Float32Array(1152);
      this.worker.postMessage({ type: "encode", samples: probeSamples }, [
        probeSamples.buffer,
      ]);
      await this.requestWorker(
        { type: "finalize" },
        (message) => message.type === "complete",
      );
      if (!this.isOperationActive(operationGeneration)) {
        await this.disposePreparedResources(operationGeneration);
        return false;
      }
      if (!(await this.initEncoder(operationGeneration))) {
        await this.disposePreparedResources(operationGeneration);
        return false;
      }
      this.outputChunks = [];
      this.prepared = true;
      this.setState("idle");
      return true;
    } catch (error) {
      await this.disposePreparedResources(operationGeneration);
      if (!this.isOperationActive(operationGeneration)) return false;
      const recorderError =
        error instanceof AudioRecorderError && error.kind === "unsupported"
          ? error
          : createError(
              "Required audio resources are unavailable",
              "unsupported",
              error,
            );
      this.setState("unsupported", recorderError);
      throw recorderError;
    }
  }

  private getUnsupportedReason() {
    if (typeof window === "undefined" || typeof navigator === "undefined")
      return "Browser audio APIs are unavailable";
    if (!window.isSecureContext && !isLocalHost())
      return "Microphone access requires a secure context";
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    )
      return "Microphone capture is unavailable";
    if (!getAudioContextConstructor()) return "AudioContext is unavailable";
    if (typeof AudioWorkletNode === "undefined")
      return "AudioWorklet is unavailable";
    if (typeof Worker === "undefined") return "Worker is unavailable";
    if (typeof WebAssembly === "undefined") return "WebAssembly is unavailable";
    return undefined;
  }

  private async initEncoder(operationGeneration: number) {
    if (!this.isOperationActive(operationGeneration)) return false;
    if (!this.worker || !this.context)
      throw createError("Encoder worker is unavailable", "unsupported");
    await this.requestWorker(
      {
        type: "init",
        sampleRate: this.context.sampleRate,
        channels: 1,
        bitrate: 128,
      },
      (message) => message.type === "ready",
    );
    return this.isOperationActive(operationGeneration);
  }

  private createCaptureGraph(operationGeneration: number) {
    if (!this.context || !this.stream)
      throw new Error("Audio capture is not ready");
    this.source = this.context.createMediaStreamSource(this.stream);
    this.captureNode = new AudioWorkletNode(this.context, "yx-audio-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    this.captureNode.port.onmessage = (event) =>
      this.handleCaptureMessage(event, operationGeneration);
    this.silentGain = this.context.createGain();
    this.silentGain.gain.value = 0;
    this.source.connect(this.captureNode);
    this.captureNode.connect(this.silentGain);
    this.silentGain.connect(this.context.destination);
  }

  private readonly handleCaptureMessage = (
    { data }: MessageEvent<CaptureWorkletMessage>,
    operationGeneration: number,
  ) => {
    if (data.type === "pcm" && this.isOperationActive(operationGeneration)) {
      this.pcmSamples += data.samples.length;
      try {
        this.worker?.postMessage({ type: "encode", samples: data.samples }, [
          data.samples.buffer,
        ]);
      } catch (error) {
        this.reportError(createError("PCM encoding failed", "encoding", error));
      }
    }
  };

  private async flushCapture(operationGeneration: number) {
    const captureNode = this.captureNode;
    if (!captureNode || !this.isOperationActive(operationGeneration)) return;
    const flushed = new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(
        () => {
          settled = true;
          this.captureFlushReject = null;
          captureNode.port.removeEventListener("message", listener);
          reject(new Error("Audio capture flush timed out"));
        },
        3000,
      );
      const listener = ({ data }: MessageEvent<CaptureWorkletMessage>) => {
        if (data.type !== "flushed") return;
        settled = true;
        window.clearTimeout(timeout);
        this.captureFlushReject = null;
        captureNode.port.removeEventListener("message", listener);
        resolve();
      };
      this.captureFlushReject = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.captureFlushReject = null;
        captureNode.port.removeEventListener("message", listener);
        reject(error);
      };
      captureNode.port.addEventListener("message", listener);
    });
    this.postCapture({ type: "flush" });
    await flushed;
  }

  private postCapture(command: CaptureWorkletCommand) {
    this.captureNode?.port.postMessage(command);
  }

  private requestWorker(
    command: EncoderWorkerCommand,
    match: (message: EncoderWorkerMessage) => boolean,
  ) {
    if (!this.worker)
      return Promise.reject(new Error("Encoder worker is unavailable"));
    return new Promise<EncoderWorkerMessage>((resolve, reject) => {
      const waiter = {} as WorkerWaiter;
      waiter.timer = window.setTimeout(() => {
        this.workerWaiters.delete(waiter);
        reject(new Error("Encoder worker response timed out"));
      }, 5000);
      waiter.match = match;
      waiter.resolve = resolve;
      waiter.reject = reject;
      this.workerWaiters.add(waiter);
      const transfer =
        command.type === "encode" ? [command.samples.buffer] : [];
      this.worker?.postMessage(command, transfer);
    });
  }

  private readonly handleWorkerMessage = ({
    data,
  }: MessageEvent<EncoderWorkerMessage>) => {
    if (this.disposed) return;
    if (data.type === "encoded") {
      if (this.state === "recording" || this.state === "encoding")
        this.outputChunks.push(data.data);
    }
    if (data.type === "error")
      this.reportError(createError(data.message, "encoding"));
    const waiter = Array.from(this.workerWaiters).find((candidate) =>
      candidate.match(data),
    );
    if (waiter) {
      this.workerWaiters.delete(waiter);
      window.clearTimeout(waiter.timer);
      waiter.resolve(data);
    }
  };

  private reportError(error: AudioRecorderError) {
    if (this.disposed) return;
    this.error = error;
    this.setState(
      error.kind === "unsupported" ? "unsupported" : "error",
      error,
    );
    this.callbacks.onError?.(error);
  }

  private cleanupCapture() {
    this.clearTimers();
    this.rejectCaptureFlush(new Error("Audio capture canceled"));
    this.captureNode?.port.close();
    this.silentGain?.disconnect();
    this.captureNode?.disconnect();
    this.source?.disconnect();
    this.captureNode = null;
    this.silentGain = null;
    this.source = null;
    this.stopStream();
  }

  private stopStream() {
    const stream = this.stream;
    this.stream = null;
    if (!stream) return;
    this.unbindStreamInterruptionHandlers(stream);
    stream.getTracks().forEach((track) => track.stop());
  }

  private readonly handleStreamInterrupted = () => {
    if (this.disposed || this.cancelRequested || !this.stream) return;
    void this.cancel();
  };

  private bindStreamInterruptionHandlers(stream: MediaStream) {
    stream.addEventListener("inactive", this.handleStreamInterrupted);
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener("mute", this.handleStreamInterrupted);
      track.addEventListener("ended", this.handleStreamInterrupted);
    });
  }

  private unbindStreamInterruptionHandlers(stream: MediaStream) {
    stream.removeEventListener("inactive", this.handleStreamInterrupted);
    stream.getAudioTracks().forEach((track) => {
      track.removeEventListener("mute", this.handleStreamInterrupted);
      track.removeEventListener("ended", this.handleStreamInterrupted);
    });
  }

  private async disposePreparedResources(resourceGeneration?: number) {
    if (
      resourceGeneration !== undefined &&
      this.resourceGeneration !== null &&
      resourceGeneration !== this.resourceGeneration
    ) {
      return;
    }
    this.cleanupCapture();
    this.worker?.terminate();
    this.worker = null;
    await this.context?.close().catch(() => undefined);
    this.context = null;
    this.prepared = false;
    this.resourceGeneration = null;
  }

  private clearTimers() {
    if (this.durationTimer) window.clearInterval(this.durationTimer);
    if (this.maxDurationTimer) window.clearTimeout(this.maxDurationTimer);
    this.durationTimer = undefined;
    this.maxDurationTimer = undefined;
  }

  private resetToIdle() {
    this.durationMs = 0;
    this.error = undefined;
    this.setState("idle");
  }

  private setState(state: AudioRecorderState, error?: AudioRecorderError) {
    this.state = state;
    this.error = error;
    this.emit();
  }

  private emit() {
    if (this.disposed) return;
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private isOperationActive(operationGeneration: number) {
    return (
      !this.disposed && operationGeneration === this.operationGeneration
    );
  }

  private rejectCaptureFlush(error: Error) {
    this.captureFlushReject?.(error);
    this.captureFlushReject = null;
  }

  private rejectPendingOperations(error: Error) {
    this.rejectCaptureFlush(error);
    this.workerWaiters.forEach((waiter) => {
      window.clearTimeout(waiter.timer);
      waiter.reject(error);
    });
    this.workerWaiters.clear();
  }
}
