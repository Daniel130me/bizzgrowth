/**
 * ask-answer.ts — guaranteed-response logic for the Ask page.
 *
 * THE BUG THIS FIXES: with zero recorded data, the ask handler returned an
 * empty response and the UI rendered nothing at all (user typed
 * "where are we in the business right now?" and got silence).
 *
 * CONTRACT: buildAskResponse ALWAYS returns a non-empty structured response.
 * The UI must render one of the four kinds; it must never render `""`.
 * Wire this into your ask API route AND render the returned kind directly.
 */

export type MonthRecord = {
  label: string; // "October 2026"
  revenue: number | null;
  marketing: number | null;
};

export type WorkspaceData = {
  workspaceName: string;
  hasAnyRecords: boolean;
  records?: MonthRecord[];
};

export type AskResponse =
  | {
      kind: "answer";
      headline: string;
      body: string[];
      /** e.g. ["Data Centre · October 2026"] */
      sources: string[];
      caveats?: string[];
    }
  | {
      kind: "no_data";
      headline: string;
      body: string[];
      ctas: { label: string; href: string; primary?: boolean }[];
    }
  | {
      kind: "no_match";
      headline: string;
      body: string[];
      suggestions: string[];
    }
  | {
      kind: "error";
      headline: string;
      body: string[];
    };

/** Rendered while the request is in flight — never leave the page silent. */
export const ASK_LOADING_TEXT = "Working through your numbers…";

export function buildAskResponse(
  query: string,
  data: WorkspaceData,
  /** Your real answer computation (reads the DB). May throw. */
  compute?: (query: string, data: WorkspaceData) => { headline: string; body: string[]; sources: string[]; caveats?: string[] } | null,
): AskResponse {
  const q = (query || "").trim();

  if (!q) {
    return {
      kind: "error",
      headline: "Type a question first",
      body: ["Ask something like “how did October go?” or “what's my marketing share?”."],
    };
  }

  // --- the empty-workspace case: answer with a plan, never with silence ---
  if (!data.hasAnyRecords) {
    return {
      kind: "no_data",
      headline: `I can't answer that yet — no numbers are recorded for ${data.workspaceName}.`,
      body: [
        `You asked: “${q}”. To answer questions like this I need at least one month of numbers: which month, roughly what came in (revenue), and roughly what you spent on getting customers (marketing).`,
        "Two quick ways to fix that — pick whichever feels easier:",
      ],
      ctas: [
        { label: "Enter your first month in the Data Centre", href: "/data-centre", primary: true },
        { label: "Chat with the intelligence — it asks, you answer", href: "/chat" },
      ],
    };
  }

  // --- workspace has data: compute, and fail loudly (with a message) ---
  try {
    const computed = compute?.(q, data);
    if (computed) {
      return { kind: "answer", ...computed };
    }
  } catch {
    return {
      kind: "error",
      headline: "Something went wrong working out that answer",
      body: ["Your numbers are safe — please try again."],
    };
  }

  // Data exists but nothing matched the question: show what we DO have.
  const months = (data.records ?? [])
    .map((r) => `• ${r.label}: revenue ${r.revenue === null ? "—" : "₦" + r.revenue.toLocaleString("en-US")}, marketing ${r.marketing === null ? "—" : "₦" + r.marketing.toLocaleString("en-US")}`)
    .join("\n");
  return {
    kind: "no_match",
    headline: "I don't have a number that answers that directly.",
    body: [
      `Here is everything recorded for ${data.workspaceName} so far:`,
      months || "(no month details stored)",
      "Try asking about a recorded month — or record another month to widen what I can answer.",
    ],
    suggestions: (data.records ?? []).slice(0, 3).map((r) => `How did ${r.label} go?`),
  };
}
