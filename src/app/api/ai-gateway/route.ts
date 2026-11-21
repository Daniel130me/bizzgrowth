import { NextRequest, NextResponse } from "next/server";
import { completeTextDetailed } from "@/lib/ai";
import { getGatewaySnapshot } from "@/lib/ai-gateway";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { MarketHttpError, marketErrorResponse, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";

/** GET — configuration + health snapshot for the AI gateway settings screen. */
async function requireAdmin(request: NextRequest, mutation = false) {
  const session = await requireMarketSession(request, {
    mutation,
    action: mutation ? "admin:ai-gateway:test" : "admin:ai-gateway:status",
    limit: mutation ? 15 : 120,
  });
  if (!isPlatformAdmin(session)) throw new MarketHttpError(403, "Platform administrator access required.");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ ok: true, snapshot: await getGatewaySnapshot() });
  } catch (error) {
    return marketErrorResponse(error, "admin:ai-gateway:status");
  }
}

/** POST — live test: run a tiny completion through the failover chain and
 *  report exactly which route served it (or how each route failed). */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request, true);
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
