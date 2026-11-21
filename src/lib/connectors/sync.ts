import { decryptSecret } from "./crypto";
import { connectorById } from "./registry";
import {
  claimSync,
  failSync,
  finishSync,
  refreshCredential,
  replaceMetrics,
  staleConnections,
  updateProgress,
  type CredentialRow,
  type ConnectionRow,
} from "./store";
import { ConnectorError, type OAuth2Connector } from "./types";

const DEFAULT_STALE_HOURS = 24;

function daysBefore(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function accessTokenForCredential(credential: CredentialRow): Promise<string> {
  const connector = connectorById(credential.provider);
  if (!connector || connector.authType !== "oauth2") throw new ConnectorError("bad_request", "This connector is not available.");
  const encryptedAccess = credential.accessTokenEnc;
  if (!encryptedAccess) throw new ConnectorError("reauth", "The saved authorization is incomplete. Reconnect the source.");
  const expiresAt = credential.tokenExpiresAt?.getTime() ?? null;
  // A null expiry is how providers represent a long-lived token that remains
  // valid until revoked. Expiring tokens are refreshed one minute early.
  if (expiresAt === null || expiresAt > Date.now() + 60_000) return decryptSecret(encryptedAccess);

  const encryptedRefresh = credential.refreshTokenEnc;
  if (!encryptedRefresh) throw new ConnectorError("reauth", `${connector.name} needs to be reconnected before it can sync again.`);
  const metadata = credential.metadata && typeof credential.metadata === "object" ? credential.metadata as Record<string, unknown> : null;
  const tokens = await (connector as OAuth2Connector).refresh(decryptSecret(encryptedRefresh), metadata);
  await refreshCredential(credential.id, tokens);
  return tokens.accessToken;
}

async function accessTokenFor(row: ConnectionRow): Promise<string> {
  return accessTokenForCredential({
    id: row.credentialId,
    userId: row.userId,
    provider: row.provider,
    accessTokenEnc: row.credentialAccessTokenEnc ?? "",
    refreshTokenEnc: row.credentialRefreshTokenEnc ?? null,
    tokenExpiresAt: row.credentialTokenExpiresAt ?? null,
    scopes: row.credentialScopes ?? "",
    metadata: row.credentialMetadata ?? null,
  });
}

async function syncOne(row: ConnectionRow, tokenCache: Map<string, string>): Promise<{ id: string; ok: boolean; error?: string }> {
  if (!row.externalAccountId) return { id: row.id, ok: false, error: "No account selected" };
  const claimed = await claimSync(row.id);
  if (!claimed) return { id: row.id, ok: false, error: "A sync is already running" };

  try {
    const connector = connectorById(row.provider);
    if (!connector) throw new ConnectorError("bad_request", "This connector is not available.");
    let accessToken = tokenCache.get(row.credentialId);
    if (!accessToken) {
      accessToken = await accessTokenFor(row);
      tokenCache.set(row.credentialId, accessToken);
    }
    const to = connector.latestDate(row.product, new Date());
    const range = { from: daysBefore(to, connector.backfillDays - 1), to };
    const points = await connector.sync({
      accessToken,
      product: row.product,
      account: { id: row.externalAccountId, label: row.externalAccountLabel, config: row.config && typeof row.config === "object" ? row.config as Record<string, unknown> : null },
      range,
      progress: (progress) => updateProgress(row.id, progress),
    });
    await updateProgress(row.id, { step: 3, total: 4, label: "Saving measured data", rows: points.length });
    await replaceMetrics(row, points, range);
    await finishSync(row.id, range, points.length);
    return { id: row.id, ok: true };
  } catch (error) {
    const connectorError = error instanceof ConnectorError ? error : new ConnectorError("upstream", "This source could not be synced. Try again.", String(error));
    await failSync(row.id, connectorError.message, connectorError.code);
    console.error(`[connectors] ${row.provider}/${row.product} sync failed: ${connectorError.code}`, connectorError.detail ?? "");
    return { id: row.id, ok: false, error: connectorError.message };
  }
}

export async function syncConnectionRows(rows: ConnectionRow[]) {
  const tokenCache = new Map<string, string>();
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  // Sequential by design: products sharing one OAuth credential must not race
  // a refresh-token rotation. Each product sync is only a handful of API calls.
  for (const row of rows) results.push(await syncOne(row, tokenCache));
  return results;
}

export async function syncAllStale(staleHours = DEFAULT_STALE_HOURS) {
  return syncConnectionRows(await staleConnections(staleHours));
}
