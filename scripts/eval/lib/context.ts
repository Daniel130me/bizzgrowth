// Paths, options and case loading for the AI quality test runner.
// See scripts/eval/README.md for how a run works.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const EVAL_DIR = path.join(APP_ROOT, "scripts", "eval");

/** The parts of a case the runner uses directly. The owner's live answers are typed by the operator. */
export interface EvalCase {
  id: string;
  title: string;
  workspace: { name: string; country: string; currency: string; website?: string };
  /** The test account's display name. */
  ownerName: string;
  /** What the owner types first in the checkup. */
  openingLine: string;
  /** Asked in Ask after the diagnosis, in this order. */
  followUps: string[];
  /** The plain-AI comparison's single message: the opening line plus the facts the owner gives when asked. */
  plainAiMessage: string;
  /** What the owner would put in the marketplace task form. */
  specialistTask: { title: string; description: string; category: string; skills: string[]; budgetMin?: number; budgetMax?: number };
  /** Every figure the owner can ever give (said or revealed), for the independent number audit. */
  ownerNumbers: string;
}

export interface RunContext {
  caseId: string;
  run: string;
  date: string;
  baseUrl: string;
  evalCase: EvalCase;
  caseDir: string;
  runDir: string;
  callsPath: string;
  tracePath: string;
  usagePath: string;
  faultsPath: string;
  statePath: string;
  runnerStatePath: string;
  credentialsPath: string;
  sessionPath: string;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) flags[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = "true";
    } else positional.push(a);
  }
  return { positional, flags };
}

export function loadCase(caseId: string): EvalCase {
  const file = path.join(EVAL_DIR, "cases", `${caseId}.json`);
  if (!existsSync(file)) throw new Error(`No case file at ${path.relative(APP_ROOT, file)}`);
  return JSON.parse(readFileSync(file, "utf8")) as EvalCase;
}

export function runContext(caseId: string, flags: Record<string, string>): RunContext {
  const run = (flags.run ?? process.env.EVAL_RUN ?? "before").replace(/[^a-z0-9-]/gi, "");
  const date = flags.date ?? process.env.EVAL_DATE ?? today();
  const caseDir = path.join(APP_ROOT, "eval-results", date, caseId);
  const runDir = path.join(caseDir, run);
  mkdirSync(path.join(runDir, "state"), { recursive: true });
  return {
    caseId,
    run,
    date,
    baseUrl: (flags.base ?? process.env.EVAL_BASE_URL ?? "http://localhost:3017").replace(/\/$/, ""),
    evalCase: loadCase(caseId),
    caseDir,
    runDir,
    callsPath: path.join(runDir, "calls.jsonl"),
    tracePath: path.join(runDir, "gateway-trace.jsonl"),
    usagePath: path.join(runDir, "gateway-usage.json"),
    faultsPath: path.join(runDir, "faults.json"),
    statePath: path.join(runDir, "state", "app-localstorage.json"),
    runnerStatePath: path.join(runDir, "state", "runner.json"),
    // Gitignored by the "local-*" rule: never committed, never printed.
    credentialsPath: path.join(EVAL_DIR, `local-${caseId}-credentials.json`),
    sessionPath: path.join(EVAL_DIR, `local-${caseId}-session.json`),
  };
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function rel(file: string): string {
  return path.relative(APP_ROOT, file).replace(/\\/g, "/");
}
