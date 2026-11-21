// The owner's "plan this week" ticks, kept per diagnosis in this browser.
// Shared so every AI feature (Ask, insights, briefs) can see what the owner
// has already done — and build on it instead of repeating the same advice.
// Also which of the diagnosis's ready-to-use help they have opened, so the
// diagnosis can point out help they haven't used yet.

function hashOf(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** Stable id for a diagnosis's plan. */
export function planIdFor(workspaceName: string, headline: string): string {
  return hashOf(`${workspaceName}|${headline}`);
}

// Storage keys here keep the old "bizzgrowth-" prefix on purpose: renaming one
// would lose the owner's ticked plan steps.
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

// Same old prefix, same reason as above.
const openedKeyFor = (id: string) => `bizzgrowth-help-opened-v1:${id}`;

/** The diagnosis's ready-to-use help the owner has opened, by help key. */
export function loadHelpOpened(id: string): Record<string, boolean> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(openedKeyFor(id));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function saveHelpOpened(id: string, opened: Record<string, boolean>): void {
  try {
    localStorage.setItem(openedKeyFor(id), JSON.stringify(opened));
  } catch {}
}
