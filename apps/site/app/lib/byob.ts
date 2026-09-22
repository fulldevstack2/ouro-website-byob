/**
 * BYOB weight helpers — integer percents that always sum to 100.
 * Backend stores bps (×100); the UI works in whole percents for the mock-style controls.
 */

export type PctMap = Record<string, number>; // lowercased address -> 0..100

export function equalPct(addresses: string[]): PctMap {
  const n = addresses.length;
  if (n === 0) return {};
  const base = Math.floor(100 / n);
  const rem = 100 - base * n;
  const out: PctMap = {};
  addresses.forEach((a, i) => {
    out[a.toLowerCase()] = base + (i < rem ? 1 : 0);
  });
  return out;
}

export function pctFromBps(weights: Record<string, number>, addresses: string[]): PctMap {
  const out: PctMap = {};
  for (const a of addresses) {
    const bps = weights[a.toLowerCase()] ?? 0;
    out[a.toLowerCase()] = Math.round(bps / 100);
  }
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  if (sum !== 100 && addresses.length) {
    const first = addresses[0]!.toLowerCase();
    out[first] = (out[first] ?? 0) + (100 - sum);
  }
  return out;
}

export function bpsFromPct(pct: PctMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [a, p] of Object.entries(pct)) out[a] = Math.round(p) * 100;
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  const keys = Object.keys(out);
  if (keys.length && sum !== 10_000) {
    const k = keys[0]!;
    out[k] = (out[k] ?? 0) + (10_000 - sum);
  }
  return out;
}

function fixSum100(out: PctMap, preferred: string): PctMap {
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  if (sum === 100) return out;
  const next = { ...out };
  next[preferred] = (next[preferred] ?? 0) + (100 - sum);
  return next;
}

/**
 * Move one token by `delta` percent. Change is taken from / given to the others evenly
 * (spillover when one hits 0).
 */
export function nudgePct(pct: PctMap, address: string, delta: number, order: string[]): PctMap {
  const key = address.toLowerCase();
  return setPctKeepingSum(pct, key, (pct[key] ?? 0) + delta, order);
}

/**
 * Set one token to `next` percent. Delta is absorbed equally by the others (spillover at 0),
 * instead of proportional renormalize — steadier while dragging / tapping +/−.
 */
export function setPctKeepingSum(pct: PctMap, address: string, next: number, order: string[]): PctMap {
  const keys = order.map((a) => a.toLowerCase());
  const key = address.toLowerCase();
  const others = keys.filter((a) => a !== key);
  if (!keys.includes(key) || others.length === 0) return pct;

  const cur = pct[key] ?? 0;
  const target = Math.max(0, Math.min(100, Math.round(next)));
  const need = target - cur;
  const out: PctMap = { ...pct, [key]: cur };

  if (need > 0) {
    let remaining = need;
    while (remaining > 0) {
      const endowed = others.filter((a) => (out[a] ?? 0) > 0).sort((a, b) => (out[b] ?? 0) - (out[a] ?? 0));
      if (endowed.length === 0) break;
      const base = Math.floor(remaining / endowed.length);
      let rem = remaining - base * endowed.length;
      let taken = 0;
      for (const a of endowed) {
        const want = base + (rem > 0 ? 1 : 0);
        if (rem > 0) rem -= 1;
        const have = out[a] ?? 0;
        const take = Math.min(have, want);
        out[a] = have - take;
        taken += take;
      }
      if (taken === 0) break;
      remaining -= taken;
    }
    out[key] = cur + (need - remaining);
  } else if (need < 0) {
    const give = -need;
    const base = Math.floor(give / others.length);
    let rem = give - base * others.length;
    for (const a of others) {
      const add = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      out[a] = (out[a] ?? 0) + add;
    }
    out[key] = cur - give;
  }

  return fixSum100(out, key);
}

/**
 * Drag the boundary between two adjacent segments. Everything else stays fixed —
 * the easy mental model for a 3-way mix.
 */
export function setBoundary(pct: PctMap, left: string, right: string, leftPct: number, order: string[]): PctMap {
  const L = left.toLowerCase();
  const R = right.toLowerCase();
  const pair = (pct[L] ?? 0) + (pct[R] ?? 0);
  if (pair <= 0) return pct;
  const leftClamped = Math.max(0, Math.min(pair, Math.round(leftPct)));
  const out: PctMap = { ...pct, [L]: leftClamped, [R]: pair - leftClamped };
  const preferred = order.map((a) => a.toLowerCase()).find((a) => a !== L && a !== R) ?? L;
  return fixSum100(out, preferred);
}

const JWT_KEY = "ouro-byob-jwt";

export function readByobJwt(): string | null {
  try {
    return sessionStorage.getItem(JWT_KEY);
  } catch {
    return null;
  }
}

export function writeByobJwt(token: string): void {
  try {
    sessionStorage.setItem(JWT_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearByobJwt(): void {
  try {
    sessionStorage.removeItem(JWT_KEY);
  } catch {
    /* ignore */
  }
}
