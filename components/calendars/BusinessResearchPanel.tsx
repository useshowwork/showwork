"use client";
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpenText, Check, ChevronDown, Globe2, History, Loader2, MessageCircle, Plus, Send, Sparkles, X } from 'lucide-react';
import RandyAvatar from '@/components/support/RandyAvatar';
import RandyContentPrompt from './RandyContentPrompt';
import type { BusinessChatAnswer } from '@/lib/knowledge/randy/answer';
import styles from './RandyWorkspace.module.css';
type Conversation = { id: string; title: string; processingAt: string | null };
type Message = { id: string; role: string; body: BusinessChatAnswer & { mode?: string }; knowledgeDocumentId: string | null };
export default function BusinessResearchPanel({ calendarId, canManage, canGenerate = false }: { calendarId: string; canManage: boolean; canGenerate?: boolean }) {
 const router = useRouter();
 const [conversations, setConversations] = useState<Conversation[]>([]), [conversation, setConversation] = useState<Conversation | null>(null), [messages, setMessages] = useState<Message[]>([]);
 const [text, setText] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [interrupted, setInterrupted] = useState(false);
 const [historyOpen, setHistoryOpen] = useState(false);
 const [historyQuery, setHistoryQuery] = useState('');
 const end = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null), selection = useRef(0);
 const endpoint = `/api/calendars/${calendarId}/randy`;
 const waiting = !!conversation?.processingAt && !interrupted;
 const list = useCallback(async () => {
  const response = await fetch(endpoint, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw Error(data.error); setConversations(data.conversations);
 }, [endpoint]);
 const load = useCallback(async (id: string, version = selection.current) => {
  const response = await fetch(`${endpoint}?conversation=${encodeURIComponent(id)}`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw Error(data.error);
  if (version === selection.current) { setConversation(data.conversation); setMessages(data.messages); setInterrupted(data.interrupted); if (!data.conversation.processingAt) void list().catch(() => {}); }
 }, [endpoint, list]);
 useEffect(() => { let alive = true; void list().catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; selection.current++; }; }, [list]);
 useEffect(() => { if (!conversation?.id || !waiting) return; const id = conversation.id; const timer = setInterval(() => { void load(id).catch(e => setError(e.message)); }, 3000); return () => clearInterval(timer); }, [conversation?.id, waiting, load]);
 useEffect(() => { if (messages.length || waiting) end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [messages.length, waiting]);
 function fresh() { setHistoryQuery(''); selection.current++; setConversation(null); setMessages([]); setInterrupted(false); setError(''); setText(''); setHistoryOpen(false); input.current?.focus(); }
 async function choose(id: string) { const version = ++selection.current; setBusy(true); setError(''); setHistoryOpen(false); try { await load(id, version); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open conversation.'); } finally { setBusy(false); } }
 async function send(value = text) {
  if (!value.trim() || busy || waiting || !canGenerate) return;
  setBusy(true); setError('');
  try {
   const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: conversation?.id, text: value, action: 'chat' }) });
   const data = await response.json(); if (!response.ok) throw Error(data.error);
   setText(''); await load(data.conversationId); await list();
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not send.'); }
  finally { setBusy(false); input.current?.focus(); }
 }
 async function confirm(messageId: string, action: 'confirmKnowledge' | 'confirmResearch' = 'confirmKnowledge') {
  setBusy(true); setError('');
  try { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, conversationId: conversation?.id, messageId }) }); const data = await response.json(); if (!response.ok) throw Error(data.error); await load(conversation!.id); if (action === 'confirmKnowledge') router.refresh(); }
  catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm save.'); } finally { setBusy(false); }
 }
 return <section className={styles.workspace} aria-label="Randy business assistant">
  <header className={styles.header}><div className={styles.identity}><RandyAvatar size={42}/><div><h1>Randy</h1><p>Ideas, research and clear next steps.</p></div></div><div className={styles.headerActions}><button type="button" className={styles.headerNew} onClick={fresh} disabled={busy || loading}><Plus size={15}/><span>New chat</span></button><button className={styles.historyToggle} type="button" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen} aria-controls={`randy-history-${calendarId}`} aria-label={historyOpen ? "Hide conversations" : "Show conversations"}><History size={16}/><span>History</span></button></div></header>
  <div className={styles.layout} data-history-open={historyOpen}>
   <aside id={`randy-history-${calendarId}`} className={styles.sidebar} data-open={historyOpen} aria-label="Your Randy conversations"><div className={styles.sidebarTop}><span>Conversations</span><button type="button" aria-label="Close conversations" className={styles.closeHistory} onClick={() => setHistoryOpen(false)}><X size={18}/></button></div><label className={styles.historySearch}><span className="sr-only">Search conversations</span><input type="search" placeholder="Find a conversation…" value={historyQuery} onChange={event => setHistoryQuery(event.target.value)}/></label><nav>{conversations.filter(c => c.title.toLowerCase().includes(historyQuery.toLowerCase().trim())).map(c => <button key={c.id} type="button" aria-current={c.id === conversation?.id ? 'page' : undefined} onClick={() => void choose(c.id)} disabled={busy}><MessageCircle size={15}/><span>{c.title}</span>{c.processingAt && <span className={styles.activityDot} aria-label="Reply in progress"/>}</button>)}</nav>{loading ? <p className={styles.hint}>Loading conversations…</p> : !conversations.length ? <p className={styles.hint}>Your conversations will appear here.</p> : !conversations.some(c => c.title.toLowerCase().includes(historyQuery.toLowerCase().trim())) && <p className={styles.hint}>No matching conversations.</p>}<small>Your conversations are private to you.</small></aside>
   <div className={styles.main}>
     <div className={styles.messages} aria-label="Business conversation" aria-live="polite" aria-busy={waiting || busy}>
      {!messages.length && !loading && !busy && <div className={styles.welcome}><span className={styles.welcomeBadge}><Sparkles size={13}/>Your business thinking partner</span><h2>What are we working on?</h2><p>Choose a starting point, or ask me anything about your business.</p><div className={styles.starters}>
        {([
          { title: "Plan content", note: "Turn your goals into content ideas", icon: Sparkles, prompt: "Help me plan a week of content based on our business knowledge and brand voice. Ask me about my goals before suggesting ideas." },
          { title: "Explore an idea", note: "Find the strongest angle", icon: MessageCircle, prompt: "I have an idea I’d like to develop. Help me think it through, starting with a few questions." },
          ...(canManage ? [{ title: "Research my market", note: "Explore trends and opportunities", icon: Globe2, prompt: "Help me research my market and identify useful opportunities. Ask what I want to explore, then prepare a research topic for my approval." }, { title: "Build business knowledge", note: "Add useful context for future content", icon: BookOpenText, prompt: "I’d like to add information about my business. Help me organize it and show me what you suggest saving for my confirmation." }] : []),
        ]).map(item => <button key={item.title} type="button" disabled={!canGenerate || busy || waiting} onClick={() => { setText(item.prompt); input.current?.focus(); }}><span className={styles.starterIcon}><item.icon size={18}/></span><span><strong>{item.title}</strong><small>{item.note}</small></span><ArrowUpRight size={14}/></button>)}
      </div></div>}
      {loading && <div className={styles.loadingState} role="status"><Loader2 size={18}/>Getting Randy ready…</div>}
      {conversation && <div className={styles.conversationTitle}><MessageCircle size={13}/><span>{conversation.title}</span></div>}
      {messages.map((message, index) => <article key={message.id} className={message.role === 'user' ? styles.user : styles.answer}>
       {message.role === 'assistant' && <div className={styles.byline}><RandyAvatar size={24}/>Randy</div>}
       {message.body.mode?.startsWith('research') && <span className={styles.researchLabel}><Globe2 size={12}/>Web research</span>}
       <div className={styles.messageText}>{message.body.text}</div>
       {!!message.body.sources?.length && <details className={styles.sources}><summary>Sources · {message.body.sources.length}<ChevronDown size={13}/></summary><div>{message.body.sources.map(source => source.url ? <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><Globe2 size={13}/>{source.title}<ArrowUpRight size={12}/></a> : <span key={source.id}><BookOpenText size={13}/>{source.title}</span>)}</div></details>}
       {message.body.proposal && <div className={styles.proposal}><span className={styles.proposalLabel}><BookOpenText size={14}/>{message.knowledgeDocumentId ? 'Saved to Business Knowledge' : 'Add this to your business information?'}</span><h3>{message.body.proposal.title}</h3><p>{message.body.proposal.text}</p>{message.knowledgeDocumentId ? <span className={styles.saved}><Check size={15}/>Saved</span> : <><small>Adds a shared source. Existing documents stay unchanged; conflicting information needs review.</small>{canManage ? <button type="button" onClick={() => void confirm(message.id)} disabled={busy || waiting}><Check size={15}/>Confirm & save</button> : <small>A knowledge manager must confirm additions.</small>}</>}</div>}
       {message.body.researchPlan && <div className={styles.proposal}><span className={styles.proposalLabel}><Globe2 size={14}/>Public research topic</span><p>{message.body.researchPlan.focus}</p><small>Only this topic and public business identifiers go into web search. Review it for private details before starting.</small>{message.body.researchStarted ? <span className={styles.saved}><Check size={15}/>Research requested</span> : canManage && <button type="button" disabled={busy || waiting} onClick={() => void confirm(message.id, 'confirmResearch')}><Globe2 size={15}/>Start research</button>}</div>}
       {message.body.contentBrief && <RandyContentPrompt calendarId={calendarId} brief={message.body.contentBrief} canGenerate={canGenerate}/>}
       {message.role === 'assistant' && index === messages.length - 1 && !message.body.researchPlan && <div className={styles.chatActions}>
        {canGenerate && !message.body.contentBrief && <button type="button" disabled={busy || waiting} onClick={() => void send('Create a content-generation prompt from this discussion and any relevant research. Use our business context and preserve uncertainties.')}><Sparkles size={14}/>Create content prompt</button>}
        {canManage && canGenerate && !message.body.proposal && <button type="button" disabled={busy || waiting} onClick={() => void send('Suggest a useful addition to our Business Knowledge based on this discussion. Separate confirmed business facts from proposed strategy and cited research hypotheses.')}><BookOpenText size={14}/>Suggest knowledge update</button>}
        {message.body.researchSuggested && canManage && canGenerate && <button type="button" disabled={busy || waiting} onClick={() => void send('Research the opportunity we just discussed. Prepare a specific public research topic for me to review.')}><Globe2 size={14}/>Research this idea</button>}
       </div>}

      </article>)}
      {waiting && <div className={styles.thinking} role="status"><Loader2 size={16}/>Randy is {messages.at(-1)?.body.mode === 'research-approved' ? 'researching public sources' : messages.at(-1)?.body.mode === 'research' ? 'preparing your research' : 'thinking about your business'}…</div>}
      {interrupted && <p role="status" className={styles.error}>That reply was interrupted. Please ask again; nothing was automatically saved.</p>}
      <div ref={end}/>
     </div>
     <form className={styles.composer} onSubmit={e => { e.preventDefault(); void send(); }}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.inputBox}><label className="sr-only" htmlFor={`randy-business-${calendarId}`}>Message Randy about your business</label><textarea ref={input} id={`randy-business-${calendarId}`} value={text} rows={2} maxLength={3000} disabled={!canGenerate || busy || waiting} placeholder={canGenerate ? 'Ask Randy, or share an idea…' : 'AI generation permission is required to chat.'} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/><div className={styles.inputActions}><span className={styles.keyboardHint}>Enter to send · Shift + Enter for a new line</span><button className={styles.send} type="submit" aria-label="Send to Randy" disabled={!text.trim() || !canGenerate || busy || waiting}>{busy || waiting ? <Loader2 size={17}/> : <Send size={17}/>}<span>{busy || waiting ? "Working…" : "Send"}</span></button></div></div>
      <p className={styles.footerHint}>Uses your business knowledge and brand voice. You approve research and knowledge updates.</p>
     </form>
   </div>
  </div>
 </section>;
}
