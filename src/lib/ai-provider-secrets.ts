import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const AI_CREDENTIALS_ENCRYPTION_KEY_ENV = "AI_CREDENTIALS_ENCRYPTION_KEY";

function encryptionKey(): Buffer | null {
  const raw = (process.env[AI_CREDENTIALS_ENCRYPTION_KEY_ENV] ?? "").trim();
  if (!raw) return null;
  try {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function aiCredentialEncryptionReady(): boolean {
  return encryptionKey() !== null;
}

export function encryptAiCredential(plaintext: string): string {
  const key = encryptionKey();
  if (!key) throw new Error(`${AI_CREDENTIALS_ENCRYPTION_KEY_ENV} must contain a 32-byte base64 or hexadecimal key.`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptAiCredential(stored: string): string {
  const key = encryptionKey();
  if (!key) throw new Error(`${AI_CREDENTIALS_ENCRYPTION_KEY_ENV} is unavailable.`);
  const [version, iv, tag, encrypted] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Unrecognised encrypted AI credential.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
