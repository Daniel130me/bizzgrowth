-- Chat conversation log tables (ChatConversation, ChatMessage).
-- Additive + idempotent: safe to re-run. Generated from prisma/schema.prisma with
-- `prisma migrate diff --from-empty`, then made IF NOT EXISTS.
-- It only CREATES the two chat tables; it never touches existing Neon tables.
-- Apply:  npx prisma db execute --file prisma/sql/001_chat_log.sql --schema prisma/schema.prisma

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatConversation" (
    "id" TEXT NOT NULL,
    "chatType" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "clientId" TEXT,
    "workspaceId" TEXT,
    "workspaceName" TEXT,
    "country" TEXT,
    "phase" TEXT,
    "slots" JSONB,
    "facts" JSONB,
    "meta" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'live',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "meta" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatConversation_chatType_updatedAt_idx" ON "ChatConversation"("chatType", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatConversation_workspaceId_idx" ON "ChatConversation"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatConversation_clientId_idx" ON "ChatConversation"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessage_conversationId_seq_key" ON "ChatMessage"("conversationId", "seq");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_conversationId_fkey') THEN
    ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
