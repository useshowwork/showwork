/** Only workspace identity is broadcast; no tokens, account data or metrics. */
export function notifyReportingChannelChange(calendarId: string) {
  window.dispatchEvent(new CustomEvent("showwork-reporting-channels-changed", { detail: { calendarId } }));
  try { window.localStorage.setItem("showwork-reporting-channel-change", JSON.stringify({ calendarId, at: Date.now() })); } catch { /* Private browsing can disable storage; focus refresh still works. */ }
}
