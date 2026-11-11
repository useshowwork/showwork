/** Optional legacy anchor backfill. Does not send email.
 * New promotional messages are weekly and Marketing Workspace only.
 * Run with: npx tsx scripts/backfill-lifecycle-sequence.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const result = await db.creator.updateMany({
    where: { lifecycleSequenceStartedAt: null },
    data: { lifecycleSequenceStartedAt: new Date() },
  });

  console.log(`Backfilled ${result.count} creator(s) — their weekly campaign anchor starts from today.`);
  console.log("No welcome or catch-up email will be sent. The weekly campaign respects a seven-day cooldown.");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());