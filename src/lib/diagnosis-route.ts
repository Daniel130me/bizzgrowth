// Where the owner's diagnosis lives, and how pages it sends them to find
// their way back.
//
//   #/diagnosis                      the challenge being worked on now (Summary)
//   #/diagnosis/what-to-do           its "What to do" tab (also /summary, /why, /more)
//   #/diagnosis/why/<challengeId>    another diagnosed challenge, viewed
//   #/first-diagnosis[/<tab>]        the first-time reveal right after the checkup
//
// "More worth knowing" holds the owner's insights (beyond the diagnosis) — in
// the owner's workspace it replaces the Insights page. The setup reveal keeps
// to the first three tabs.
//
// The evidence, "add my numbers", "fix an answer" and journey pages go back to
// the diagnosis page — and tab — the owner came from.

export const DIAGNOSIS_TABS = [
  { id: "summary", label: "Summary" },
  { id: "what-to-do", label: "What to do" },
  { id: "why", label: "Why I think this" },
  { id: "more", label: "More worth knowing" },
] as const;

export type DiagnosisTab = (typeof DIAGNOSIS_TABS)[number]["id"];
export type DiagnosisBase = "diagnosis" | "first-diagnosis";

export function asDiagnosisTab(value: string | null | undefined): DiagnosisTab {
  return DIAGNOSIS_TABS.some((t) => t.id === value) ? (value as DiagnosisTab) : "summary";
}

/** The route for a tab (Summary needs no segment) and, on the page, a challenge other than the one in focus. */
export function diagnosisRoute(base: DiagnosisBase, tab: DiagnosisTab, challengeId?: string | null): string {
  if (challengeId && base === "diagnosis") return `${base}/${tab}/${encodeURIComponent(challengeId)}`;
  return tab === "summary" ? base : `${base}/${tab}`;
}

/** The page itself (Summary, the challenge in focus) for any diagnosis route. */
export function diagnosisBaseOf(route: string): DiagnosisBase {
  return route.split("/")[0] === "first-diagnosis" ? "first-diagnosis" : "diagnosis";
}

/** True when both routes are tabs (or challenges) of the same diagnosis page — moving between them keeps the scroll. */
export function sameDiagnosisPage(a: string, b: string): boolean {
  const page = a.split("/")[0];
  return (page === "diagnosis" || page === "first-diagnosis") && page === b.split("/")[0];
}

// Keeps the old "bizzgrowth-" prefix on purpose: renaming a storage key would lose what was saved under it.
const RETURN_KEY = "bizzgrowth-diagnosis-return";
// Starting a checkup begins a new first-time reveal, so an older page is forgotten.
const CHECKUP_START = new Set(["welcome", "create-workspace", "checkup-intro", "onboarding-chat"]);
let lastRoute: string | null = null;

function read(): string | null {
  if (lastRoute) return lastRoute;
  try {
    return typeof window === "undefined" ? null : sessionStorage.getItem(RETURN_KEY);
  } catch {
    return null;
  }
}

function write(route: string | null) {
  lastRoute = route;
  try {
    if (route) sessionStorage.setItem(RETURN_KEY, route);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {}
}

export function rememberDiagnosisRoute(route: string) {
  write(route);
}

/** The diagnosis page (and tab) to go back to — or the fallback when the owner didn't come from one. */
export function diagnosisReturnRoute(fallback: string): string {
  return read() ?? fallback;
}

/** Called for every route shown: in the workspace, the way back is the diagnosis page there, not the setup reveal. */
export function noteRouteForDiagnosis(route: string, layout: string) {
  if (CHECKUP_START.has(route)) {
    if (read()) write(null);
    return;
  }
  const last = read();
  if (layout === "app" && last && diagnosisBaseOf(last) === "first-diagnosis") write(last.replace(/^first-diagnosis/, "diagnosis"));
}
