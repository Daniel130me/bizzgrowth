-- Production marketplace foundations.
--
-- This migration is additive because the shared Neon database contains tables
-- outside Prisma's partial schema. Run it with the same controlled SQL process
-- used for the other files in prisma/sql; do not use `prisma db push`.

ALTER TABLE "Specialist"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewNote" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- The original roster columns were required without database defaults. Draft
-- accounts are intentionally sparse, so defaults must exist in PostgreSQL as
-- well as in Prisma for sign-up to remain safe across all write paths.
ALTER TABLE "Specialist"
  ALTER COLUMN "headline" SET DEFAULT '',
  ALTER COLUMN "category" SET DEFAULT '',
  ALTER COLUMN "skills" SET DEFAULT '[]',
  ALTER COLUMN "hourlyRate" SET DEFAULT 0,
  ALTER COLUMN "rating" SET DEFAULT 0,
  ALTER COLUMN "reviews" SET DEFAULT 0,
  ALTER COLUMN "completedJobs" SET DEFAULT 0,
  ALTER COLUMN "responseTime" SET DEFAULT 'Within 1 business day',
  ALTER COLUMN "location" SET DEFAULT '',
  ALTER COLUMN "languages" SET DEFAULT '[]',
  ALTER COLUMN "bio" SET DEFAULT '',
  ALTER COLUMN "portfolio" SET DEFAULT '[]',
  ALTER COLUMN "badges" SET DEFAULT '[]',
  ALTER COLUMN "available" SET DEFAULT 'Unavailable',
  ALTER COLUMN "verified" SET DEFAULT FALSE;

-- Existing seeded specialists were already presented as vetted. Preserve that
-- state while all newly-created specialist accounts begin as drafts.
UPDATE "Specialist"
SET "status" = 'approved', "reviewedAt" = COALESCE("reviewedAt", CURRENT_TIMESTAMP)
WHERE "userId" IS NULL AND "verified" = TRUE AND "status" = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS "Specialist_userId_key" ON "Specialist"("userId");
CREATE INDEX IF NOT EXISTS "Specialist_status_category_verified_idx" ON "Specialist"("status", "category", "verified");
CREATE INDEX IF NOT EXISTS "Specialist_category_rating_idx" ON "Specialist"("category", "rating" DESC);

ALTER TABLE "MarketBid"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketBid_taskId_specialistId_key" ON "MarketBid"("taskId", "specialistId");
CREATE INDEX IF NOT EXISTS "MarketBid_taskId_status_createdAt_idx" ON "MarketBid"("taskId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketBid_specialistId_status_createdAt_idx" ON "MarketBid"("specialistId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketTask_workspaceId_createdAt_idx" ON "MarketTask"("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketTask_workspaceId_status_createdAt_idx" ON "MarketTask"("workspaceId", "status", "createdAt" DESC);

-- Remove an invalid legacy pointer before introducing the foreign key.
UPDATE "MarketTask" t
SET "awardedBidId" = NULL
WHERE "awardedBidId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "MarketBid" b WHERE b."id" = t."awardedBidId" AND b."taskId" = t."id");

CREATE UNIQUE INDEX IF NOT EXISTS "MarketTask_awardedBidId_key" ON "MarketTask"("awardedBidId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Specialist_userId_fkey') THEN
    ALTER TABLE "Specialist" ADD CONSTRAINT "Specialist_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarketTask_awardedBidId_fkey') THEN
    ALTER TABLE "MarketTask" ADD CONSTRAINT "MarketTask_awardedBidId_fkey"
      FOREIGN KEY ("awardedBidId") REFERENCES "MarketBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MarketInvitation" (
  "id" TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES "MarketTask"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "specialistId" TEXT NOT NULL REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "message" TEXT,
  "expiresAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketInvitation_taskId_specialistId_key" ON "MarketInvitation"("taskId", "specialistId");
CREATE INDEX IF NOT EXISTS "MarketInvitation_specialistId_status_createdAt_idx" ON "MarketInvitation"("specialistId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketInvitation_taskId_status_idx" ON "MarketInvitation"("taskId", "status");

CREATE TABLE IF NOT EXISTS "MarketEngagement" (
  "id" TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL UNIQUE REFERENCES "MarketTask"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "bidId" TEXT NOT NULL UNIQUE REFERENCES "MarketBid"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "specialistId" TEXT NOT NULL REFERENCES "Specialist"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'awarded',
  "agreedAmount" INTEGER NOT NULL,
  "deliveryDays" INTEGER NOT NULL,
  "scope" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL DEFAULT 'external',
  "startedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "disputeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketEngagement_workspaceId_status_updatedAt_idx" ON "MarketEngagement"("workspaceId", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketEngagement_specialistId_status_updatedAt_idx" ON "MarketEngagement"("specialistId", "status", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "MarketMessage" (
  "id" TEXT PRIMARY KEY,
  "engagementId" TEXT NOT NULL REFERENCES "MarketEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "senderUserId" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketMessage_engagementId_createdAt_idx" ON "MarketMessage"("engagementId", "createdAt");

CREATE TABLE IF NOT EXISTS "MarketReview" (
  "id" TEXT PRIMARY KEY,
  "engagementId" TEXT NOT NULL REFERENCES "MarketEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reviewerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "revieweeSpecialistId" TEXT NOT NULL REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketReview_engagementId_reviewerUserId_key" ON "MarketReview"("engagementId", "reviewerUserId");
CREATE INDEX IF NOT EXISTS "MarketReview_revieweeSpecialistId_createdAt_idx" ON "MarketReview"("revieweeSpecialistId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "MarketNotification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketNotification_userId_readAt_createdAt_idx" ON "MarketNotification"("userId", "readAt", "createdAt" DESC);
