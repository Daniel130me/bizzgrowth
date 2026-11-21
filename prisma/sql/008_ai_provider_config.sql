-- Administrator-managed AI provider configuration.
-- Additive and safe to re-run. API keys are encrypted before insertion; this
-- table never stores plaintext credentials.

CREATE TABLE IF NOT EXISTS "AiProviderConfig" (
  "provider" TEXT PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "model" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AiProviderCredential" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL REFERENCES "AiProviderConfig"("provider") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "secretEnc" TEXT NOT NULL,
  "lastFour" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AiProviderCredential_provider_label_key" UNIQUE ("provider", "label")
);

CREATE INDEX IF NOT EXISTS "AiProviderCredential_provider_enabled_idx"
  ON "AiProviderCredential" ("provider", "enabled");

CREATE TABLE IF NOT EXISTS "AiProviderAuditEvent" (
  "id" TEXT PRIMARY KEY,
  "adminUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "credentialId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "AiProviderAuditEvent_provider_createdAt_idx"
  ON "AiProviderAuditEvent" ("provider", "createdAt" DESC);
