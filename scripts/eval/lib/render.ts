// Turns a run's calls.jsonl into readable transcripts plus timing and token
// tables. Pure rendering: it reads what was recorded and never calls anything.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CallRecord } from "./http";
import { readJson, type RunContext } from "./context";

/** USD per million tokens. Free tiers are 0. Paid prices are list prices as noted; check before quoting. */
const PRICES: Record<string, { input: number; output: number; note: string }> = {
  "gpt-5.4-mini": { input: 0.25, output: 2.0, note: "assumed from OpenAI's gpt-5-mini list price; confirm on the OpenAI pricing page" },
  "glm-5.3": { input: 0.07, output: 1.4, note: "OpenRouter list price quoted in the test plan; z.ai's own price may differ" },
};

const FAST = new Set(["checkup-chat", "checkup-extract", "coach-checkin", "challenges-chat", "draft"]);

function readCalls(file: string): CallRecord[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CallRecord);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function cost(c: CallRecord): number {
  let usd = 0;
  for (const g of c.gateway) {
    const p = g.model ? PRICES[g.model] : undefined;
    if (!p || !g.usage) continue;
    usd += (g.usage.promptTokens * p.input + g.usage.completionTokens * p.output) / 1e6;
  }
  return usd;
}

function q(text: string): string {
  return text.replace(/\n/g, "\n> ");
}

function renderCheckup(calls: CallRecord[]): string {
  const chat = calls.filter((c) => c.feature === "checkup-chat");
  const lines = ["# Checkup conversation", ""];
  const first = chat[0]?.request as { transcript?: { role: string; text: string }[] } | undefined;
  if (first?.transcript?.[0]?.role === "ai") lines.push(`**Nellovia:** ${first.transcript[0].text}`, "");
  for (const c of chat) {
    const req = c.request as { transcript: { role: string; text: string }[] };
    const res = c.response as { reply?: string; chips?: string[]; learnedChips?: string[]; phase?: string; read?: string; degraded?: boolean; slots?: { pending?: string } };
    const owner = [...req.transcript].reverse().find((t) => t.role === "user");
    const g = c.gateway[0];
    lines.push(`**Owner:** ${owner?.text ?? ""}`, "");
    lines.push(`**Nellovia:** ${res.reply ?? "(no reply)"}`);
    const meta = [`read: ${res.read ?? "?"}`, `next: ${res.slots?.pending ?? "—"}`, `phase: ${res.phase}`, `${c.ms} ms`, g ? `${g.servedBy} ${g.model}` : "no AI call", `${c.tokens.total} tokens`, res.degraded ? "DEGRADED" : ""].filter(Boolean);
    lines.push(`<sub>${meta.join(" · ")}</sub>`);
    if (res.learnedChips?.length) lines.push(`<sub>Understood as: ${res.learnedChips.join(" | ")}</sub>`);
    if (res.chips?.length) lines.push(`<sub>Tap answers: ${res.chips.map((x) => `[${x}]`).join(" ")}</sub>`);
    lines.push("");
  }
  const extract = calls.find((c) => c.feature === "checkup-extract");
  if (extract) {
    lines.push("## Business facts (extract)", "", `<sub>${extract.ms} ms · ${extract.gateway[0]?.servedBy ?? "no AI"} ${extract.gateway[0]?.model ?? ""} · ${extract.tokens.total} tokens</sub>`, "", "```json", JSON.stringify((extract.response as { facts?: unknown }).facts, null, 2), "```", "");
  }
  return lines.join("\n");
}

function renderJsonFeature(title: string, calls: CallRecord[], pick: (c: CallRecord) => unknown): string {
  const lines = [`# ${title}`, ""];
  for (const c of calls) {
    const g = c.gateway.map((x) => `${x.servedBy ?? "NONE"} ${x.model ?? ""}`).join(" → ") || "no AI call";
    lines.push(`## #${c.seq} ${c.feature} — ${c.ms} ms · ${g} · ${c.tokens.total} tokens`, "");
    lines.push("```json", JSON.stringify(pick(c), null, 2), "```", "");
  }
  return lines.join("\n");
}

function renderAsk(calls: CallRecord[]): string {
  const lines = ["# Ask", ""];
  for (const c of calls) {
    const req = c.request as { question: string };
    const a = (c.response as { answer?: { grounded: string[]; interpretation?: string; limitations?: string[]; evidence?: { label: string; value: string }[]; draft?: { label: string; purpose: string } | null; tryThis?: { title: string; body: string } | null; followUps?: string[]; newChallenge?: { title: string } | null; verified?: boolean } }).answer;
    lines.push(`**Owner:** ${req.question}`, "");
    if (!a) {
      lines.push(`**Nellovia:** (no answer — ${JSON.stringify(c.response)})`, "");
      continue;
    }
    lines.push(`**Nellovia:**`, "", `> ${a.grounded.map(q).join("\n>\n> ")}`, "");
    if (a.interpretation) lines.push(`*What I think is going on:* ${a.interpretation}`, "");
    if (a.tryThis) lines.push(`*Copy box — ${a.tryThis.title}:*`, "", `> ${q(a.tryThis.body)}`, "");
    if (a.limitations?.length) lines.push(`*Not known yet:* ${a.limitations.join(" / ")}`, "");
    if (a.draft) lines.push(`*Button:* ${a.draft.label} — ${a.draft.purpose}`, "");
    if (a.newChallenge) lines.push(`*Offered challenge:* ${a.newChallenge.title}`, "");
    if (a.followUps?.length) lines.push(`*Suggested follow-ups:* ${a.followUps.join(" | ")}`, "");
    lines.push(`<sub>${c.ms} ms · ${c.gateway.map((g) => `${g.servedBy} ${g.model}`).join(" → ")} · ${c.tokens.total} tokens · ${c.gateway.length} AI call(s) · verified ${a.verified !== false}</sub>`, "");
  }
  return lines.join("\n");
}

function renderPlain(calls: CallRecord[]): string {
  const lines = ["# Plain-AI comparison", "", 'System prompt: "You are a helpful business advisor". No Nellovia prompt, context, checks or code.', ""];
  for (const c of calls) {
    const msgs = (c.request as { messages: { role: string; content: string }[] }).messages;
    const user = msgs[msgs.length - 1];
    lines.push(`**Owner:** ${user.content}`, "", `**Plain AI** (${c.gateway[0]?.servedBy} ${c.gateway[0]?.model}, ${c.ms} ms, ${c.tokens.total} tokens):`, "", `> ${q((c.response as { text: string }).text)}`, "");
  }
  return lines.join("\n");
}

function renderChats(title: string, calls: CallRecord[]): string {
  const lines = [`# ${title}`, ""];
  for (const c of calls) {
    const req = c.request as { transcript?: { role: string; text: string }[]; answers?: { question: string; answer: string }[] };
    const res = c.response as { reply?: string; chips?: string[]; why?: string; phase?: string; result?: Record<string, unknown>; state?: { pending?: string } };
    if (req.answers) {
      for (const a of req.answers) lines.push(`**Nellovia:** ${a.question}`, `**Owner:** ${a.answer}`, "");
      lines.push(`**Nellovia:** ${String(res.result?.reply ?? "(no result)")}`, "", "```json", JSON.stringify(res.result, null, 2), "```");
    } else {
      const owner = [...(req.transcript ?? [])].reverse().find((t) => t.role === "user");
      lines.push(`**Owner:** ${owner?.text ?? ""}`, "", `**Nellovia:** ${res.reply ?? JSON.stringify(res)}${res.why ? ` _(why: ${res.why})_` : ""}`);
      if (res.chips?.length) lines.push(`<sub>Tap answers: ${res.chips.map((x) => `[${x}]`).join(" ")}</sub>`);
    }
    lines.push(`<sub>#${c.seq} · ${c.ms} ms · ${c.gateway.map((g) => `${g.servedBy} ${g.model}`).join(" → ") || "no AI call"} · ${c.tokens.total} tokens${res.phase ? ` · phase ${res.phase}` : ""}${res.state?.pending ? ` · next ${res.state.pending}` : ""}</sub>`, "");
  }
  return lines.join("\n");
}

export function renderRun(ctx: RunContext): void {
  const calls = readCalls(ctx.callsPath);
  const dir = path.join(ctx.runDir, "transcripts");
  mkdirSync(dir, { recursive: true });
  const by = (f: string | RegExp) => calls.filter((c) => (typeof f === "string" ? c.feature === f : f.test(c.feature)));
  writeFileSync(path.join(dir, "01-checkup-and-facts.md"), renderCheckup(calls));
  writeFileSync(path.join(dir, "02-diagnosis.md"), renderJsonFeature("Diagnosis", by("diagnosis"), (c) => c.response));
  writeFileSync(path.join(dir, "03-improve.md"), renderJsonFeature("Improve diagnosis", by("improve"), (c) => ({ form: (c.request as { channels: unknown }).channels, response: c.response })));
  writeFileSync(path.join(dir, "04-ask.md"), renderAsk(by("ask")));
  writeFileSync(path.join(dir, "05-draft.md"), renderJsonFeature("Drafts", by(/^draft/), (c) => ({ request: { kind: (c.request as Record<string, unknown>).kind, label: (c.request as Record<string, unknown>).label, purpose: (c.request as Record<string, unknown>).purpose }, response: c.response })));
  writeFileSync(path.join(dir, "06-brief.md"), renderJsonFeature("Brief", by("brief"), (c) => c.response));
  writeFileSync(path.join(dir, "07-insights.md"), renderJsonFeature("Insights", by("insights"), (c) => c.response));
  writeFileSync(path.join(dir, "08-coach-checkin.md"), renderChats("Coach check-in", by("coach-checkin")));
  writeFileSync(path.join(dir, "09-challenges.md"), renderChats("Challenges chat", by(/^challenges-chat$/)) + "\n" + renderJsonFeature("Challenge diagnoses", by("challenge-diagnosis"), (c) => c.response));
  writeFileSync(path.join(dir, "10-specialist-match.md"), renderJsonFeature("Specialist matching", by("specialist-match"), (c) => ({ form: c.request, response: c.response })));
  writeFileSync(path.join(dir, "11-plain-ai.md"), renderPlain(by(/^plain-ai/)));
  writeFileSync(path.join(dir, "12-fallback.md"), renderJsonFeature("Fallback check", by(/^fallback/), (c) => ({ attempts: c.gateway.map((g) => g.attempts), servedBy: c.gateway.map((g) => g.servedBy), ms: c.ms })));
  const probes = by(/^probe/);
  if (probes.length) {
    writeFileSync(
      path.join(dir, "13-stress-probes.md"),
      [
        "# Stress probes (extra, not part of the scored answer key)",
        "",
        renderAsk(by("probe-ask")).replace(/^# Ask/, "## Tempting or tricky questions, each asked in a fresh Ask session"),
        renderJsonFeature("Security and reliability probes", probes.filter((c) => c.feature !== "probe-ask"), (c) => ({ status: c.status, ms: c.ms, attempts: c.gateway.map((g) => g.attempts), response: c.response })),
      ].join("\n"),
    );
  }

  // Timing and tokens, per feature.
  const features = [...new Set(calls.map((c) => c.feature))];
  const rows = features.map((f) => {
    const cs = by(f);
    const aiMs = cs.flatMap((c) => c.gateway.map((g) => g.totalMs));
    const profile = cs[0]?.gateway[0]?.profile ?? "-";
    const limit = profile === "fast" ? 20_000 : profile === "quality" ? 45_000 : null;
    const fallbacks = cs.filter((c) => c.gateway.some((g) => g.attempts.some((a) => !a.ok))).length;
    return {
      feature: f,
      calls: cs.length,
      aiCalls: cs.reduce((a, c) => a + c.gateway.length, 0),
      profile,
      typicalMs: median(cs.map((c) => c.ms)),
      slowestMs: Math.max(0, ...cs.map((c) => c.ms)),
      slowestAiMs: Math.max(0, ...aiMs),
      overLimit: limit ? cs.filter((c) => c.ms > limit).length : 0,
      withFailedAttempts: fallbacks,
      servedBy: [...new Set(cs.flatMap((c) => c.gateway.map((g) => `${g.servedBy ?? "NONE"} ${g.model ?? ""}`.trim())))].join(", "),
      tokens: cs.reduce((a, c) => a + c.tokens.total, 0),
      usd: cs.reduce((a, c) => a + cost(c), 0),
    };
  });
  const total = rows.reduce((a, r) => ({ tokens: a.tokens + r.tokens, usd: a.usd + r.usd }), { tokens: 0, usd: 0 });
  writeFileSync(path.join(ctx.runDir, "timings.json"), JSON.stringify({ rows, total, prices: PRICES }, null, 2));
  const md = [
    "# Timings, providers and tokens",
    "",
    "Times are the whole route call as the owner waits for it (ms). Fast-profile features must stay well under 20 s, quality ones under 45 s.",
    "",
    "| Feature | Calls | AI calls | Profile | Typical | Slowest | Over limit | Calls with failed attempts | Served by | Tokens | Est. USD |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.feature} | ${r.calls} | ${r.aiCalls} | ${r.profile} | ${(r.typicalMs / 1000).toFixed(1)} s | ${(r.slowestMs / 1000).toFixed(1)} s | ${r.overLimit} | ${r.withFailedAttempts} | ${r.servedBy} | ${r.tokens} | ${r.usd.toFixed(4)} |`),
    "",
    `**Total:** ${total.tokens} tokens, about $${total.usd.toFixed(3)} (prices: ${Object.entries(PRICES).map(([m, p]) => `${m} $${p.input}/$${p.output} per M — ${p.note}`).join("; ")}). Free-tier providers count as $0.`,
    "",
    `Fast features: ${[...FAST].join(", ")}.`,
  ].join("\n");
  writeFileSync(path.join(ctx.runDir, "timings.md"), `${md}\n`);
  const notes = readJson<{ notes?: string[] }>(ctx.runnerStatePath, {}).notes ?? [];
  if (notes.length) writeFileSync(path.join(ctx.runDir, "test-setup-notes.md"), `# Test set-up notes\n\n${notes.map((n) => `- ${n}`).join("\n")}\n`);
}
