import { describe, expect, test } from "bun:test";
import { providerRequestOptions } from "./ai-gateway-request";

describe("AI gateway provider request options", () => {
  test("uses OpenAI's current completion-token parameter", () => {
    expect(providerRequestOptions("openai", "gpt-5.4-mini", 800, "low")).toEqual({
      max_completion_tokens: 1824,
      reasoning_effort: "low",
    });
  });

  test("adds reasoning headroom to a short OpenAI probe budget", () => {
    expect(providerRequestOptions("openai", "gpt-5.4-mini", 20, "low")).toEqual({
      max_completion_tokens: 1044,
      reasoning_effort: "low",
    });
  });

  test("omits reasoning effort for non-reasoning OpenAI models", () => {
    expect(providerRequestOptions("openai", "gpt-4.1-mini", 800, "medium")).toEqual({
      max_completion_tokens: 800,
    });
  });

  test("enables mandatory GLM-5.3 thinking", () => {
    expect(providerRequestOptions("z.ai", "glm-5.3", 800, "medium")).toEqual({
      max_tokens: 1824,
      thinking: { type: "enabled" },
    });
  });

  test("keeps fast non-GLM-5.3 z.ai models non-thinking", () => {
    expect(providerRequestOptions("z.ai", "glm-4.7-flash", 800, "low")).toEqual({
      max_tokens: 800,
      thinking: { type: "disabled" },
    });
  });

  test("preserves the existing OpenAI-compatible default", () => {
    expect(providerRequestOptions("gemini", "gemini-3.5-flash-lite", 800, "low")).toEqual({
      max_tokens: 800,
    });
  });
});
