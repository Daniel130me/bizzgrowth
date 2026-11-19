// Server-only: password hashing for bizzGrowth accounts.
import bcrypt from "bcryptjs";

// Existing Neon users were hashed with bcrypt cost 12 ($2b$12$...), so new
// accounts use the same algorithm and cost.
const COST = 12;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200; // bcrypt only uses 72 bytes; this caps abuse

// A real hash of a random string, compared against when the email is unknown, so
// a wrong email takes as long as a wrong password (no account-existence oracle).
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  return (dummyHash ??= bcrypt.hash(crypto.randomUUID(), COST));
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, await getDummyHash());
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
