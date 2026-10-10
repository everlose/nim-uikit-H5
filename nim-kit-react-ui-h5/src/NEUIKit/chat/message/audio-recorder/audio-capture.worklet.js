const PCM_CHUNK_SIZE = 2048;

class YxAudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(PCM_CHUNK_SIZE);
    this.offset = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.type === "flush") {
        this.flush();
        this.port.postMessage({ type: "flushed" });
      }
      if (data?.type === "abort") {
        this.offset = 0;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input?.length) {
      let cursor = 0;
      while (cursor < input.length) {
        const copyLength = Math.min(
          PCM_CHUNK_SIZE - this.offset,
          input.length - cursor,
        );
        this.buffer.set(
          input.subarray(cursor, cursor + copyLength),
          this.offset,
        );
        this.offset += copyLength;
        cursor += copyLength;

        if (this.offset === PCM_CHUNK_SIZE) {
          this.postBuffer();
        }
      }
    }

    outputs[0]?.forEach((channel) => channel.fill(0));
    return true;
  }

  postBuffer() {
    const samples = this.buffer;
    this.buffer = new Float32Array(PCM_CHUNK_SIZE);
    this.offset = 0;
    this.port.postMessage({ type: "pcm", samples }, [samples.buffer]);
  }

  flush() {
    if (this.offset === 0) return;
    const samples = this.buffer.slice(0, this.offset);
    this.buffer = new Float32Array(PCM_CHUNK_SIZE);
    this.offset = 0;
    this.port.postMessage({ type: "pcm", samples }, [samples.buffer]);
  }
}

registerProcessor("yx-audio-capture", YxAudioCaptureProcessor);
