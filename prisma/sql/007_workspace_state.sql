-- An owner's workspace data saved on their account (WorkspaceState): challenges,
-- coaching steps and check-ins, actions and experiments, Ask history, entered
-- totals, AI insights, the checkup and settings. The app keeps working from the
-- browser's copy; this one makes it survive a cleared browser, an app update,
-- another browser or a new device (src/lib/workspace-sync.ts,
-- src/app/api/workspace-state/route.ts).
--
-- "doc" is JSON text: separately versioned entries (one per challenge, step,
-- action, ...) merged entry by entry, newest change first; deletions are kept
-- as markers so an older copy can't bring an item back.
--
-- Additive + idempotent: safe to re-run. It only CREATES this one table and its
-- index; it never alters or drops anything that exists.
-- Apply:  node_modules/.bin/prisma db execute --file prisma/sql/007_workspace_state.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "WorkspaceState" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    -- The workspace name as a key (lowercase, dashes): the same business set up
    -- again under a new workspace id brings its data along.
    "workspaceSlug" TEXT NOT NULL,
    "doc" TEXT NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceState_pkey" PRIMARY KEY ("userId", "workspaceId"),
    CONSTRAINT "WorkspaceState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkspaceState_userId_workspaceSlug_idx" ON "WorkspaceState"("userId", "workspaceSlug");
