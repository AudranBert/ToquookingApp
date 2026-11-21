import { useCallback, useEffect, useRef, useState } from "react";

export function useStatus() {
  const [status, setStatus] = useState("");
  const [onActivate, setOnActivate] = useState<(() => void) | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    setStatus("");
    setOnActivate(undefined);
  }, []);

  const show = useCallback((message: string, action?: () => void, durationMs?: number) => {
    clearTimeout(timer.current);
    setStatus(message);
    setOnActivate(() => action);
    if (durationMs) timer.current = setTimeout(clear, durationMs);
  }, [clear]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { status, onActivate, setStatus: show, clear };
}

export type StatusApi = ReturnType<typeof useStatus>;
