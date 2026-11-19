import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, MAX_PASSWORD_LENGTH } from "@/lib/auth/password";
import { clearLoginFailures, failureDelay, loginBlockedFor, MAX_FAILS_PER_EMAIL, recordLoginFailure } from "@/lib/auth/rate-limit";
import { requestMeta, startSession, withDbRetry } from "@/lib/auth/session";
import { jsonError, normaliseEmail, readJson, sameOrigin, str } from "@/lib/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One message for an unknown email AND a wrong password.
const BAD_CREDENTIALS = "Email or password is incorrect.";
const LOCK_MINUTES = 15;

function tooMany(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return jsonError(429, `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, {
    retryAfter: seconds,
  });
}

type UserRow = { id: string; passwordHash: string | null; failedLoginAttempts: number; lockedUntil: Date | null };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  const body = await readJson(req);
  const email = normaliseEmail(body?.email);
  const password = str(body?.password, MAX_PASSWORD_LENGTH + 1);
  const remember = body?.remember !== false;
  if (!email || !password || password.length > MAX_PASSWORD_LENGTH) {
    await failureDelay();
    return jsonError(401, BAD_CREDENTIALS);
  }

  const { ip } = await requestMeta();
  const blocked = loginBlockedFor(ip, email);
  if (blocked) return tooMany(blocked);

  try {
    const rows = await withDbRetry(
      () => db.$queryRaw<UserRow[]>`
        SELECT "id", "passwordHash", "failedLoginAttempts", "lockedUntil"
        FROM "User" WHERE lower("email") = ${email} LIMIT 1`,
    );
    const user = rows[0];

    // Always run bcrypt (a dummy compare for unknown emails) so timing matches.
    const ok = await verifyPassword(password, user?.passwordHash);

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      recordLoginFailure(ip, email);
      await failureDelay();
      return tooMany(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000));
    }

    if (!user || !ok) {
      recordLoginFailure(ip, email);
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const lock = attempts >= MAX_FAILS_PER_EMAIL;
        await db.$executeRaw`
          UPDATE "User" SET "failedLoginAttempts" = ${lock ? 0 : attempts},
            "lockedUntil" = ${lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null}
          WHERE "id" = ${user.id}`.catch(() => {});
      }
      await failureDelay();
      return jsonError(401, BAD_CREDENTIALS);
    }

    clearLoginFailures(email);
    await db.$executeRaw`
      UPDATE "User" SET "failedLoginAttempts" = 0, "lockedUntil" = NULL, "lastLoginAt" = NOW()
      WHERE "id" = ${user.id}`;

    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    await startSession(res, { userId: user.id, remember });
    return res;
  } catch (err) {
    console.error("[auth/login]", (err as Error)?.message);
    return jsonError(503, "We couldn't reach the server. Please try again in a moment.");
  }
}

