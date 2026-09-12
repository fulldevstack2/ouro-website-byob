/**
 * The monitor's origin, inlined at BUILD time by each app's vite.config.ts `define`.
 *
 * It lives in the consuming app, not here, because a package cannot define it — and because the two
 * apps may legitimately point at different origins (a dev server against a local monitor while the
 * site builds against the live one). An app that consumes this package MUST define
 * `__MONITOR_API__`, or every figure it renders is the "not configured" state.
 */
declare const __MONITOR_API__: string;
