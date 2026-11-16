import { NextResponse } from "next/server";
import { completeTextDetailed } from "@/lib/ai";
import { getGatewaySnapshot } from "@/lib/ai-gateway";

export const runtime = "nodejs";

/** GET — configuration + health snapshot for the AI gateway settings screen. */
export async function GET() {
  return NextResponse.json({ ok: true, snapshot: getGatewaySnapshot() });
}

/** POST — live test: run a tiny completion through the failover chain and
 *  report exactly which route served it (or how each route failed). */
export async function POST() {
  try {
    const started = Date.now();
    const result = await completeTextDetailed(
      "You are a connectivity probe. Reply with exactly one word: OK",
      "Ping. Reply with exactly one word: OK",
      { maxTokens: 20 },
    );
    if (result.text === null) {
      return NextResponse.json(
        {
          ok: false,
          error: "Every configured provider failed — see the attempt list.",
          attempts: result.attempts,
          latencyMs: Date.now() - started,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      servedBy: result.servedBy,
      model: result.model,
      latencyMs: result.latencyMs,
      totalLatencyMs: Date.now() - started,
      reply: result.text.trim().slice(0, 40),
      attempts: result.attempts,
    });
  } catch (error) {
    console.error("[api/ai-gateway] test error:", error);
    return NextResponse.json({ ok: false, error: "Gateway test crashed" }, { status: 500 });
  }
}
