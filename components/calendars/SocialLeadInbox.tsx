"use client";
import { formatInboxReply } from "@/lib/socialMessaging/replyFormatting";
import { calendarMutationFetch, clearCheckedInboxReply } from "@/lib/publishing/clientRequests";

import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import styles from "./SocialLeadInbox.module.css";
import PlatformBrandIcon from "./PlatformBrandIcon";
import type { InboxBusinessKnowledge } from "./CustomerCareSettings";
import InboxSetupPanel from "./InboxSetupPanel";
import ReplyDraftAssistant from "./ReplyDraftAssistant";
import { normalizeReplyProfile, type ReplyProfile } from "@/lib/socialMessaging/replyProfile";
import XChatInbox, { type XChatInboxState } from "./XChatInbox";
import { mergeInboxConversations, resolveSelectedInboxConversation, type UnifiedInboxConversation } from "@/lib/xChat/inbox";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, LockKeyhole, ChevronDown, BellRing, UserRound, Bot, AlertCircle, ArrowLeft, ArrowUpRight, Check, Inbox, MessageSquareText, RefreshCw, Search, Send, Settings2, Sparkles, SlidersHorizontal, X } from "lucide-react";

const PLATFORMS: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok", LINKEDIN: "LinkedIn", X: "X", YOUTUBE: "YouTube", WHATSAPP: "WhatsApp" };
const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CUSTOMER", "NOT_A_LEAD"] as const;
type Conversation = UnifiedInboxConversation;
type InboxData = {
  summary: { needsAttention?: number; leads: number; newMessages: number; messagesThisMonth: number; allMessages: number };
  accounts: Array<{ id: string; platform: string; accountName: string | null; username: string | null; status: string; messagingAvailable: boolean; messagingNote: string }>;
  settings: { clientAccessEnabled: boolean; aiAutoReplyEnabled: boolean; aiAutoReplyInstructions: string | null; aiReplyProfile: ReplyProfile };
  conversations: Conversation[];
};

const contactName = (conversation: Conversation) => conversation.participantName || conversation.participantUsername || `${PLATFORMS[conversation.platform] || conversation.platform} contact`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const dayLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function SocialLeadInbox({ calendarId, slug, clientMode = false, isManager = false, canReplyFromWorkspace = false, inboxAccess = true, autoRepliesAccess = true, isOwner = false, canManageLeads = true, canViewChannels = true, businessKnowledge }: { calendarId?: string; slug?: string; clientMode?: boolean; isManager?: boolean; canReplyFromWorkspace?: boolean; inboxAccess?: boolean; autoRepliesAccess?: boolean; businessKnowledge?: InboxBusinessKnowledge; isOwner?: boolean; canManageLeads?: boolean; canViewChannels?: boolean }) {
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [xChats, setXChats] = useState<Record<string, XChatInboxState>>({});
  const updateXChat = useCallback((connectionId: string, state: XChatInboxState | null) => {
    setXChats(current => {
      if (state) return { ...current, [connectionId]: state };
      if (!current[connectionId]) return current;
      const next = { ...current }; delete next[connectionId]; return next;
    });
  }, []);
  const [data, setData] = useState<InboxData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [changingControl, setChangingControl] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = drafts[selectedId] || "";
  const setDraft = useCallback((value: string) => setDrafts(current => ({ ...current, [selectedId]: value })), [selectedId]);
  const [pinnedConversation, setPinnedConversation] = useState<Conversation | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [panel, setPanel] = useState<"settings" | "channels" | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const channelsButtonRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const lastThreadRef = useRef("");
  const nearBottomRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const endpoint = clientMode ? `/api/social-calendar/${encodeURIComponent(slug || "")}/inbox` : `/api/calendars/${encodeURIComponent(calendarId || "")}/inbox`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setData(null); setSelectedId(params.get("conversation") || ""); setPinnedConversation(null); setDrafts({});
    setMobileChatOpen(false); setError(""); setSuccess("");
    setPlatform(""); setStatus(""); setSearch(""); setUnreadOnly(false); setAttentionOnly(params.get("attention") === "true");
    if (params.get("conversation")) setMobileChatOpen(true);
    lastThreadRef.current = "";
  }, [endpoint]);

  const load = useCallback(async (quiet = false) => {
    // Background refreshes must not cancel a slower request before it finishes.
    if (quiet && requestRef.current) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (!quiet) setLoading(true);
    try {
      const query = new URLSearchParams();
      const linkedConversation = new URLSearchParams(window.location.search).get("conversation");
      if (linkedConversation) query.set("conversation", linkedConversation);
      if (platform) query.set("platform", platform);
      if (status) query.set("status", status);
      if (search.trim()) query.set("q", search.trim());
      if (unreadOnly) query.set("unread", "true");
      if (attentionOnly && !clientMode) query.set("attention", "true");
      const response = await calendarMutationFetch(`${endpoint}?${query}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load the inbox.");
      if (controller.signal.aborted) return;
      setData(result);
      setSelectedId(current => current || result.conversations[0]?.id || "");
      if (!quiet) setError("");
    } catch (err) { if (!controller.signal.aborted && !quiet) setError(err instanceof Error ? err.message : "Could not load the inbox."); }
    finally { if (requestRef.current === controller) { requestRef.current = null; setLoading(false); } }
  }, [endpoint, platform, status, search, unreadOnly, attentionOnly, clientMode]);

  const latestLoadRef = useRef(load);
  useEffect(() => { latestLoadRef.current = load; }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, [load, search]);
  useEffect(() => {
    const refresh = () => { void load(true); };
    window.addEventListener("showwork-inbox-leads-updated", refresh);
    return () => window.removeEventListener("showwork-inbox-leads-updated", refresh);
  }, [load]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void load(true); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const encryptedConversations = useMemo(() => Object.entries(xChats)
    .filter(([id]) => data?.accounts.some(account => account.id === id && account.status === "CONNECTED"))
    .flatMap(([, state]) => state.conversations), [data?.accounts, xChats]);
  const conversations = useMemo(() => mergeInboxConversations(data?.conversations || [], attentionOnly ? [] : encryptedConversations,
    { platform, status, search, unreadOnly }), [data, encryptedConversations, platform, status, search, unreadOnly, attentionOnly]);
  const selected = resolveSelectedInboxConversation([...conversations, ...encryptedConversations], selectedId, pinnedConversation);
  useEffect(() => {
    const match = data?.conversations.find(item => item.id === selectedId);
    if (match && !match.encrypted) setPinnedConversation(match);
  }, [data, selectedId]);
  const selectedX = selected?.encrypted ? xChats[selected.encrypted.connectionId] : undefined;
  const messageCount = selected?.messages.length || 0;
  const lastMessageId = selected?.messages.at(-1)?.id;
  useEffect(() => {
    const element = historyRef.current;
    if (!element) return;
    if (lastThreadRef.current !== selectedId || nearBottomRef.current) element.scrollTop = element.scrollHeight;
    lastThreadRef.current = selectedId;
  }, [selectedId, messageCount, lastMessageId, mobileChatOpen]);
  useEffect(() => {
    // Encrypted reply drafts leave memory when X is locked or the workspace changes.
    const clearPrivateDrafts = () => setDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith("xchat:"))));
    const hidden = () => { if (document.hidden) clearPrivateDrafts(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", clearPrivateDrafts);
    return () => { document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", clearPrivateDrafts); };
  }, []);
  useEffect(() => {
    setDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith("xchat:") || encryptedConversations.some(item => item.id === id))));
  }, [encryptedConversations]);


  const hasData = Boolean(data);
  useEffect(() => {
    if (!panel || !hasData || !panelRef.current) return;
    const element = panelRef.current;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [panel, hasData]);

  function closePanel() {
    const trigger = panel === "settings" ? settingsButtonRef.current : channelsButtonRef.current;
    setPanel(null);
    trigger?.focus();
  }

  async function markRead(conversation: Conversation) {
    if (conversation.encrypted || !inboxAccess || !canReplyFromWorkspace || clientMode || !calendarId || conversation.unreadCount === 0) return;
    try {
      const response = await calendarMutationFetch(`${endpoint}/${encodeURIComponent(conversation.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markRead: true }) });
      if (response.ok) void latestLoadRef.current(true);
    } catch { /* Keep the open chat usable if marking read briefly fails. */ }
  }

  async function changeAiControl(aiAction: "takeover" | "resume") {
    if (!selected || selected.encrypted || clientMode || !canReplyFromWorkspace || changingControl) return;
    setChangingControl(true); setError("");
    try {
      const response = await calendarMutationFetch(`${endpoint}/${encodeURIComponent(selected.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiAction }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update AI handoff.");
      // Refresh without the attention filter so an acknowledged thread remains up to date.
      const fresh = await calendarMutationFetch(`${endpoint}`, { cache: "no-store" });
      if (fresh.ok) { const inbox = await fresh.json(); const thread = inbox.conversations.find((item: Conversation) => item.id === selected.id); if (thread) setPinnedConversation(thread); }
      await latestLoadRef.current(true);
      setSuccess(aiAction === "resume" ? (data?.settings.aiAutoReplyEnabled ? "AI will handle the next incoming message. Earlier messages will not be replayed." : "Conversation pause cleared. Automatic replies remain off in workspace settings.") : "You have taken over. AI stays paused until you resume it.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update AI handoff."); }
    finally { setChangingControl(false); }
  }

  async function updateLeadStatus(value: string) {
    if (!inboxAccess || !canManageLeads || !calendarId || !selected || selected.id.startsWith("xchat:")) return;
    try {
      const response = await calendarMutationFetch(`${endpoint}/${encodeURIComponent(selected.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadStatus: value }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); setError(result.error || "Could not update lead status."); return; }
      setPinnedConversation(current => current?.id === selected.id ? { ...current, leadStatus: value } : current);
      void latestLoadRef.current(true);
    } catch { setError("Could not update lead status. Please try again."); }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!canReply || sending || selectedX?.busy || !calendarId || !selected || (!draft.trim() && !selectedX?.retry)) return;
    if (selected.encrypted && selectedX) {
      if (await selectedX.sendText(draft)) setDraft("");
      return;
    }
    setSending(true); setError("");
    try {
      const response = await calendarMutationFetch(`${endpoint}/${encodeURIComponent(selected.id)}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: draft.trim() }) });
      const result = await response.json();
      if (!response.ok) { if (["SEND_UNCONFIRMED", "SEND_PENDING"].includes(result.code)) await latestLoadRef.current(true); throw new Error(result.error || "Could not send reply."); }
      setDraft(""); setSuccess("Reply sent to the platform.");
      await latestLoadRef.current(true);
      window.setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send reply."); }
    finally { setSending(false); }
  }

  async function saveSettings(patch: Partial<InboxData["settings"]>) {
    if (!inboxAccess || !calendarId || !data) return;
    setSavingSettings(true); setError("");
    const settings = { ...data.settings, ...patch, aiAutoReplyInstructions: patch.aiAutoReplyInstructions ?? data.settings.aiAutoReplyInstructions ?? "" };
    try {
      const response = await calendarMutationFetch(`/api/calendars/${encodeURIComponent(calendarId)}/inbox/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save inbox settings.");
      setData(current => current ? { ...current, settings: result } : current); setSuccess("Inbox settings saved.");
      window.setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save inbox settings."); }
    finally { setSavingSettings(false); }
  }

  const unresolvedDelivery = selected?.deliveryChecks?.find(operation => operation.state !== "UNCONFIRMED" || !operation.reviewedAt);
  async function acknowledgeDeliveryCheck() {
    if (!selected || !unresolvedDelivery || unresolvedDelivery.state !== "UNCONFIRMED") return;
    if (!window.confirm("Have you checked this reply in the platform inbox? This will allow new messages. It will not resend this reply or mark it delivered.")) return;
    try {
      const response = await calendarMutationFetch(`${endpoint}/${encodeURIComponent(selected.id)}/delivery-check`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operationId:unresolvedDelivery.id,confirmation:"CHECKED_PLATFORM_INBOX"})});
      if (!response.ok) throw Error("Could not record the delivery check. Refresh and try again.");
      clearCheckedInboxReply(`${endpoint}/${encodeURIComponent(selected.id)}/reply`);
      await latestLoadRef.current(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not record the check."); }
  }
  const whatsappWindowClosed = selected?.platform === "WHATSAPP" && (!selected.replyWindowExpiresAt || Date.parse(selected.replyWindowExpiresAt) <= Date.now());
  const canReply = selected?.encrypted ? inboxAccess && !!selectedX && selectedX.selected === selected.encrypted.conversationId && !clientMode && isOwner : !clientMode && canReplyFromWorkspace && selected && !unresolvedDelivery && !whatsappWindowClosed && ["FACEBOOK", "INSTAGRAM", "X", "LINKEDIN", "TIKTOK", "WHATSAPP"].includes(selected.platform) && selected.connection?.status === "CONNECTED" && data?.accounts.some(account => account.status === "CONNECTED" && account.platform === selected.platform && (!selected.connection?.id || account.id === selected.connection.id) && account.messagingAvailable);
  const replyUnavailable = clientMode ? "Read-only client view. Ask your workspace manager to reply."
    : !inboxAccess ? "Your plan does not include replying from the inbox."
    : selected?.encrypted ? (!isOwner ? "The workspace owner can unlock X to reply." : "Unlock X to read and reply to this conversation.")
    : whatsappWindowClosed ? "WhatsApp’s reply window has closed. A new customer message will reopen it."
    : "Replying isn’t available for this connected account yet.";
  const channelKeys = useMemo(() => [...new Set(data?.accounts.map(account => account.platform) || [])], [data?.accounts]);
  const openConversation = (conversation: Conversation) => {
    setSelectedId(conversation.id);
    setPinnedConversation(conversation.encrypted ? null : conversation);
    setAssistantOpen(false);
    setMobileChatOpen(true);
    setMobileToolsOpen(false);
    setPanel(null);
    nearBottomRef.current = true;
    setSuccess("");
    void markRead(conversation);
  };

  return (
    <section className={`${styles.inbox} ${focusMode ? styles.focusMode : ""} ${mobileToolsOpen ? styles.mobileToolsOpen : ""} ${mobileChatOpen ? styles.mobileChatActive : ""} ${panel ? styles.panelOpen : ""}`} aria-label="Social leads inbox" data-showwork-inbox="true" data-mobile-chat-open={mobileChatOpen ? "true" : "false"}>
      {!clientMode && !inboxAccess && <WorkspaceFeatureNotice compact feature="socialInbox" />}
      <div className={styles.mobileToolbar}><div><h2>Messages <span>{data?.summary.newMessages ? data.summary.newMessages : ""}</span></h2><p>Every conversation. One inbox.</p></div><button type="button" className={styles.mobileToolsButton} aria-label="Inbox filters and settings" aria-expanded={mobileToolsOpen} onClick={() => setMobileToolsOpen(value => !value)}>{mobileToolsOpen ? <X size={19} aria-hidden="true" /> : <Settings2 size={19} aria-hidden="true" />}</button></div>
      <header className={styles.header}>
        <div className={styles.identity}><span className={styles.headerIcon}><MessageSquareText size={21} aria-hidden="true" /></span><div><span className={styles.eyebrow}>Conversations & customer care</span><h2>Your conversations.<span> Connected.</span></h2><p>Every channel, one conversation at a time. Reply with confidence.</p></div></div>
        <div className={styles.headerActions}>
          {data && <><span className={styles.metric}><strong>{data.summary.newMessages.toLocaleString()}</strong> unread</span>{canManageLeads && <span className={styles.metric}><strong>{data.summary.leads.toLocaleString()}</strong> leads</span>}</>}
          <button type="button" className={`${styles.button} ${styles.refreshButton}`} onClick={() => void load()} disabled={loading} aria-label="Refresh inbox"><RefreshCw size={15} aria-hidden="true" className={loading ? "motion-safe:animate-spin" : ""} /><span>Refresh</span></button>
          {canViewChannels && <button type="button" ref={channelsButtonRef} className={`${styles.button} ${panel === "channels" ? styles.activeButton : ""}`} aria-expanded={panel === "channels"} aria-controls="inbox-channels-panel" onClick={() => setPanel(current => current === "channels" ? null : "channels")}><SlidersHorizontal size={15} aria-hidden="true" />Channel access</button>}
          {isManager && <button type="button" ref={settingsButtonRef} className={`${styles.button} ${panel === "settings" ? styles.activeButton : ""}`} aria-expanded={panel === "settings"} aria-controls="inbox-settings-panel" onClick={() => setPanel(current => current === "settings" ? null : "settings")}><Settings2 size={15} aria-hidden="true" />AI & inbox setup</button>}
          <a href="https://wa.me/2347018819588" target="_blank" rel="noopener noreferrer" className={`${styles.button} ${styles.mobileHelp}`}>Contact support<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> on WhatsApp (opens in a new tab)</span></a>
        </div>
      </header>
      {error && <div role="alert" className={styles.notice}><AlertCircle size={16} className="shrink-0" aria-hidden="true" />{error}</div>}
      {success && <div role="status" className={`${styles.notice} ${styles.success}`}><Check size={16} aria-hidden="true" />{success}</div>}
      {!clientMode && ((data?.summary.needsAttention || 0) > 0 || attentionOnly) && <div className={styles.attentionBar} role="status" aria-live="polite"><BellRing size={16} aria-hidden="true" /><span><strong>{data?.summary.needsAttention || 0}</strong> conversations need a person</span><button type="button" aria-pressed={attentionOnly} onClick={() => setAttentionOnly(value => !value)}>{attentionOnly ? "Show all" : "Needs attention"}</button></div>}
      <div className={styles.channelBar}>
      <nav className={styles.channels} aria-label="Conversation channels">
        <button type="button" aria-pressed={!platform} onClick={() => setPlatform("")} className={`${styles.channel} ${!platform ? styles.channelSelected : ""}`}><Inbox size={14} aria-hidden="true" />All conversations</button>
        {channelKeys.map(key => <button type="button" key={key} aria-pressed={platform === key} onClick={() => setPlatform(key)} className={`${styles.channel} ${platform === key ? styles.channelSelected : ""}`}><PlatformBrandIcon platform={key} size={15}/>{PLATFORMS[key] || key}</button>)}
      </nav>
      {!clientMode && isOwner && calendarId && data?.accounts.some(account => account.platform === "X" && account.status === "CONNECTED") && <details className={styles.xAccess} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
        <summary><PlatformBrandIcon platform="X" size={15}/><LockKeyhole size={13}/><span>Encrypted X messages</span><ChevronDown size={14}/></summary>
        <div className={styles.xAccessBody}>{data?.accounts.filter(account => account.platform === "X" && account.status === "CONNECTED").map(account => <XChatInbox key={`${calendarId}:${account.id}`} calendarId={calendarId} connectionId={account.id} activeConversationId={selected?.encrypted?.connectionId === account.id ? selected.encrypted.conversationId : ""} onState={updateXChat} />)}</div>
      </details>}
      </div>
      {focusMode && <div className={styles.focusToolbar}><span><MessageSquareText size={14}/>Focused conversation view</span><button type="button" onClick={() => setFocusMode(false)}><Minimize2 size={14}/>Back to inbox tools</button></div>}
      <div className={`${styles.workbench} ${mobileChatOpen ? styles.conversationOpen : ""}`}>
        <aside className={styles.list} aria-label="Conversation list">
          <div className={styles.listHeader}>
            <div className={styles.listTitle}>Conversations <span>{conversations.length}</span></div>
            <div className={styles.search}><Search size={15} aria-hidden="true" /><input aria-label="Search people or messages" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people or messages" type="search" /></div>
            <div className={styles.filters}><select aria-label="Filter by lead status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All lead statuses</option>{STATUSES.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(value => !value)} className={`${styles.unreadToggle} ${unreadOnly ? styles.unreadSelected : ""}`}>{unreadOnly && <Check size={12} aria-hidden="true" />}Unread</button></div>
          </div>

          <div className={styles.threads} aria-label="Conversations" aria-busy={loading}>
            {conversations.map(conversation => <button type="button" key={conversation.id} aria-pressed={selectedId === conversation.id} disabled={!!selectedX?.busy || (!!selectedX?.retry && conversation.id !== selectedId)} onClick={() => openConversation(conversation)} data-needs-attention={!clientMode && !!conversation.aiPausedAt && !conversation.aiHandoffAcknowledgedAt} className={`${styles.thread} ${selectedId === conversation.id ? styles.threadSelected : ""}`}>
              <div className={styles.threadTop}><span className={styles.avatar} aria-hidden="true">{initials(contactName(conversation))}</span><div className={styles.threadIdentity}><p className={styles.threadName}>{contactName(conversation)}</p><p className={styles.threadPlatform}><PlatformBrandIcon platform={conversation.platform} size={12}/>{PLATFORMS[conversation.platform]}</p></div>{conversation.unreadCount > 0 && <span className={styles.unreadCount} aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount}</span>}</div>
              <p className={`${styles.preview} ${drafts[conversation.id] ? styles.draftLabel : ""}`}>{drafts[conversation.id] ? `Draft: ${drafts[conversation.id]}` : conversation.lastMessagePreview || "Start of a conversation"}</p>
              <div className={styles.threadFoot}><span>{conversation.encrypted ? "Encrypted" : !clientMode && conversation.aiPausedAt ? (conversation.aiHandoffAcknowledgedAt ? "Team handling" : "Needs a person") : conversation.leadStatus?.replaceAll("_", " ")}</span><span>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}</span></div>
            </button>)}
            {!conversations.length && <div className={styles.emptyList}><Inbox size={25} className="mx-auto" aria-hidden="true" /><p>{loading ? "Loading conversations…" : "No conversations here yet."}</p>{!loading && <p>{search || status || unreadOnly || platform ? "Try another filter or search." : "Messages from connected channels will appear here."}</p>}</div>}
          </div>
        </aside>
        <div className={styles.chat} aria-label="Active conversation">
          {selected ? <>
            <header className={styles.chatHeader}>
              <div className={styles.chatIdentity}>
                <button type="button" className={`${styles.button} ${styles.mobileBack}`} aria-label="Back to conversations" onClick={() => setMobileChatOpen(false)}><ArrowLeft size={16} aria-hidden="true" /></button>
                <span className={styles.avatar} aria-hidden="true">{initials(contactName(selected))}</span>
                <div className="min-w-0"><h3 className={styles.chatName}>{contactName(selected)}</h3><p className={styles.chatSub}><PlatformBrandIcon platform={selected.platform} size={12}/>{PLATFORMS[selected.platform]}{selected.participantUsername ? ` · ${selected.platform === "WHATSAPP" ? "" : "@"}${selected.participantUsername}` : ""}{selected.encrypted ? " · Encrypted" : ""}</p></div>
              </div>
              <div className={styles.chatControls}>{!clientMode && !selected.encrypted && canReplyFromWorkspace && <details key={selected.id} className={styles.handoffMenu} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
                <summary aria-label="Conversation AI and handoff controls" data-paused={!!selected.aiPausedAt}>{selected.aiPausedAt ? <UserRound size={14}/> : <Bot size={14}/>}<span>{selected.aiPausedAt ? "AI paused" : data?.settings.aiAutoReplyEnabled ? "AI on" : "AI off"}</span><ChevronDown size={12}/></summary>
                <div className={styles.handoffControl}>
              <button type="button" className={styles.handoffDismiss} aria-label="Close AI and handoff controls" onClick={event => { const menu = event.currentTarget.closest("details"); if (menu) { menu.open = false; menu.querySelector("summary")?.focus(); } }}><X size={14}/></button>
              <div>{selected.aiPausedAt ? <UserRound size={17} aria-hidden="true" /> : <Bot size={17} aria-hidden="true" />}<p><strong>{selected.aiPausedAt ? "Human handoff · AI paused" : data?.settings.aiAutoReplyEnabled ? "AI replies enabled" : "AI replies off"}</strong><span>{selected.aiHandoffReason || "Take over whenever this conversation needs a personal touch."}</span></p></div>
              <div>{selected.aiPausedAt ? <>{!selected.aiHandoffAcknowledgedAt && <button type="button" disabled={changingControl} onClick={() => void changeAiControl("takeover")}>Take over</button>}<button type="button" disabled={changingControl} onClick={() => void changeAiControl("resume")}>Resume AI</button></> : <button type="button" disabled={changingControl} onClick={() => void changeAiControl("takeover")}>Take over</button>}</div>
            </div>
              </details>}<button type="button" className={`${styles.button} ${styles.expandChat}`} aria-label={focusMode ? "Exit focused conversation view" : "Expand conversation view"} aria-pressed={focusMode} onClick={() => setFocusMode(value => !value)}>{focusMode ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button>{canManageLeads && !selected.encrypted && <select aria-label="Update lead status" value={selected.leadStatus} disabled={!inboxAccess || clientMode} onChange={event => void updateLeadStatus(event.target.value)}>{STATUSES.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>}</div>
            </header>

            {selectedX && <div className={styles.messageTools}><div className="flex flex-wrap gap-4"><button type="button" disabled={selectedX.busy} onClick={() => void selectedX.refresh()} className="text-blue-700">Refresh messages</button>{selectedX.cursor && <button type="button" disabled={selectedX.busy} onClick={() => void selectedX.older()} className="text-blue-700">Load older messages</button>}</div>{selectedX.error && <p role="alert" className="mt-2 text-red-700">{selectedX.error}</p>}{selectedX.notice && <p role="status" className="mt-2 text-[#667085]">{selectedX.notice}</p>}</div>}
            <div ref={historyRef} className={styles.history} aria-label="Message history" tabIndex={0} onScroll={event => { const element = event.currentTarget; nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>
              {selected.messages.map((message, index) => <div key={message.id}>
                {(index === 0 || dayLabel(selected.messages[index - 1].platformCreatedAt) !== dayLabel(message.platformCreatedAt)) && <div className={styles.dayLabel}><span>{dayLabel(message.platformCreatedAt)}</span></div>}
                <div className={`${styles.messageRow} ${message.direction === "OUTBOUND" ? styles.messageOutbound : ""}`}><div className={styles.bubble}><p>{message.isAiGenerated ? formatInboxReply(message.text) : message.text}</p><div className={styles.messageMeta}><span>{message.direction === "OUTBOUND" ? `${message.isAiGenerated ? "AI · " : ""}${message.deliveryState === "UNCONFIRMED" ? "Unconfirmed—check before retrying" : message.status === "PENDING" ? "Sending…" : message.status === "READ" ? "Read" : message.status === "DELIVERED" ? "Delivered" : message.status === "FAILED" ? "Failed" : "Sent"}` : "Received"}</span><time dateTime={message.platformCreatedAt} title={new Date(message.platformCreatedAt).toLocaleString()}>{new Date(message.platformCreatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time></div>{message.autoReplyHandoffReason && <p className={styles.handoff}>{message.autoReplyHandoffReason}</p>}{message.sendError && <p className={styles.messageError}>{message.sendError}</p>}</div></div>
              </div>)}
              {!selected.messages.length && <div className={styles.empty}><MessageSquareText size={28} aria-hidden="true" /><p>{selected.encrypted && selectedX?.busy ? "Loading messages…" : "No messages in this conversation yet."}</p></div>}
            </div>
            {!clientMode && unresolvedDelivery && <div role="status" className="mx-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>{unresolvedDelivery.state === "UNCONFIRMED" ? "Unconfirmed—check before retrying" : "Reply is being sent"}</strong><p className="mt-1">{unresolvedDelivery.state === "UNCONFIRMED" ? "Check the platform inbox to avoid sending the same message twice." : "Wait for confirmation before sending another reply."}</p>{unresolvedDelivery.state === "UNCONFIRMED" && canReplyFromWorkspace && <button type="button" className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold" onClick={() => void acknowledgeDeliveryCheck()}>I’ve checked the platform inbox</button>}</div>}
            {!clientMode ? <form onSubmit={sendReply} className={styles.composer}>
              {!selected.encrypted && canReply && data && <div className={styles.assistant}>
                <button type="button" className={styles.assistantToggle} aria-expanded={assistantOpen} aria-controls="inbox-reply-assistant" onClick={() => setAssistantOpen(value => !value)}><Sparkles size={14} aria-hidden="true" />AI reply assistant<span aria-hidden="true">{assistantOpen ? "−" : "+"}</span></button>
                {assistantOpen && <div id="inbox-reply-assistant" className={styles.assistantBody} role="region" aria-label="AI reply assistant controls and draft" tabIndex={0}><ReplyDraftAssistant key={selected.id} endpoint={endpoint} conversationId={selected.id} defaultTone={normalizeReplyProfile(data.settings.aiReplyProfile).tone} currentDraft={draft} latestInboundId={[...selected.messages].reverse().find(message => message.direction === "INBOUND")?.id} onUseDraft={value => { setDraft(value); setAssistantOpen(false); }} locked={!inboxAccess} /></div>}
              </div>}

              <div className={styles.composerBar}><textarea aria-label={`Reply to ${contactName(selected)}`} value={draft} onChange={event => setDraft(event.target.value)} rows={2} disabled={!canReply || sending || !!selectedX?.retry || !!selectedX?.busy} maxLength={2000} placeholder={canReply ? "Write your reply…" : "Replies unavailable"} /><button type="submit" aria-label={selectedX?.retry ? "Retry reply" : "Send reply"} disabled={!canReply || sending || !!selectedX?.busy || (!draft.trim() && !selectedX?.retry)} className={styles.send}><Send size={16} aria-hidden="true" /><span>{sending || selectedX?.busy ? "Sending…" : selectedX?.retry ? "Retry" : "Send"}</span></button></div>
              <p className={styles.composerHint}>{!canReply ? replyUnavailable : selected.encrypted ? "Encrypted on this device. Excluded from shared history and AI." : `Replies sent through ${PLATFORMS[selected.platform]}${selected.connection?.username ? ` · @${selected.connection.username}` : selected.connection?.accountName ? ` · ${selected.connection.accountName}` : ""}.`}</p>
            </form> : <div className={styles.readOnly}>{replyUnavailable}</div>}
          </> : <div className={styles.empty}><span className={styles.emptyIcon}><MessageSquareText size={31} strokeWidth={1.5} aria-hidden="true" /></span><h3>{loading && !data ? "Opening your inbox…" : "Good conversations start here."}</h3><p>{loading && !data ? "Your conversations are on their way." : "Choose a conversation to read messages and keep the conversation going."}</p></div>}
        </div>
      </div>
      {panel === "settings" && isManager && data && <section ref={panelRef} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closePanel(); } }} id="inbox-settings-panel" className={styles.setupPanel} aria-label="AI and inbox setup">
        <InboxSetupPanel calendarId={calendarId} knowledge={businessKnowledge} settings={data.settings} saving={savingSettings} inboxAccess={inboxAccess} autoRepliesAccess={autoRepliesAccess} onChange={patch => void saveSettings(patch)} onClose={closePanel} />
      </section>}
      {panel === "channels" && canViewChannels && data && <section ref={panelRef} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closePanel(); } }} id="inbox-channels-panel" className={styles.settings} aria-label="Channel messaging access">
        <div className={styles.settingsHeader}><div><h3>Channel access</h3><p className="mt-1 text-xs text-[#607898]">Check messaging access for your connected accounts.</p></div><button type="button" className={styles.button} aria-label="Close channel access" onClick={closePanel}><X size={16} aria-hidden="true" /></button></div>
        <div className={styles.channelGrid}>{data.accounts.map(account => <div key={account.id} className={styles.account}><span className={`${styles.accessDot} ${account.messagingAvailable ? styles.accessReady : ""}`} aria-hidden="true" /><div><p>{PLATFORMS[account.platform]}{account.username ? ` · ${account.platform === "WHATSAPP" ? "" : "@"}${account.username}` : account.accountName ? ` · ${account.accountName}` : ""}</p><small>{account.messagingNote}</small></div></div>)}</div>
        {!data.accounts.length && <p className="text-sm text-[#607898]">Connect a channel to bring messages into your inbox.</p>}
        {!clientMode && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("showwork-workspace-navigate", { detail: { id: "channels" } }))} className={`${styles.button} mt-4`}>Manage connections <ArrowUpRight size={14} aria-hidden="true" /></button>}
      </section>}
    </section>
  );
}
