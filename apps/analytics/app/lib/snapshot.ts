/**
 * The last figures this browser read, painted before the network answers.
 *
 * ── Why ──
 * This page is prerendered to static HTML and fetches everything after hydration: five monitor
 * requests plus three DexScreener calls, against an indexer that sleeps on a free dyno and can take
 * several seconds to wake. Until they land there is nothing on screen but labels, which on a page
 * whose entire job is to show numbers is the worst possible first impression — and it is also
 * dishonest-looking, because the page's own convention is that an empty cell means "we did not
 * measure this".
 *
 * So the composed figures are kept in localStorage and painted immediately on the next visit, with
 * the status pill saying "Cached" and how old they are until live data replaces them. Nothing is
 * ever presented as live when it is not.
 *
 * ── Why the composed rows rather than the raw responses ──
 * The raw responses are 1.1 MB (INDEX's cycle page alone is 790 KB) and re-storing them every poll
 * would be both slow and close to the storage quota. The composed rows plus the chart series are
 * about 25 KB, which is the whole of what the page actually paints.
 *
 * ── Why it is read in an effect, not during render ──
 * The route is prerendered, so the first client render has to match HTML that was built with no
 * figures in it. Seeding from storage during render would trip a hydration mismatch; seeding in an
 * effect costs one frame and is still instant to the eye.
 */
import { useEffect, useRef, useState } from "react";

import type { ProjectsState, ProjectRow } from "~/lib/projects";
import type { Series, SeriesState } from "~/lib/series";
import { byKey } from "~/registry";

/** Bumped whenever `ProjectRow` changes shape, so an old snapshot is dropped rather than read. */
const VERSION = "2026-09-18";
const KEY = `airdrop-meta:${VERSION}`;

/** Older than this and it is not worth painting: the reader would be looking at yesterday. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** No more than one write a minute. The figures move slower than the poll does. */
const WRITE_EVERY_MS = 60_000;

/** `project` is dropped on the way out and resolved from the registry on the way back in, so a
 *  snapshot can never resurrect a coverage note that the deployed code no longer stands behind. */
type StoredRow = Omit<ProjectRow, "project"> & { key: string };

interface Stored {
  at: number;
  generatedAt: number | null;
  rows: StoredRow[];
  paid: Series[];
  tax: Series[];
  recipients: Series[];
  gaps: Series[];
}

function read(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.at !== "number" || Date.now() - s.at > MAX_AGE_MS) return null;
    if (!Array.isArray(s.rows)) return null;
    return s;
  } catch {
    // Private windows, cleared site data, a half-written value: none of them are worth an error.
    return null;
  }
}

function write(s: Stored): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota or blocked storage: the page works without it */
  }
}

export type PaintSource = "live" | "cache" | "empty";

export interface Painted {
  rows: ProjectRow[];
  paid: Series[];
  tax: Series[];
  recipients: Series[];
  gaps: Series[];
  generatedAt: number | null;
  /** What is on screen right now. The status pill says this out loud. */
  source: PaintSource;
  /** When the cached copy was taken, if that is what is showing. */
  cachedAt: number | null;
  /** True once the chart series have arrived, live or cached. */
  hasSeries: boolean;
}

/**
 * Live figures when they exist, the last good ones when they do not.
 *
 * "Live has landed" is `generatedAt !== null`: it is set from the summary the rows are built out of,
 * so it cannot be true while the rows are still empty. A monitor that never answers leaves it null
 * and the cached copy stays up, labelled, which is the behaviour an outage should have.
 */
export function usePainted(live: ProjectsState, series: SeriesState): Painted {
  const [cache, setCache] = useState<Stored | null>(null);
  const lastWrite = useRef(0);

  useEffect(() => {
    setCache(read());
  }, []);

  const isLive = live.generatedAt !== null;

  useEffect(() => {
    if (!isLive || series.loading) return;
    const now = Date.now();
    if (now - lastWrite.current < WRITE_EVERY_MS) return;
    lastWrite.current = now;
    write({
      at: now,
      generatedAt: live.generatedAt,
      rows: live.rows.map(({ project, ...rest }) => ({ ...rest, key: project.key })),
      paid: series.paid,
      tax: series.tax,
      recipients: series.recipients,
      gaps: series.gaps,
    });
  }, [isLive, live.generatedAt, live.rows, series]);

  if (isLive) {
    return {
      rows: live.rows,
      paid: series.paid,
      tax: series.tax,
      recipients: series.recipients,
      gaps: series.gaps,
      generatedAt: live.generatedAt,
      source: "live",
      cachedAt: null,
      hasSeries: !series.loading,
    };
  }

  /**
   * A finished fetch that returned nothing is not better than the cache.
   *
   * `useSeries` clears its loading flag whether or not the requests succeeded, so an unreachable
   * indexer produces three empty series and a `loading: false` that would otherwise beat the stored
   * history. The charts then read "not enough history to plot" on a page that is showing a full set
   * of cached figures above them.
   */
  const pick = (live: Series[], stored: Series[]) => (live.some((s) => s.points.length > 0) ? live : stored);

  if (cache) {
    const rows = cache.rows
      .map(({ key, ...rest }) => {
        const project = byKey(key);
        return project ? ({ ...rest, project } as ProjectRow) : null;
      })
      .filter((r): r is ProjectRow => r !== null);
    // Only paint the cache if it still covers the registry. A project added since the snapshot was
    // taken would otherwise vanish from a page that says how many it tracks.
    if (rows.length) {
      return {
        rows,
        paid: pick(series.paid, cache.paid),
        tax: pick(series.tax, cache.tax),
        recipients: pick(series.recipients, cache.recipients),
        gaps: pick(series.gaps, cache.gaps),
        generatedAt: cache.generatedAt,
        source: "cache",
        cachedAt: cache.at,
        hasSeries: true,
      };
    }
  }

  return {
    rows: live.rows,
    paid: series.paid,
    tax: series.tax,
    recipients: series.recipients,
    gaps: series.gaps,
    generatedAt: null,
    source: "empty",
    cachedAt: null,
    hasSeries: !series.loading,
  };
}
