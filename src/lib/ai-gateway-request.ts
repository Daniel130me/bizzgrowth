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
    const reasons = /gpt-oss|^gpt-5|^o\d/i.test(model.trim());
    return {
      max_completion_tokens: maxTokens + (reasons ? REASONING_TOKEN_HEADROOM : 0),
      ...(reasons ? { reasoning_effort: reasoningEffort } : {}),
    };
  }

  if (provider === "z.ai") {
    // GLM-5.3 requires thinking to be enabled. Reserve additional completion
    // capacity so the reasoning tokens do not consume the caller's full budget.
    if (/^glm-5\.3(?:-|$)/i.test(model.trim())) {
      return {
        max_tokens: maxTokens + REASONING_TOKEN_HEADROOM,
        thinking: { type: "enabled" },
      };
    }
    return { max_tokens: maxTokens, thinking: { type: "disabled" } };
  }

  return {
    max_tokens: maxTokens,
    ...(/gpt-oss/i.test(model) ? { reasoning_effort: reasoningEffort } : {}),
  };
}
