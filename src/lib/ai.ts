// Server-side helper for calling the LLM via z-ai-web-dev-sdk.
// MUST only be imported from API routes / server code.
import ZAI from "z-ai-web-dev-sdk";

/**
 * Run one text completion with resilience:
 * - Retries with backoff. The platform auth token in /etc/.z-ai-config is
 *   rotated periodically; a brief 401 window ("missing X-Token header") must
 *   not degrade the consultant to its offline fallback, so each attempt
 *   re-creates the client (re-reading the config) before giving up.
 * - BIZZ_AI_DISABLED=1 is an ops kill switch that forces the offline paths
 *   (used to verify degraded-mode UX).
 * Returns null only when the model is genuinely unreachable — callers then
 * use their own honest fallbacks.
 */
export async function completeText(
  system: string,
  user: string,
  opts?: { maxTokens?: number },
): Promise<string | null> {
  if (process.env.BIZZ_AI_DISABLED === "1") {
    console.warn("[bizzGrowth AI] disabled via BIZZ_AI_DISABLED=1 — using caller fallback");
    return null;
  }

  const attempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // ZAI.create() re-reads the config file — a freshly rotated token is
      // picked up on the next attempt instead of caching a dead one.
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: system },
          { role: "user", content: user },
        ],
        thinking: { type: "disabled" },
      });
      const content = completion.choices[0]?.message?.content;
      if (content && content.trim().length > 0) return content;
      lastError = new Error("empty completion");
    } catch (error) {
      lastError = error;
      console.error(
        `[bizzGrowth AI] attempt ${attempt}/${attempts} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  console.error(
    "[bizzGrowth AI] all attempts failed — degraded fallback will be used:",
    lastError instanceof Error ? lastError.message : lastError,
  );
  return null;
}
