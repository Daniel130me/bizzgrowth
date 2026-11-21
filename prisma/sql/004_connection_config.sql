-- Product-specific, non-secret connector configuration.
-- Additive + idempotent: does not rewrite existing connection rows.
-- Apply only after prisma/sql/003_connections.sql.
ALTER TABLE "Connection" ADD COLUMN IF NOT EXISTS "config" JSONB;
