// Server-side helper for calling the LLM. MUST only be imported from API
// routes / server code.
//
// Since the AI gateway (src/lib/ai-gateway.ts) this is a thin wrapper:
// every completion goes through the multi-provider failover chain
// (z.ai platform first, then OpenAI / Groq / OpenRouter / Gemini when their
// keys are configured). All product features — consultation chat, diagnosis,
// Ask, insights, briefs — share this single entry point.
//
// BIZZ_AI_DISABLED=1 remains an ops kill switch that forces honest offline
// paths (used to verify degraded-mode UX).

import { gatewayChatComplete, type GatewayProfile, type GatewayResult } from "./ai-gateway";

/**
 * Run one text completion through the AI gateway with automatic provider
 * failover. Returns null only when every configured provider failed —
 * callers then use their own honest fallbacks.
 *
 * `profile`: "fast" for live conversation turns, "quality" for the diagnosis,
 * "default" (omitted) for everything else — see GatewayProfile.
 * See GatewayResult (chatCompleteDetailed) for which provider served.
 */
export async function completeText(
  system: string,
  user: string,
  opts?: { maxTokens?: number; profile?: GatewayProfile; timeoutMs?: number },
): Promise<string | null> {
  const result = await completeTextDetailed(system, user, opts);
  return result.text;
}

/**
 * Same as completeText but returns gateway metadata (which provider served,
 * latency, per-route attempts) for observability and the status screen.
 */
export async function completeTextDetailed(
  system: string,
  user: string,
  opts?: { maxTokens?: number; profile?: GatewayProfile; timeoutMs?: number },
): Promise<GatewayResult> {
  return gatewayChatComplete(system, user, opts);
}
