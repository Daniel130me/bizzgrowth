import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { newId, withDbRetry } from "@/lib/auth/session";
import { entryForProduct } from "./catalogue";
import { encryptSecret } from "./crypto";
import type { ConnectionView, MetricPoint, SyncProgress, TokenSet } from "./types";

export type CredentialRow = {
  id: string;
  userId: string;
  provider: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  scopes: string;
  metadata: unknown;
};

export type ConnectionRow = {
  id: string;
  userId: string;
  workspaceId: string | null;
  credentialId: string;
  provider: string;
  product: string;
  externalAccountId: string | null;
  externalAccountLabel: string | null;
  config: unknown;
  scopes: string;
  status: string;
  progress: unknown;
  error: string | null;
  errorCode: string | null;
  lastSyncAt: Date | null;
  syncStartedAt: Date | null;
  dataFrom: Date | null;
  dataTo: Date | null;
  createdAt: Date;
  credentialAccessTokenEnc?: string;
  credentialRefreshTokenEnc?: string | null;
  credentialTokenExpiresAt?: Date | null;
  credentialScopes?: string;
  credentialMetadata?: unknown;
};

export type MetricRow = {
  connectionId: string;
  provider: string;
  product: string;
  accountLabel: string | null;
  metric: string;
  dimension: string;
  dimensionValue: string;
  date: Date;
  value: number;
  lastSyncAt: Date | null;
};

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function progressOf(value: unknown): SyncProgress | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<SyncProgress>;
  return typeof p.step === "number" && typeof p.total === "number" && typeof p.label === "string"
    ? { step: p.step, total: p.total, label: p.label, ...(typeof p.rows === "number" ? { rows: p.rows } : {}) }
    : null;
}

function toView(row: ConnectionRow): ConnectionView {
  return {
    id: row.id,
    provider: row.provider,
    product: row.product,
    catalogueId: entryForProduct(row.provider, row.product)?.id ?? null,
    accountId: row.externalAccountId,
    accountLabel: row.externalAccountLabel,
    status: ["pending", "syncing", "connected", "error"].includes(row.status) ? (row.status as ConnectionView["status"]) : "error",
    progress: progressOf(row.progress),
    error: row.error,
    errorCode: row.errorCode,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastAttemptAt: row.syncStartedAt?.toISOString() ?? null,
    connectedSince: row.createdAt.toISOString(),
    dataFrom: dateOnly(row.dataFrom),
    dataTo: dateOnly(row.dataTo),
    scopes: row.scopes.split(/\s+/).filter(Boolean),
  };
}

export async function connectorTablesReady(): Promise<boolean> {
  const rows = await withDbRetry(() => db.$queryRaw<Array<{ ready: boolean }>>`
    SELECT to_regclass('public."ConnectorCredential"') IS NOT NULL
       AND to_regclass('public."Connection"') IS NOT NULL
       AND to_regclass('public."MetricDaily"') IS NOT NULL
       AND to_regclass('public."IntegrationInterest"') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'Connection' AND column_name = 'config'
       )
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'ConnectorCredential' AND column_name = 'metadata'
       ) AS ready`);
  return rows[0]?.ready === true;
}

export async function listConnections(userId: string): Promise<ConnectionView[]> {
  const rows = await withDbRetry(() => db.$queryRaw<ConnectionRow[]>`
    SELECT * FROM "Connection" WHERE "userId" = ${userId} ORDER BY "createdAt" ASC`);
  return rows.map(toView);
}

export async function listInterest(userId: string): Promise<string[]> {
  const rows = await withDbRetry(() => db.$queryRaw<Array<{ platform: string }>>`
    SELECT "platform" FROM "IntegrationInterest" WHERE "userId" = ${userId} ORDER BY "createdAt" ASC`);
  return rows.map((row) => row.platform);
}

export async function setInterest(userId: string, platform: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await withDbRetry(() => db.$executeRaw`
      INSERT INTO "IntegrationInterest" ("id", "userId", "platform")
      VALUES (${newId()}, ${userId}, ${platform}) ON CONFLICT ("userId", "platform") DO NOTHING`);
  } else {
    await withDbRetry(() => db.$executeRaw`
      DELETE FROM "IntegrationInterest" WHERE "userId" = ${userId} AND "platform" = ${platform}`);
  }
}

export async function getCredential(userId: string, provider: string): Promise<CredentialRow | null> {
  const rows = await withDbRetry(() => db.$queryRaw<CredentialRow[]>`
    SELECT * FROM "ConnectorCredential" WHERE "userId" = ${userId} AND "provider" = ${provider} LIMIT 1`);
  return rows[0] ?? null;
}

export async function saveCredential(userId: string, provider: string, tokens: TokenSet): Promise<CredentialRow> {
  const existing = await getCredential(userId, provider);
  const access = encryptSecret(tokens.accessToken);
  const refresh = tokens.refreshToken ? encryptSecret(tokens.refreshToken) : existing?.refreshTokenEnc ?? null;
  const scopes = tokens.scopes.length ? tokens.scopes.join(" ") : existing?.scopes ?? "";
  const metadata = tokens.metadata ?? (existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : null);
  const rows = await withDbRetry(() => db.$queryRaw<CredentialRow[]>`
    INSERT INTO "ConnectorCredential"
      ("id", "userId", "provider", "accessTokenEnc", "refreshTokenEnc", "tokenExpiresAt", "scopes", "metadata", "updatedAt")
    VALUES (${existing?.id ?? newId()}, ${userId}, ${provider}, ${access}, ${refresh}, ${tokens.expiresAt}, ${scopes}, ${metadata ? JSON.stringify(metadata) : null}::jsonb, NOW())
    ON CONFLICT ("userId", "provider") DO UPDATE SET
      "accessTokenEnc" = EXCLUDED."accessTokenEnc",
      "refreshTokenEnc" = COALESCE(EXCLUDED."refreshTokenEnc", "ConnectorCredential"."refreshTokenEnc"),
      "tokenExpiresAt" = EXCLUDED."tokenExpiresAt",
      "scopes" = CASE WHEN EXCLUDED."scopes" = '' THEN "ConnectorCredential"."scopes" ELSE EXCLUDED."scopes" END,
      "metadata" = COALESCE(EXCLUDED."metadata", "ConnectorCredential"."metadata"),
      "updatedAt" = NOW()
    RETURNING *`);
  return rows[0];
}

export async function upsertConnection(input: {
  userId: string;
  workspaceId: string | null;
  credentialId: string;
  provider: string;
  product: string;
  accountId: string;
  accountLabel: string;
  scopes: string[];
  config?: Record<string, unknown> | null;
}): Promise<string> {
  const id = newId();
  const rows = await withDbRetry(() => db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "Connection"
      ("id", "userId", "workspaceId", "credentialId", "provider", "product", "externalAccountId", "externalAccountLabel", "scopes", "config", "status", "updatedAt")
    VALUES (${id}, ${input.userId}, ${input.workspaceId}, ${input.credentialId}, ${input.provider}, ${input.product}, ${input.accountId}, ${input.accountLabel}, ${input.scopes.join(" ")}, ${input.config ? JSON.stringify(input.config) : null}::jsonb, 'pending', NOW())
    ON CONFLICT ("userId", "provider", "product") DO UPDATE SET
      "workspaceId" = EXCLUDED."workspaceId",
      "credentialId" = EXCLUDED."credentialId",
      "externalAccountId" = EXCLUDED."externalAccountId",
      "externalAccountLabel" = EXCLUDED."externalAccountLabel",
      "scopes" = EXCLUDED."scopes",
      "config" = EXCLUDED."config",
      "status" = 'pending', "progress" = NULL, "error" = NULL, "errorCode" = NULL, "updatedAt" = NOW()
    RETURNING "id"`);
  return rows[0].id;
}

export async function ownedConnections(userId: string, ids?: string[]): Promise<ConnectionRow[]> {
  if (ids && ids.length === 0) return [];
  const idFilter = ids?.length ? Prisma.sql`AND c."id" IN (${Prisma.join(ids)})` : Prisma.empty;
  return withDbRetry(() => db.$queryRaw<ConnectionRow[]>(Prisma.sql`
    SELECT c.*,
      cr."accessTokenEnc" AS "credentialAccessTokenEnc",
      cr."refreshTokenEnc" AS "credentialRefreshTokenEnc",
      cr."tokenExpiresAt" AS "credentialTokenExpiresAt",
      cr."scopes" AS "credentialScopes",
      cr."metadata" AS "credentialMetadata"
    FROM "Connection" c JOIN "ConnectorCredential" cr ON cr."id" = c."credentialId"
    WHERE c."userId" = ${userId} ${idFilter}
    ORDER BY c."createdAt" ASC`));
}

export async function staleConnections(hours: number): Promise<ConnectionRow[]> {
  return withDbRetry(() => db.$queryRaw<ConnectionRow[]>`
    SELECT c.*,
      cr."accessTokenEnc" AS "credentialAccessTokenEnc",
      cr."refreshTokenEnc" AS "credentialRefreshTokenEnc",
      cr."tokenExpiresAt" AS "credentialTokenExpiresAt",
      cr."scopes" AS "credentialScopes",
      cr."metadata" AS "credentialMetadata"
    FROM "Connection" c JOIN "ConnectorCredential" cr ON cr."id" = c."credentialId"
    WHERE c."externalAccountId" IS NOT NULL
      AND (c."lastSyncAt" IS NULL OR c."lastSyncAt" < NOW() - (${hours} * INTERVAL '1 hour'))
      AND (c."syncStartedAt" IS NULL OR c."syncStartedAt" < NOW() - INTERVAL '20 minutes')
    ORDER BY c."lastSyncAt" ASC NULLS FIRST`);
}

export async function claimSync(id: string): Promise<boolean> {
  const changed = await withDbRetry(() => db.$executeRaw`
    UPDATE "Connection" SET "status" = 'syncing', "syncStartedAt" = NOW(),
      "progress" = ${JSON.stringify({ step: 1, total: 4, label: "Preparing secure connection" })}::jsonb,
      "error" = NULL, "errorCode" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id} AND ("syncStartedAt" IS NULL OR "syncStartedAt" < NOW() - INTERVAL '20 minutes')`);
  return changed === 1;
}

export async function updateProgress(id: string, progress: SyncProgress): Promise<void> {
  await withDbRetry(() => db.$executeRaw`
    UPDATE "Connection" SET "progress" = ${JSON.stringify(progress)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${id}`);
}

export async function refreshCredential(credentialId: string, tokens: TokenSet): Promise<void> {
  const access = encryptSecret(tokens.accessToken);
  const refresh = tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null;
  await withDbRetry(() => db.$executeRaw`
    UPDATE "ConnectorCredential" SET
      "accessTokenEnc" = ${access},
      "refreshTokenEnc" = COALESCE(${refresh}, "refreshTokenEnc"),
      "tokenExpiresAt" = ${tokens.expiresAt},
      "scopes" = CASE WHEN ${tokens.scopes.join(" ")} = '' THEN "scopes" ELSE ${tokens.scopes.join(" ")} END,
      "metadata" = COALESCE(${tokens.metadata ? JSON.stringify(tokens.metadata) : null}::jsonb, "metadata"),
      "updatedAt" = NOW()
    WHERE "id" = ${credentialId}`);
}

export async function replaceMetrics(connection: ConnectionRow, points: MetricPoint[], range: { from: string; to: string }): Promise<void> {
  const clean = points.filter((point) => Number.isFinite(point.value) && /^\d{4}-\d{2}-\d{2}$/.test(point.date));
  const chunks: MetricPoint[][] = [];
  for (let i = 0; i < clean.length; i += 500) chunks.push(clean.slice(i, i + 500));
  // Delete + replace is one transaction so a failed batch never leaves the
  // connection with a partially erased measurement window.
  await withDbRetry(() => db.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "MetricDaily" WHERE "connectionId" = ${connection.id}
        AND "date" BETWEEN ${new Date(`${range.from}T00:00:00Z`)} AND ${new Date(`${range.to}T00:00:00Z`)}`;
    for (const chunk of chunks) {
      if (!chunk.length) continue;
      const values = chunk.map((point) => Prisma.sql`(
        ${connection.id}, ${point.metric}, ${point.dimension ?? ""}, ${point.dimensionValue ?? ""},
        ${new Date(`${point.date}T00:00:00Z`)}, ${point.value}, NOW()
      )`);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "MetricDaily" ("connectionId", "metric", "dimension", "dimensionValue", "date", "value", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("connectionId", "metric", "dimension", "dimensionValue", "date")
        DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`);
    }
  }));
}

export async function finishSync(id: string, range: { from: string; to: string }, rows: number): Promise<void> {
  await withDbRetry(() => db.$executeRaw`
    UPDATE "Connection" SET "status" = 'connected', "lastSyncAt" = NOW(), "syncStartedAt" = NULL,
      "dataFrom" = ${new Date(`${range.from}T00:00:00Z`)}, "dataTo" = ${new Date(`${range.to}T00:00:00Z`)},
      "progress" = ${JSON.stringify({ step: 4, total: 4, label: "Data ready", rows })}::jsonb,
      "error" = NULL, "errorCode" = NULL, "updatedAt" = NOW() WHERE "id" = ${id}`);
}

export async function failSync(id: string, error: string, errorCode: string): Promise<void> {
  await withDbRetry(() => db.$executeRaw`
    UPDATE "Connection" SET "status" = 'error', "syncStartedAt" = NULL, "progress" = NULL,
      "error" = ${error}, "errorCode" = ${errorCode}, "updatedAt" = NOW() WHERE "id" = ${id}`);
}

export async function deleteOwnedConnection(userId: string, id: string): Promise<{ credentialId: string; provider: string; remaining: number } | null> {
  const rows = await withDbRetry(() => db.$queryRaw<Array<{ credentialId: string; provider: string }>>`
    DELETE FROM "Connection" WHERE "id" = ${id} AND "userId" = ${userId} RETURNING "credentialId", "provider"`);
  if (!rows[0]) return null;
  const counts = await withDbRetry(() => db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "Connection" WHERE "credentialId" = ${rows[0].credentialId}`);
  return { credentialId: rows[0].credentialId, provider: rows[0].provider, remaining: Number(counts[0]?.count ?? 0) };
}

export async function deleteCredential(userId: string, credentialId: string): Promise<void> {
  await withDbRetry(() => db.$executeRaw`
    DELETE FROM "ConnectorCredential" WHERE "id" = ${credentialId} AND "userId" = ${userId}`);
}

export async function metricRows(userId: string, workspaceId: string | null, from: string): Promise<MetricRow[]> {
  const workspace = workspaceId ? Prisma.sql`AND c."workspaceId" = ${workspaceId}` : Prisma.empty;
  return withDbRetry(() => db.$queryRaw<MetricRow[]>(Prisma.sql`
    SELECT m."connectionId", c."provider", c."product", c."externalAccountLabel" AS "accountLabel",
      m."metric", m."dimension", m."dimensionValue", m."date", m."value", c."lastSyncAt"
    FROM "MetricDaily" m JOIN "Connection" c ON c."id" = m."connectionId"
    WHERE c."userId" = ${userId} ${workspace}
      AND m."date" >= ${new Date(`${from}T00:00:00Z`)}
    ORDER BY m."date" ASC`));
}
