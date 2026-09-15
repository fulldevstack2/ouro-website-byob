import { useEffect, useState } from "react";

/**
 * "HH:MM:SS UTC", ticking every second. Starts empty so the pre-rendered HTML
 * matches the first client render (no hydration mismatch), the same as the design's
 * `state.now = ''` before mount.
 */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19) + " UTC");
    tick();
    const t = setInterval(tick, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
