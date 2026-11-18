"use client";

/**
 * AskResponseCard.tsx — renders whatever buildAskResponse() returns.
 * The four kinds guarantee the Ask page is never blank:
 *   answer | no_data | no_match | error   (+ loading handled by the page)
 *
 * Usage in your Ask page:
 *   const [state, setState] = useState<"idle"|"loading"|"done">("idle");
 *   const [resp, setResp] = useState<AskResponse | null>(null);
 *   async function ask(q: string) {
 *     setState("loading");                 // render ASK_LOADING_TEXT skeleton
 *     const r = await fetch("/api/ask", {…});
 *     const resp = await r.json();         // ALWAYS a structured AskResponse
 *     setResp(resp); setState("done");
 *   }
 */

import type { AskResponse } from "./ask-answer";

export function AskResponseCard({
  response,
  loading,
}: {
  response: AskResponse | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-800" role="status">
        Working through your numbers…
      </div>
    );
  }
  if (!response) return null; // idle — show the prompt row only

  if (response.kind === "no_data") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4">
        <p className="text-sm font-semibold text-amber-900">{response.headline}</p>
        <div className="mt-2 space-y-1.5 text-sm text-amber-900/90">
          {response.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {response.ctas.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={
                c.primary
                  ? "inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700"
                  : "inline-flex items-center rounded-md border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
              }
            >
              {c.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (response.kind === "answer") {
    return (
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold">{response.headline}</p>
        <div className="mt-2 space-y-1.5 text-sm text-slate-700">
          {response.body.map((line) => (
            <p key={line} className="whitespace-pre-line">{line}</p>
          ))}
        </div>
        {response.caveats?.map((c) => (
          <p key={c} className="mt-2 text-xs text-slate-500">{c}</p>
        ))}
        <p className="mt-3 text-xs text-slate-400">Source: {response.sources.join(" · ")}</p>
      </div>
    );
  }

  if (response.kind === "no_match") {
    return (
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold">{response.headline}</p>
        <div className="mt-2 space-y-1.5 text-sm whitespace-pre-line text-slate-700">
          {response.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {response.suggestions.map((s) => (
            <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              {s}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // kind === "error"
  return (
    <div className="rounded-lg border border-red-200 bg-red-50/70 p-4" role="alert">
      <p className="text-sm font-semibold text-red-800">{response.headline}</p>
      <div className="mt-2 space-y-1.5 text-sm text-red-900/90">
        {response.body.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
