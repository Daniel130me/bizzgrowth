import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  aiCredentialEncryptionReady,
  decryptAiCredential,
  encryptAiCredential,
} from "@/lib/ai-provider-secrets";

export const MANAGED_AI_PROVIDER_IDS = ["z.ai", "openai", "groq", "openrouter", "gemini"] as const;
export type ManagedAiProviderId = (typeof MANAGED_AI_PROVIDER_IDS)[number];

const PROVIDER_SET = new Set<string>(MANAGED_AI_PROVIDER_IDS);
const CACHE_TTL_MS = 30_000;

type ProviderRow = {
  provider: string;
  enabled: boolean;
  model: string | null;
  updatedAt: Date;
};

type CredentialRow = {
  id: string;
  provider: string;
  label: string;
  secretEnc: string;
  lastFour: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface RuntimeAiCredential {
  id: string;
  label: string;
  apiKey: string;
  lastFour: string;
}

export interface RuntimeAiProviderConfig {
  enabled: boolean;
  model: string | null;
  credentials: RuntimeAiCredential[];
}

export interface AdminAiCredential {
  id: string;
  label: string;
  masked: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAiProviderConfig {
  provider: ManagedAiProviderId;
  enabled: boolean;
  model: string | null;
  credentials: AdminAiCredential[];
}

type RuntimeCache = {
  expiresAt: number;
  providers: Map<ManagedAiProviderId, RuntimeAiProviderConfig>;
};

let runtimeCache: RuntimeCache | null = null;

export function isManagedAiProvider(value: string): value is ManagedAiProviderId {
  return PROVIDER_SET.has(value);
}

async function readRows(): Promise<{ providers: ProviderRow[]; credentials: CredentialRow[] }> {
  const [providers, credentials] = await Promise.all([
    db.$queryRaw<ProviderRow[]>`
      SELECT "provider", "enabled", "model", "updatedAt"
      FROM "AiProviderConfig"`,
    db.$queryRaw<CredentialRow[]>`
      SELECT "id", "provider", "label", "secretEnc", "lastFour", "enabled", "createdAt", "updatedAt"
      FROM "AiProviderCredential"
      ORDER BY "provider" ASC, "createdAt" ASC`,
  ]);
  return { providers, credentials };
}

function runtimeFromRows(rows: { providers: ProviderRow[]; credentials: CredentialRow[] }): RuntimeCache {
  const providerRows = new Map(rows.providers.map((row) => [row.provider, row]));
  const providers = new Map<ManagedAiProviderId, RuntimeAiProviderConfig>();
  for (const provider of MANAGED_AI_PROVIDER_IDS) {
    const configured = providerRows.get(provider);
    const credentials: RuntimeAiCredential[] = [];
    for (const row of rows.credentials) {
      if (row.provider !== provider || !row.enabled) continue;
      try {
        credentials.push({
          id: row.id,
          label: row.label,
          apiKey: decryptAiCredential(row.secretEnc),
          lastFour: row.lastFour,
        });
      } catch (error) {
        console.error(`[ai-provider-config] Could not decrypt credential ${row.id}.`, error);
      }
    }
    providers.set(provider, {
      // No database row means existing environment configuration keeps working.
      enabled: configured?.enabled ?? true,
      model: configured?.model?.trim() || null,
      credentials,
    });
  }
  return { expiresAt: Date.now() + CACHE_TTL_MS, providers };
}

/**
 * Refreshes the runtime cache. Gateway calls fail open to their existing
 * environment configuration if the configuration database is temporarily down.
 */
export async function refreshRuntimeAiProviderConfig(force = false): Promise<void> {
  if (!force && runtimeCache && runtimeCache.expiresAt > Date.now()) return;
  try {
    runtimeCache = runtimeFromRows(await readRows());
  } catch (error) {
    console.error("[ai-provider-config] Configuration refresh failed; using environment configuration.", error);
    runtimeCache ??= runtimeFromRows({ providers: [], credentials: [] });
    runtimeCache.expiresAt = Date.now() + 5_000;
  }
}

export function runtimeAiProviderConfig(provider: ManagedAiProviderId): RuntimeAiProviderConfig {
  return runtimeCache?.providers.get(provider) ?? { enabled: true, model: null, credentials: [] };
}

export async function listAdminAiProviderConfig(): Promise<{
  encryptionReady: boolean;
  providers: AdminAiProviderConfig[];
}> {
  const rows = await readRows();
  const providerRows = new Map(rows.providers.map((row) => [row.provider, row]));
  return {
    encryptionReady: aiCredentialEncryptionReady(),
    providers: MANAGED_AI_PROVIDER_IDS.map((provider) => {
      const configured = providerRows.get(provider);
      return {
        provider,
        enabled: configured?.enabled ?? true,
        model: configured?.model?.trim() || null,
        credentials: rows.credentials
          .filter((credential) => credential.provider === provider)
          .map((credential) => ({
            id: credential.id,
            label: credential.label,
            masked: `••••${credential.lastFour}`,
            enabled: credential.enabled,
            createdAt: credential.createdAt.toISOString(),
            updatedAt: credential.updatedAt.toISOString(),
          })),
      };
    }),
  };
}

export async function updateAiProviderSetting(input: {
  provider: ManagedAiProviderId;
  enabled: boolean;
  model: string | null;
  adminUserId: string;
}): Promise<void> {
  const model = input.model?.trim() || null;
  await db.$transaction([
    db.$executeRaw`
      INSERT INTO "AiProviderConfig" ("provider", "enabled", "model", "updatedBy")
      VALUES (${input.provider}, ${input.enabled}, ${model}, ${input.adminUserId})
      ON CONFLICT ("provider") DO UPDATE
      SET "enabled" = EXCLUDED."enabled", "model" = EXCLUDED."model",
          "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
    db.$executeRaw`
      INSERT INTO "AiProviderAuditEvent" ("id", "adminUserId", "action", "provider", "metadata")
      VALUES (${randomUUID()}, ${input.adminUserId}, 'provider.updated', ${input.provider},
              ${JSON.stringify({ enabled: input.enabled, model })}::jsonb)`,
  ]);
  await refreshRuntimeAiProviderConfig(true);
}

export async function addAiProviderCredential(input: {
  provider: ManagedAiProviderId;
  label: string;
  apiKey: string;
  adminUserId: string;
}): Promise<string> {
  const id = randomUUID();
  const encrypted = encryptAiCredential(input.apiKey);
  const lastFour = input.apiKey.slice(-4);
  await db.$transaction([
    db.$executeRaw`
      INSERT INTO "AiProviderConfig" ("provider", "updatedBy")
      VALUES (${input.provider}, ${input.adminUserId})
      ON CONFLICT ("provider") DO UPDATE SET "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
    db.$executeRaw`
      INSERT INTO "AiProviderCredential"
        ("id", "provider", "label", "secretEnc", "lastFour", "createdBy")
      VALUES (${id}, ${input.provider}, ${input.label}, ${encrypted}, ${lastFour}, ${input.adminUserId})`,
    db.$executeRaw`
      INSERT INTO "AiProviderAuditEvent"
        ("id", "adminUserId", "action", "provider", "credentialId", "metadata")
      VALUES (${randomUUID()}, ${input.adminUserId}, 'credential.created', ${input.provider}, ${id},
              ${JSON.stringify({ label: input.label, lastFour })}::jsonb)`,
  ]);
  await refreshRuntimeAiProviderConfig(true);
  return id;
}

export async function setAiProviderCredentialEnabled(input: {
  id: string;
  enabled: boolean;
  adminUserId: string;
}): Promise<boolean> {
  const rows = await db.$queryRaw<{ provider: string; label: string }[]>`
    SELECT "provider", "label" FROM "AiProviderCredential" WHERE "id" = ${input.id} LIMIT 1`;
  const credential = rows[0];
  if (!credential || !isManagedAiProvider(credential.provider)) return false;
  await db.$transaction([
    db.$executeRaw`
      UPDATE "AiProviderCredential" SET "enabled" = ${input.enabled}, "updatedAt" = NOW()
      WHERE "id" = ${input.id}`,
    db.$executeRaw`
      INSERT INTO "AiProviderAuditEvent"
        ("id", "adminUserId", "action", "provider", "credentialId", "metadata")
      VALUES (${randomUUID()}, ${input.adminUserId}, 'credential.updated', ${credential.provider}, ${input.id},
              ${JSON.stringify({ label: credential.label, enabled: input.enabled })}::jsonb)`,
  ]);
  await refreshRuntimeAiProviderConfig(true);
  return true;
}

export async function deleteAiProviderCredential(id: string, adminUserId: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ provider: string; label: string; lastFour: string }[]>`
    SELECT "provider", "label", "lastFour" FROM "AiProviderCredential" WHERE "id" = ${id} LIMIT 1`;
  const credential = rows[0];
  if (!credential || !isManagedAiProvider(credential.provider)) return false;
  await db.$transaction([
    db.$executeRaw`DELETE FROM "AiProviderCredential" WHERE "id" = ${id}`,
    db.$executeRaw`
      INSERT INTO "AiProviderAuditEvent"
        ("id", "adminUserId", "action", "provider", "credentialId", "metadata")
      VALUES (${randomUUID()}, ${adminUserId}, 'credential.deleted', ${credential.provider}, ${id},
              ${JSON.stringify({ label: credential.label, lastFour: credential.lastFour })}::jsonb)`,
  ]);
  await refreshRuntimeAiProviderConfig(true);
  return true;
}
