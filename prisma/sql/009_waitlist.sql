-- Public early-access waitlist submissions.
-- Additive and safe to re-run; no user accounts or existing tables are changed.

CREATE TABLE IF NOT EXISTS "WaitlistSignup" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "businessName" TEXT,
  "industry" TEXT,
  "specialty" TEXT,
  "experience" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "WaitlistSignup_audience_check"
    CHECK ("audience" IN ('business', 'specialist')),
  CONSTRAINT "WaitlistSignup_audience_fields_check"
    CHECK (
      ("audience" = 'business'
        AND "businessName" IS NOT NULL AND "industry" IS NOT NULL
        AND "specialty" IS NULL AND "experience" IS NULL)
      OR
      ("audience" = 'specialist'
        AND "specialty" IS NOT NULL AND "experience" IS NOT NULL
        AND "experience" IN ('Less than 1 year', '1–3 years', '4–7 years', '8+ years')
        AND "businessName" IS NULL AND "industry" IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistSignup_email_lower_key"
  ON "WaitlistSignup" (lower("email"));

CREATE INDEX IF NOT EXISTS "WaitlistSignup_audience_createdAt_idx"
  ON "WaitlistSignup" ("audience", "createdAt" DESC);
