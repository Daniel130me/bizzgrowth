// Server-only: encryption for third-party tokens at rest.
//
// AES-256-GCM with a 32-byte key from CONNECTIONS_ENCRYPTION_KEY (base64 or
// hex). Stored format: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). A fresh
// random 12-byte IV per value; the auth tag makes tampering detectable.
// Generate a key:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export const ENCRYPTION_KEY_ENV = "CONNECTIONS_ENCRYPTION_KEY";

function loadKey(): Buffer | null {
  const raw = (process.env[ENCRYPTION_KEY_ENV] ?? "").trim();
  if (!raw) return null;
  try {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

/** True when a valid 32-byte key is configured. */
export function encryptionReady(): boolean {
  return loadKey() !== null;
}

export function encryptSecret(plain: string): string {
  const key = loadKey();
  if (!key) throw new Error(`${ENCRYPTION_KEY_ENV} is missing or not 32 bytes`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const key = loadKey();
  if (!key) throw new Error(`${ENCRYPTION_KEY_ENV} is missing or not 32 bytes`);
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
