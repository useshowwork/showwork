-- Keep the previous migration intact for databases that already applied it.
-- Earlier trial generations and regenerations shared the legacy counter.
UPDATE "ContentWorkspaceUsage" AS usage
SET "trialAiCreditsUsed" = GREATEST(usage."trialAiCreditsUsed", usage."aiGenerationsUsed"),
    "aiGenerationsUsed" = 0,
    "aiRegenerationsUsed" = 0
FROM "Creator" AS owner
WHERE usage."creatorId" = owner.id
  AND owner."contentWorkspaceBillingStatus" = 'TRIAL'
  AND usage."aiGenerationsUsed" > 0;
