import { CLOUD_CONFIG } from "./config";

/** Poll while the backup screen is open, without overlapping slow requests. */
export function startHealthPolling(check: () => Promise<void>) {
  let stopped = false;
  let inFlight = false;
  const poll = async () => {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      await check();
    } finally {
      inFlight = false;
    }
  };
  void poll();
  const timer = setInterval(() => {
    void poll();
  }, CLOUD_CONFIG.healthIntervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
