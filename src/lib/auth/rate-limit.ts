// Server-only: failed-login limiter.

// In-memory failed-login limiter, keyed by IP and by email. It covers unknown
// emails too (which have no User row to lock), so the response is the same for
// every email. The per-user lock in the DB (User.lockedUntil) backs it up across
// restarts and instances.

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;

type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __bizzLoginFails?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__bizzLoginFails ??= new Map());

function bucket(key: string, now: number): Bucket {
  const b = buckets.get(key);
  if (b && b.resetAt > now) return b;
  const fresh = { count: 0, resetAt: now + WINDOW_MS };
  buckets.set(key, fresh);
  return fresh;
}

/** Seconds until the caller may try again, or 0 if allowed. */
export function loginBlockedFor(ip: string, email: string): number {
  const now = Date.now();
  const e = bucket(`e:${email}`, now);
  const i = bucket(`i:${ip}`, now);
  const blocked: number[] = [];
  if (e.count >= MAX_FAILS_PER_EMAIL) blocked.push(e.resetAt);
  if (i.count >= MAX_FAILS_PER_IP) blocked.push(i.resetAt);
  if (!blocked.length) return 0;
  return Math.ceil((Math.max(...blocked) - now) / 1000);
}

export function recordLoginFailure(ip: string, email: string): void {
  const now = Date.now();
  bucket(`e:${email}`, now).count++;
  bucket(`i:${ip}`, now).count++;
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
}

export function clearLoginFailures(email: string): void {
  buckets.delete(`e:${email}`);
}

/** Small delay on every failure so scripted guessing is slow even under the limit. */
export function failureDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 400 + Math.floor(Math.random() * 300)));
}
