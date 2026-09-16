BEGIN;
SET search_path=public;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DSQDraftStatus" AS ENUM ('GENERATING', 'PENDING_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SENT', 'FAILED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "DSQDraftPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "DSQDraftEditType" AS ENUM ('AI_GENERATED', 'AGENT_EDIT', 'REGENERATE', 'TONE_CHANGE', 'AUTO_SAVE');

-- CreateTable
CREATE TABLE "dsq_drafts" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "ticketSubject" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "originalContent" TEXT NOT NULL,
    "draftContent" TEXT NOT NULL,
    "finalContent" TEXT,
    "status" "DSQDraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT,
    "priority" "DSQDraftPriority" NOT NULL DEFAULT 'MEDIUM',
    "sentiment" TEXT,
    "complexity" TEXT,
    "tone" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "assignedAgentId" TEXT,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "kbArticlesUsed" TEXT[],
    "sourcesUsed" JSONB,
    "modelVersion" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsq_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsq_draft_versions" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "editedBy" TEXT,
    "editedByName" TEXT,
    "editType" "DSQDraftEditType" NOT NULL DEFAULT 'AI_GENERATED',
    "editSummary" TEXT,
    "editDistance" INTEGER,
    "changePercent" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "tone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dsq_draft_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsq_draft_analytics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "draftsGenerated" INTEGER NOT NULL DEFAULT 0,
    "draftsApproved" INTEGER NOT NULL DEFAULT 0,
    "draftsRejected" INTEGER NOT NULL DEFAULT 0,
    "draftsSent" INTEGER NOT NULL DEFAULT 0,
    "avgConfidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgEditDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgReviewTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgTimeToSend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsq_draft_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dsq_drafts_draftId_key" ON "dsq_drafts"("draftId");

-- CreateIndex
CREATE INDEX "dsq_drafts_draftId_idx" ON "dsq_drafts"("draftId");

-- CreateIndex
CREATE INDEX "dsq_drafts_ticketId_idx" ON "dsq_drafts"("ticketId");

-- CreateIndex
CREATE INDEX "dsq_drafts_status_idx" ON "dsq_drafts"("status");

-- CreateIndex
CREATE INDEX "dsq_drafts_assignedAgentId_idx" ON "dsq_drafts"("assignedAgentId");

-- CreateIndex
CREATE INDEX "dsq_drafts_confidenceScore_idx" ON "dsq_drafts"("confidenceScore");

-- CreateIndex
CREATE INDEX "dsq_draft_versions_draftId_idx" ON "dsq_draft_versions"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "dsq_draft_versions_draftId_version_key" ON "dsq_draft_versions"("draftId", "version");

-- CreateIndex
CREATE INDEX "dsq_draft_analytics_date_idx" ON "dsq_draft_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "dsq_draft_analytics_date_category_key" ON "dsq_draft_analytics"("date", "category");

-- AddForeignKey
ALTER TABLE "dsq_draft_versions" ADD CONSTRAINT "dsq_draft_versions_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "dsq_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dsq_runtime') THEN
 CREATE ROLE dsq_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
END IF; END $$;
GRANT USAGE ON SCHEMA public TO dsq_runtime;
GRANT SELECT (id,clerk_id,role) ON public.users TO dsq_runtime;
GRANT SELECT (id,code) ON public.projects TO dsq_runtime;
GRANT SELECT (user_id,project_id,role) ON public.user_project_access TO dsq_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.dsq_drafts,public.dsq_draft_versions,public.dsq_draft_analytics TO dsq_runtime;
ALTER TABLE public.dsq_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsq_draft_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsq_draft_analytics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dsq_drafts,public.dsq_draft_versions,public.dsq_draft_analytics FROM anon,authenticated,PUBLIC;
CREATE POLICY dsq_server_runtime ON public.dsq_drafts TO dsq_runtime USING (true) WITH CHECK (true);
CREATE POLICY dsq_server_runtime ON public.dsq_draft_versions TO dsq_runtime USING (true) WITH CHECK (true);
CREATE POLICY dsq_server_runtime ON public.dsq_draft_analytics TO dsq_runtime USING (true) WITH CHECK (true);
COMMIT;
