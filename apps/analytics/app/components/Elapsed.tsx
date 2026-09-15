/**
 * A time since, that keeps counting.
 *
 * The masthead read "as of 12 s ago" and then sat there, frozen, until something else re-rendered
 * the route. On a page whose claim is that it is reading a live chain, a stopped clock is the one
 * detail that gives away a static render. This one ticks, and because the monitor is polled every 30
 * seconds it is always counting from a fresh read rather than drifting into hours.
 *
 * It owns its own clock so the second-by-second re-render stays inside these few words, instead of
 * redrawing the table and three charts once a second.
 */
import { ago } from "@ouro/monitor-client";

import { useClock } from "~/lib/motion";

export function Elapsed({
  sinceMs,
  prefix = "",
  suffix = "",
}: {
  /** Unix milliseconds. */
  sinceMs: number;
  prefix?: string;
  suffix?: string;
}) {
  const now = useClock(1000);
  return (
    <>
      {prefix}
      {ago((now - sinceMs) / 1000)}
      {suffix}
    </>
  );
}
