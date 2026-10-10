import { onUnmounted, ref } from "vue";
import { AudioRecorder } from "./recorder";
import type { AudioRecorderError, AudioRecorderResult } from "./types";

export const useAudioRecorder = (
  onComplete?: (result: AudioRecorderResult) => void,
  onError?: (error: AudioRecorderError) => void,
) => {
  const recorder = new AudioRecorder({ onComplete, onError });
  const snapshot = ref(recorder.getSnapshot());
  const unsubscribe = recorder.subscribe((nextSnapshot) => {
    snapshot.value = nextSnapshot;
  });

  onUnmounted(() => {
    unsubscribe();
    void recorder.dispose();
  });

  return {
    recorder,
    snapshot,
    start: () => recorder.start(),
    stop: () => recorder.stop(),
    cancel: () => recorder.cancel(),
  };
};
