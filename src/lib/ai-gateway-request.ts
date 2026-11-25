import type { ManagedAiProviderId } from "@/lib/ai-provider-config";

export type GatewayReasoningEffort = "low" | "medium";

const REASONING_TOKEN_HEADROOM = 1024;

type ProviderRequestOptions =
  | {
      max_completion_tokens: number;
      max_tokens?: never;
      thinking?: never;
      reasoning_effort?: GatewayReasoningEffort;
    }
  | {
      max_tokens: number;
      max_completion_tokens?: never;
      thinking?: { type: "disabled" | "enabled" };
      reasoning_effort?: GatewayReasoningEffort;
    };

/**
 * Translate the gateway's provider-neutral options into each provider's
 * OpenAI-compatible request dialect. Keeping this pure makes new model-family
 * exceptions explicit and regression-testable.
 */
export function providerRequestOptions(
  provider: ManagedAiProviderId,
  model: string,
  maxTokens: number,
  reasoningEffort: GatewayReasoningEffort,
): ProviderRequestOptions {
  if (provider === "openai") {
    // GPT-5.x / o-series are reasoning models: reasoning tokens are billed
    // against max_completion_tokens. Keep the requested output budget available
    // by adding room for hidden reasoning and pin the effort explicitly.
    // Always "low": measured Nov 2026 on gpt-5.4-mini with a 2,600-token
    // consultant answer, "medium" spent the whole 3,624-token budget on
    // reasoning (empty reply, 32 s); "low" answered fully in ~15 s.
    const reasons = /gpt-oss|^gpt-5|^o\d/i.test(model.trim());
    return {
      max_completion_tokens: maxTokens + (reasons ? REASONING_TOKEN_HEADROOM : 0),
      ...(reasons ? { reasoning_effort: "low" as const } : {}),
    };
  }

  if (provider === "z.ai" || provider === "z.ai-free") {
    // GLM-5.3 always thinks (it rejects thinking "disabled") and accepts only
    // reasoning_effort low/high/max. Without "low" it reasoned for 65-107 s on
    // a consultant question — past the gateway timeout; with "low" ~22 s.
    // Reserve extra completion capacity so reasoning does not eat the answer.
    if (/^glm-5\.3(?:-|$)/i.test(model.trim())) {
      return {
        max_tokens: maxTokens + REASONING_TOKEN_HEADROOM,
        thinking: { type: "enabled" },
        reasoning_effort: "low",
      };
    }
    return { max_tokens: maxTokens, thinking: { type: "disabled" } };
  }

  // gpt-oss (Groq, OpenRouter) counts its reasoning against max_tokens too:
  // without headroom a 700-token chat reply was cut off mid-sentence.
  const reasons = /gpt-oss/i.test(model);
  return {
    max_tokens: maxTokens + (reasons ? REASONING_TOKEN_HEADROOM : 0),
    ...(reasons ? { reasoning_effort: reasoningEffort } : {}),
  };
}
