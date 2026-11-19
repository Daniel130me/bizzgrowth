import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { newId, startSession, withDbRetry } from "@/lib/auth/session";
import { isEmail, jsonError, normaliseEmail, readJson, sameOrigin, str } from "@/lib/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  const body = await readJson(req);
  const name = str(body?.name, 120).trim();
  const email = normaliseEmail(body?.email);
  const password = str(body?.password, MAX_PASSWORD_LENGTH + 1);

  if (name.length < 2) return jsonError(400, "Enter your full name.", { field: "name" });
  if (!isEmail(email)) return jsonError(400, "Enter a valid email address.", { field: "email" });
  if (password.length < MIN_PASSWORD_LENGTH)
    return jsonError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, { field: "password" });
  if (password.length > MAX_PASSWORD_LENGTH) return jsonError(400, "That password is too long.", { field: "password" });

  try {
    const existing = await withDbRetry(
      () => db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE lower("email") = ${email} LIMIT 1`,
    );
    if (existing.length) {
      return jsonError(409, "An account with this email already exists. Sign in instead.", { field: "email" });
    }

    const id = newId();
    const passwordHash = await hashPassword(password);
    try {
      await db.$executeRaw`
        INSERT INTO "User" ("id", "email", "passwordHash", "name", "updatedAt", "lastLoginAt")
        VALUES (${id}, ${email}, ${passwordHash}, ${name}, NOW(), NOW())`;
    } catch (err) {
      // Lost a race with a concurrent sign-up for the same email.
      if (/unique|duplicate/i.test(String((err as Error)?.message))) {
        return jsonError(409, "An account with this email already exists. Sign in instead.", { field: "email" });
      }
      throw err;
    }

    const res = NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
    await startSession(res, { userId: id, remember: true });
    return res;
  } catch (err) {
    console.error("[auth/signup]", (err as Error)?.message);
    return jsonError(503, "We couldn't create your account right now. Please try again in a moment.");
  }
}
