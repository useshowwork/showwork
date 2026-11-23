/** Retain the scheduler entrypoint so older schedules can call it safely. */
export async function runLifecycleEmailCheck() {
  return { processed: 0, weeklyMarketingSent: 0, skipped: 0, failed: 0, disabled: true };
}
