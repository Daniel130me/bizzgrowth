import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import {
  addAiProviderCredential,
  deleteAiProviderCredential,
  isManagedAiProvider,
  listAdminAiProviderConfig,
  MANAGED_AI_PROVIDER_IDS,
  setAiProviderCredentialEnabled,
  setAiProviderOrder,
  type ManagedAiProviderId,
  updateAiProviderSetting,
} from "@/lib/ai-provider-config";
import { aiCredentialEncryptionReady } from "@/lib/ai-provider-secrets";
import { MarketHttpError, marketErrorResponse, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest, mutation = false) {
  const session = await requireMarketSession(request, {
    mutation,
    action: mutation ? "admin:ai-providers:write" : "admin:ai-providers:read",
    limit: mutation ? 40 : 120,
  });
  if (!isPlatformAdmin(session)) throw new MarketHttpError(403, "Platform administrator access required.");
  return session;
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ ok: true, ...(await listAdminAiProviderConfig()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return marketErrorResponse(error, "admin:ai-providers:list");
  }
}

/** Add one encrypted API key. Plaintext is discarded after encryption. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request, true);
    if (!aiCredentialEncryptionReady()) {
      throw new MarketHttpError(503, "AI credential encryption is not configured on this server.");
    }
    const body = await request.json().catch(() => null);
    const provider = cleanString(body?.provider, 30);
    const label = cleanString(body?.label, 60);
    const apiKey = cleanString(body?.apiKey, 1000);
    if (!isManagedAiProvider(provider)) throw new MarketHttpError(400, "Choose a supported AI provider.");
    if (label.length < 2) throw new MarketHttpError(400, "Give this key a label of at least 2 characters.");
    if (apiKey.length < 12) throw new MarketHttpError(400, "The API key is too short.");
    const id = await addAiProviderCredential({ provider, label, apiKey, adminUserId: session.userId });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ ok: false, error: "That provider already has a key with this label." }, { status: 409 });
    }
    return marketErrorResponse(error, "admin:ai-providers:add-key");
  }
}

/**
 * Update provider enablement and its optional model override, or, with an
 * `order` field, the failover order (every provider once, first = tried
 * first; `order: null` resets to the default order).
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin(request, true);
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "order" in body) {
      const order: unknown = body.order;
      if (order === null) {
        await setAiProviderOrder({ order: null, adminUserId: session.userId });
        return NextResponse.json({ ok: true });
      }
      if (
        !Array.isArray(order) ||
        order.length !== MANAGED_AI_PROVIDER_IDS.length ||
        new Set(order).size !== order.length ||
        !order.every((id) => typeof id === "string" && isManagedAiProvider(id))
      ) {
        throw new MarketHttpError(400, "List every AI provider exactly once.");
      }
      await setAiProviderOrder({ order: order as ManagedAiProviderId[], adminUserId: session.userId });
      return NextResponse.json({ ok: true });
    }
    const provider = cleanString(body?.provider, 30);
    const model = cleanString(body?.model, 120) || null;
    if (!isManagedAiProvider(provider)) throw new MarketHttpError(400, "Choose a supported AI provider.");
    if (typeof body?.enabled !== "boolean") throw new MarketHttpError(400, "Provider status is required.");
    if (model && !/^[a-zA-Z0-9._:/-]+$/.test(model)) {
      throw new MarketHttpError(400, "Model names may only contain letters, numbers, dots, underscores, colons, slashes and hyphens.");
    }
    await updateAiProviderSetting({ provider, enabled: body.enabled, model, adminUserId: session.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return marketErrorResponse(error, "admin:ai-providers:update");
  }
}

/** Enable or disable one stored key without deleting it. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin(request, true);
    const body = await request.json().catch(() => null);
    const id = cleanString(body?.id, 80);
    if (!id || typeof body?.enabled !== "boolean") throw new MarketHttpError(400, "Key and status are required.");
    const updated = await setAiProviderCredentialEnabled({ id, enabled: body.enabled, adminUserId: session.userId });
    if (!updated) throw new MarketHttpError(404, "API key not found.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return marketErrorResponse(error, "admin:ai-providers:key-status");
  }
}

/** Permanently remove a stored key. Environment keys are not editable here. */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin(request, true);
    const id = cleanString(request.nextUrl.searchParams.get("id"), 80);
    if (!id) throw new MarketHttpError(400, "Key id is required.");
    const deleted = await deleteAiProviderCredential(id, session.userId);
    if (!deleted) throw new MarketHttpError(404, "API key not found.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return marketErrorResponse(error, "admin:ai-providers:delete-key");
  }
}
