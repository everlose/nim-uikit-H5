import mp3 from "@audio/encode-mp3";
import type { EncoderWorkerCommand, EncoderWorkerMessage } from "./types";

type StreamEncoder = {
  encode: (channels: Float32Array[]) => Uint8Array;
  flush: () => Uint8Array;
  free: () => void;
};

interface EncoderWorkerScope {
  onmessage: ((event: MessageEvent<EncoderWorkerCommand>) => void) | null;
  postMessage(message: EncoderWorkerMessage, transfer?: Transferable[]): void;
}

declare const self: EncoderWorkerScope;

let encoder: StreamEncoder | null = null;

const send = (message: EncoderWorkerMessage, transfer: Transferable[] = []) => {
  self.postMessage(message, transfer);
};

self.onmessage = async ({ data }: MessageEvent<EncoderWorkerCommand>) => {
  try {
    if (data.type === "init") {
      encoder?.free();
      encoder = await mp3({
        sampleRate: data.sampleRate,
        channels: data.channels,
        bitrate: data.bitrate,
      });
      send({ type: "ready" });
      return;
    }

    if (data.type === "encode") {
      if (!encoder) throw new Error("MP3 encoder is not initialized");
      const result = new Uint8Array(encoder.encode([data.samples]));
      send({ type: "encoded", data: result }, [result.buffer]);
      return;
    }

    if (data.type === "finalize") {
      if (!encoder) throw new Error("MP3 encoder is not initialized");
      const result = new Uint8Array(encoder.flush());
      send({ type: "complete", data: result }, [result.buffer]);
      return;
    }

    encoder?.free();
    encoder = null;
    send({ type: "aborted" });
  } catch (error) {
    send({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
