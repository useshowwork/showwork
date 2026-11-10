/** Only workspace identity is broadcast; no tokens, account data or metrics. */
export function notifyReportingChannelChange(calendarId: string) {
  window.dispatchEvent(new CustomEvent("showwork-reporting-channels-changed", { detail: { calendarId } }));
  try { window.localStorage.setItem("showwork-reporting-channel-change", JSON.stringify({ calendarId, at: Date.now() })); } catch { /* Private browsing can disable storage; focus refresh still works. */ }
}

/** Shared by workspace views that must invalidate data after account changes. */
export function subscribeChannelChanges(calendarId: string, refresh: () => void) {
  const local = (event: Event) => {
    if ((event as CustomEvent<{ calendarId: string }>).detail?.calendarId === calendarId) refresh();
  };
  const storage = (event: StorageEvent) => {
    if (event.key !== "showwork-reporting-channel-change" || !event.newValue) return;
    try { if (JSON.parse(event.newValue).calendarId === calendarId) refresh(); } catch { /* Ignore invalid cross-tab data. */ }
  };
  window.addEventListener("showwork-reporting-channels-changed", local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("showwork-reporting-channels-changed", local);
    window.removeEventListener("storage", storage);
  };
}
