-- Third-party data connections: ConnectorCredential, Connection,
-- MetricDaily, IntegrationInterest.
-- Additive + idempotent: safe to re-run. It only CREATES these four tables and
-- their indexes; it never alters existing Neon tables (User, Workspace, the older
-- WorkspaceConnection table, ...).
-- Access and refresh tokens are stored ENCRYPTED (AES-256-GCM with the key in
-- CONNECTIONS_ENCRYPTION_KEY) — never in plain text. See src/lib/connectors/.
-- Apply:  node_modules/.bin/prisma db execute --file prisma/sql/003_connections.sql --schema prisma/schema.prisma

-- One encrypted credential per user/provider. Product connections refer to it,
-- so one Google sign-in can power Search Console and Analytics without copying
-- refresh tokens into several rows.
CREATE TABLE IF NOT EXISTS "ConnectorCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConnectorCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConnectorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectorCredential_userId_provider_key" ON "ConnectorCredential"("userId", "provider");

-- One row per selected product. Credentials are kept in ConnectorCredential.
CREATE TABLE IF NOT EXISTS "Connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "credentialId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalAccountLabel" TEXT,
    "config" JSONB,
    "scopes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" JSONB,
    "error" TEXT,
    "errorCode" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "dataFrom" DATE,
    "dataTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ConnectorCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Connection_userId_provider_product_key" ON "Connection"("userId", "provider", "product");
CREATE INDEX IF NOT EXISTS "Connection_credentialId_idx" ON "Connection"("credentialId");
CREATE INDEX IF NOT EXISTS "Connection_status_lastSyncAt_idx" ON "Connection"("status", "lastSyncAt");

-- Normalized daily numbers. dimension '' = the day's total; otherwise e.g.
-- 'query', 'page', 'channel' with the value in dimensionValue.
CREATE TABLE IF NOT EXISTS "MetricDaily" (
    "connectionId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "dimensionValue" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricDaily_pkey" PRIMARY KEY ("connectionId", "metric", "dimension", "dimensionValue", "date"),
    CONSTRAINT "MetricDaily_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MetricDaily_connectionId_date_idx" ON "MetricDaily"("connectionId", "date");

-- "I use this" on a platform that is not connectable yet.
CREATE TABLE IF NOT EXISTS "IntegrationInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationInterest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntegrationInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationInterest_userId_platform_key" ON "IntegrationInterest"("userId", "platform");
CREATE INDEX IF NOT EXISTS "IntegrationInterest_platform_idx" ON "IntegrationInterest"("platform");
