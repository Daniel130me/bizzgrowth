// Server-side helper for calling the LLM via z-ai-web-dev-sdk.
// MUST only be imported from API routes / server code.
import ZAI from "z-ai-web-dev-sdk";

export async function completeText(
  system: string,
  user: string,
  opts?: { maxTokens?: number },
): Promise<string | null> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: system },
        { role: "user", content: user },
      ],
      thinking: { type: "disabled" },
    });
    const content = completion.choices[0]?.message?.content;
    return content && content.trim().length > 0 ? content : null;
  } catch (error) {
    console.error("[bizzGrowth AI] completion failed:", error);
    return null;
  }
}
