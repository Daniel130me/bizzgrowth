-- Provider identifiers returned during OAuth (for example TikTok advertiser ids,
-- TikTok open ids, and Shopify shop domains). No token or secret belongs here.
-- Additive + idempotent; existing credential rows remain unchanged.
ALTER TABLE "ConnectorCredential" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
