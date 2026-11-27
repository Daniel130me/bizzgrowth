import { describe, expect, mock, test } from "bun:test";

// The gateway reads live settings from the database; here, a fixed order and no admin keys.
mock.module("server-only", () => ({}));
mock.module("@/lib/ai-provider-config", () => ({
  refreshRuntimeAiProviderConfig: async () => {},
  runtimeAiProviderConfig: () => ({ enabled: true, model: null, credentials: [] }),
  runtimeAiProviderOrder: () => ["openai", "z.ai", "openrouter", "gemini", "z.ai-free", "groq", "cerebras", "mistral"],
}));

// Only two fake providers; nothing real is ever called (any other request fails the test).
for (const k of Object.keys(process.env)) {
  if (/_API_KEYS?(_\d+)?$/.test(k) || /^AI_GATEWAY_(TRACE|FAULTS)_FILE$/.test(k)) delete process.env[k];
}
process.env.AI_GATEWAY_USAGE_FILE = "off";
process.env.OPENAI_API_KEY = "test-openai-key-0001";
process.env.ZAI_API_KEY = "test-zai-key-0001";
(globalThis as { __bizzAiGateway?: unknown }).__bizzAiGateway = undefined;

/** How long the second provider takes to answer (it is healthy, just not instant). */
let nextProviderMs = 0;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("api.openai.com")) {
    // Stuck: never answers, until the gateway gives up on it.
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("This operation was aborted")));
    });
  }
  if (url.includes("api.z.ai")) {
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          resolve(
            new Response(JSON.stringify({ choices: [{ message: { content: "answer from the next provider" } }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          ),
        nextProviderMs,
      );
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("This operation was aborted"));
      });
    });
  }
  throw new Error(`unexpected request to ${url}`);
}) as typeof fetch;

const { gatewayChatComplete } = await import("./ai-gateway");

describe("AI gateway: one time limit for the whole request", () => {
  test(
    "a stuck first provider gets half the limit, and the next one answers inside it",
    async () => {
      nextProviderMs = 0;
      const started = Date.now();
      const result = await gatewayChatComplete("system", "user", { profile: "fast", timeoutMs: 10_000 });
      const took = Date.now() - started;

      expect(result.text).toBe("answer from the next provider");
      expect(result.servedBy).toBe("z.ai");
      expect(result.attempts.map((a) => a.routeLabel)).toEqual(["OpenAI", "z.ai"]);
      const stuck = result.attempts[0];
      expect(stuck.ok).toBe(false);
      expect(stuck.latencyMs).toBeGreaterThanOrEqual(4_500);
      expect(stuck.latencyMs).toBeLessThan(6_000);
      expect(took).toBeLessThan(10_000);
      expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 4, totalTokens: 9 });
    },
    15_000,
  );

  test(
    "a healthy but slower next provider still has time to answer (70% for the first left it 3 s, and nobody answered)",
    async () => {
      nextProviderMs = 3_800;
      const started = Date.now();
      const result = await gatewayChatComplete("system", "user", { profile: "fast", timeoutMs: 10_000 });
      const took = Date.now() - started;
      globalThis.fetch = realFetch;

      // The stuck provider was really tried (not skipped), then the next one answered in time.
      expect(result.attempts[0].routeLabel).toBe("OpenAI");
      expect(result.attempts[0].latencyMs).toBeGreaterThanOrEqual(4_500);
      expect(result.text).toBe("answer from the next provider");
      expect(result.servedBy).toBe("z.ai");
      expect(took).toBeLessThan(10_000);
    },
    15_000,
  );
});
