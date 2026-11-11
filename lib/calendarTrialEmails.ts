/** Retired: trial reminders must not create a separate promotional email drip.
 * Keep this entrypoint safe for existing scheduler deployments during rollout.
 * Trial dates and access notices remain visible in the product.
 */
export async function runCalendarTrialEmailCheck() {
  return {
    checked: 0, twoDaysLeftSent: 0, followUpSent: 0,
    endsTodaySent: 0, endedSent: 0, errors: 0,
    disabled: true, reason: "Replaced by the weekly Marketing Workspace email.",
  };
}
