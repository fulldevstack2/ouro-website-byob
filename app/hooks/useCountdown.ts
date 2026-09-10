import { useEffect, useState } from "react";

export interface Countdown {
  d: number;
  h: number;
  m: number;
  s: number;
  passed: boolean;
}

/**
 * Ticks down to `target`. Returns null until mounted so the prerendered HTML and the first
 * client render agree — the same reason useClock starts empty. A baked-in countdown would
 * ship whatever the build machine's clock said and then jump on hydration.
 *
 * Used for one-off scheduled targets (see PayoutCadence), not as a promise that a cycle will fire.
 */
export function useCountdown(target: Date): Countdown | null {
  const [c, setC] = useState<Countdown | null>(null);
  useEffect(() => {
    const tick = () => {
      let ms = target.getTime() - Date.now();
      const passed = ms <= 0;
      if (passed) ms = 0;
      setC({
        d: Math.floor(ms / 86_400_000),
        h: Math.floor(ms / 3_600_000) % 24,
        m: Math.floor(ms / 60_000) % 60,
        s: Math.floor(ms / 1000) % 60,
        passed,
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  return c;
}
