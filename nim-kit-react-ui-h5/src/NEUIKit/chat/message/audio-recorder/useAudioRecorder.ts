import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AudioRecorder } from "./recorder";
import type {
  AudioRecorderError,
  AudioRecorderResult,
  AudioRecorderSnapshot,
} from "./types";

interface UseAudioRecorderOptions {
  onComplete?: (result: AudioRecorderResult) => void;
  onError?: (error: AudioRecorderError) => void;
}

export const useAudioRecorder = ({
  onComplete,
  onError,
}: UseAudioRecorderOptions = {}) => {
  const callbacksRef = useRef({ onComplete, onError });
  callbacksRef.current = { onComplete, onError };

  const recorderRef = useRef<AudioRecorder>();
  if (!recorderRef.current) {
    recorderRef.current = new AudioRecorder({
      onComplete: (result) => callbacksRef.current.onComplete?.(result),
      onError: (error) => callbacksRef.current.onError?.(error),
    });
  }
  const recorder = recorderRef.current;
  const subscribe = useCallback(
    (listener: () => void) => recorder.subscribe(() => listener()),
    [recorder],
  );
  const snapshotCacheRef = useRef<AudioRecorderSnapshot>(recorder.getSnapshot());
  const getSnapshot = useCallback(() => {
    const nextSnapshot = recorder.getSnapshot();
    const previousSnapshot = snapshotCacheRef.current;
    if (
      previousSnapshot.state === nextSnapshot.state &&
      previousSnapshot.durationMs === nextSnapshot.durationMs &&
      previousSnapshot.error === nextSnapshot.error
    ) {
      return previousSnapshot;
    }
    snapshotCacheRef.current = nextSnapshot;
    return nextSnapshot;
  }, [recorder]);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  const disposeTimerRef = useRef<number>();
  useEffect(() => {
    if (disposeTimerRef.current !== undefined) {
      window.clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = undefined;
    }
    return () => {
      // React StrictMode runs effect cleanup/setup once during development.
      // Delay disposal so that the simulated cleanup does not destroy the reused recorder.
      disposeTimerRef.current = window.setTimeout(() => {
        disposeTimerRef.current = undefined;
        void recorder.dispose();
      }, 0);
    };
  }, [recorder]);

  const start = useCallback(() => recorder.start(), [recorder]);
  const stop = useCallback(() => recorder.stop(), [recorder]);
  const cancel = useCallback(() => recorder.cancel(), [recorder]);

  return { snapshot, start, stop, cancel, getSnapshot: () => recorder.getSnapshot() };
};
