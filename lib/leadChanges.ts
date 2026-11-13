const STORAGE_KEY = "showwork-leads-changed";
const EVENT = "showwork-inbox-leads-updated";
/** Broadcast only a workspace identifier, never lead contact data. */
export function announceLeadChange(calendarId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT,{detail:{calendarId}}));
  try { window.localStorage.setItem(STORAGE_KEY,JSON.stringify({calendarId,at:Date.now(),nonce:Math.random()})); } catch { /* Same-tab updates still work without storage. */ }
}
export function subscribeLeadChanges(calendarId: string | undefined, onChange: () => void) {
  const notify=(id:unknown)=>{if(typeof id === "string" && (!calendarId || id===calendarId))onChange();};
  const local=(event:Event)=>notify((event as CustomEvent).detail?.calendarId);
  const storage=(event:StorageEvent)=>{
    if(event.key!==STORAGE_KEY || !event.newValue)return;
    try {notify(JSON.parse(event.newValue).calendarId);} catch { /* Ignore unrelated or malformed values. */ }
  };
  window.addEventListener(EVENT,local);window.addEventListener("storage",storage);
  return ()=>{window.removeEventListener(EVENT,local);window.removeEventListener("storage",storage);};
}
