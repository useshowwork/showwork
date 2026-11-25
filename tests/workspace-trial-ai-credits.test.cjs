const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load-typescript.cjs");

test("Trial 10-credit limit and credit deductions", async () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const trialOwner = {
    id: "trial-creator-1",
    email: "trial@example.com",
    contentWorkspacePlan: "CREATOR",
    contentWorkspaceBillingStatus: "TRIAL",
    contentWorkspaceTrialEndsAt: future,
    isComped: false,
    compedUntil: null,
  };

  let usageRow = {
    creatorId: "trial-creator-1",
    cycleStart: new Date(),
    storageBytes: 0n,
    storageReservedBytes: 0n,
    aiGenerationsUsed: 0,
    aiRegenerationsUsed: 0,
    trialAiCreditsUsed: 0,
  };

  const db = {
    creator: {
      findUnique: async () => ({ ...trialOwner }),
      findUniqueOrThrow: async () => ({ ...trialOwner }),
    },
    contentWorkspaceUsage: {
      upsert: async () => ({ ...usageRow }),
      findUniqueOrThrow: async () => ({ ...usageRow }),
      updateMany: async ({ data, where }) => {
        if (where.trialAiCreditsUsed?.lte !== undefined) {
          if (usageRow.trialAiCreditsUsed > where.trialAiCreditsUsed.lte) return { count: 0 };
        }
        if (data.trialAiCreditsUsed?.increment) {
          usageRow.trialAiCreditsUsed += data.trialAiCreditsUsed.increment;
        }
        if (data.trialAiCreditsUsed?.decrement) {
          usageRow.trialAiCreditsUsed = Math.max(0, usageRow.trialAiCreditsUsed - data.trialAiCreditsUsed.decrement);
        }
        if (data.aiGenerationsUsed?.increment) {
          usageRow.aiGenerationsUsed += data.aiGenerationsUsed.increment;
        }
        if (data.aiGenerationsUsed?.decrement) {
          usageRow.aiGenerationsUsed = Math.max(0, usageRow.aiGenerationsUsed - data.aiGenerationsUsed.decrement);
        }
        return { count: 1 };
      },
    },
  };

  const usageModule = load("lib/contentWorkspaceUsage.ts", { "@/lib/db": { db } });

  // 1. Single draft consumes 1 credit
  const draftRes = await usageModule.consumeAiGeneration("trial-creator-1", 1);
  assert.equal(draftRes.allowed, true);
  assert.equal(draftRes.isTrial, true);
  assert.equal(draftRes.used, 1);
  assert.equal(draftRes.limit, 10);
  assert.equal(draftRes.remaining, 9);

  // 2. Short content plan consumes 3 credits
  const planRes = await usageModule.consumeAiGeneration("trial-creator-1", 3);
  assert.equal(planRes.allowed, true);
  assert.equal(planRes.isTrial, true);
  assert.equal(planRes.used, 4);
  assert.equal(planRes.remaining, 6);

  // 3. Another 3-credit plan
  await usageModule.consumeAiGeneration("trial-creator-1", 3);
  assert.equal(usageRow.trialAiCreditsUsed, 7);

  // 4. Another 3-credit plan reaches 10
  const finalAllowed = await usageModule.consumeAiGeneration("trial-creator-1", 3);
  assert.equal(finalAllowed.allowed, true);
  assert.equal(finalAllowed.used, 10);
  assert.equal(finalAllowed.remaining, 0);

  // 5. Subsequent generation over 10 credits is blocked
  const blocked = await usageModule.consumeAiGeneration("trial-creator-1", 1);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.isTrial, true);
  assert.equal(blocked.remaining, 0);

  // 6. Refunding restores credits
  await usageModule.refundAiGeneration("trial-creator-1", 1);
  assert.equal(usageRow.trialAiCreditsUsed, 9);
  const retryDraft = await usageModule.consumeAiGeneration("trial-creator-1", 1);
  assert.equal(retryDraft.allowed, true);
  assert.equal(usageRow.trialAiCreditsUsed, 10);

  // 7. Payment confirmed: allowance starts completely fresh
  trialOwner.contentWorkspaceBillingStatus = "ACTIVE";
  trialOwner.contentWorkspaceTrialEndsAt = null;
  // Mock resetPaidContentWorkspaceAllowance
  usageRow.aiGenerationsUsed = 0;
  usageRow.aiRegenerationsUsed = 0;
  usageRow.cycleStart = new Date();

  // Paid user consumes according to plan limit, not trial
  const paidRes = await usageModule.consumeAiGeneration("trial-creator-1", 1);
  assert.equal(paidRes.allowed, true);
  assert.equal(paidRes.isTrial, false);
  assert.equal(paidRes.used, 1);
});
