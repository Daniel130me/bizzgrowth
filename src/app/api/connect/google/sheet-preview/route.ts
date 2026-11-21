import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readJson, sameOrigin, str } from "@/lib/auth/http";
import { googleSheetId, previewGoogleSheet } from "@/lib/connectors/google";
import { accessTokenForCredential } from "@/lib/connectors/sync";
import { getCredential } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const credential = await getCredential(session.userId, "google");
  if (!credential) return NextResponse.json({ ok: false, error: "Connect Google first" }, { status: 404 });
  const body = await readJson(request);
  const id = googleSheetId(str(body?.url, 500));
  if (!id) return NextResponse.json({ ok: false, error: "Paste a valid Google Sheets URL" }, { status: 400 });
  try {
    const spreadsheet = await accessTokenForCredential(credential).then((token) => previewGoogleSheet(token, id));
    return NextResponse.json({ ok: true, spreadsheet: { id: spreadsheet.id, name: spreadsheet.name }, tabs: spreadsheet.tabs });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "The spreadsheet could not be read" }, { status: 502 });
  }
}
