BEGIN;

ALTER TABLE "ContentWorkspaceUsage" ADD COLUMN "trialAiCreditsUsed" INTEGER NOT NULL DEFAULT 0;

-- Earlier regenerations already incremented the generation counter.
UPDATE "ContentWorkspaceUsage" AS usage
SET "trialAiCreditsUsed" = usage."aiGenerationsUsed",
    "aiGenerationsUsed" = 0,
    "aiRegenerationsUsed" = 0
FROM "Creator" AS owner
WHERE usage."creatorId" = owner.id
  AND owner."contentWorkspaceBillingStatus" = 'TRIAL';

COMMIT;
