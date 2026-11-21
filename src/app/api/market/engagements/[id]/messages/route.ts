import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketHttpError, marketErrorResponse, notifyUser, notifyWorkspaceMembers, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";

async function authorizedEngagement(id: string, userId: string, workspaceId: string | null) {
  const engagement = await db.marketEngagement.findUnique({ where: { id }, include: { specialist: true, task: true } });
  if (!engagement) throw new MarketHttpError(404, "Engagement not found.");
  const role = engagement.specialist.userId === userId ? "specialist" : engagement.workspaceId === workspaceId ? "owner" : null;
  if (!role) throw new MarketHttpError(404, "Engagement not found.");
  return { engagement, role } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { action: "messages:list", limit: 120 });
    const { id } = await params;
    await authorizedEngagement(id, session.userId, session.workspaceId);
    const messages = await db.marketMessage.findMany({
      where: { engagementId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return NextResponse.json({ ok: true, messages }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return marketErrorResponse(error, "messages:list");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "messages:send", limit: 40 });
    const { id } = await params;
    const { engagement, role } = await authorizedEngagement(id, session.userId, session.workspaceId);
    if (["cancelled", "completed"].includes(engagement.status)) {
      throw new MarketHttpError(409, "This engagement is closed.");
    }
    const body = await request.json().catch(() => null);
    const messageBody = typeof body?.body === "string" ? body.body.trim().slice(0, 4000) : "";
    if (!messageBody) return NextResponse.json({ ok: false, error: "Write a message first." }, { status: 400 });
    const message = await db.marketMessage.create({
      data: { engagementId: id, senderUserId: session.userId, senderRole: role, body: messageBody },
    });
    if (role === "owner") {
      await notifyUser({
        userId: engagement.specialist.userId,
        type: "market-message",
        title: "New engagement message",
        body: `New message about “${engagement.task.title}”.`,
        entityType: "engagement",
        entityId: id,
      });
    } else {
      await notifyWorkspaceMembers({
        workspaceId: engagement.workspaceId,
        excludeUserId: session.userId,
        type: "market-message",
        title: "New engagement message",
        body: `${engagement.specialist.name} sent a message about “${engagement.task.title}”.`,
        entityType: "engagement",
        entityId: id,
      });
    }
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    return marketErrorResponse(error, "messages:send");
  }
}
