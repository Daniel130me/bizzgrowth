// The owner's "plan this week" ticks, kept per diagnosis in this browser.
// Shared so every AI feature (Ask, insights, briefs) can see what the owner
// has already done — and build on it instead of repeating the same advice.

function hashOf(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** Stable id for a diagnosis's plan. */
export function planIdFor(workspaceName: string, headline: string): string {
  return hashOf(`${workspaceName}|${headline}`);
}

const keyFor = (id: string) => `bizzgrowth-plan-v1:${id}`;

export function loadPlanProgress(id: string): Record<number, boolean> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(keyFor(id));
    return raw ? (JSON.parse(raw) as Record<number, boolean>) : {};
  } catch {
    return {};
  }
}

export function savePlanProgress(id: string, done: Record<number, boolean>): void {
  try {
    localStorage.setItem(keyFor(id), JSON.stringify(done));
  } catch {}
}
