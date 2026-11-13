"use client";
import { announceLeadChange, subscribeLeadChanges } from "@/lib/leadChanges";
import { createClientRequestGate } from "@/lib/clientRequestGate";
import { subscribeChannelChanges } from "@/lib/reporting/channelChanges";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";

import styles from "./LeadsStudio.module.css";
import PlatformBrandIcon from "./PlatformBrandIcon";
import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, ChartNoAxesCombined, ContactRound, ChevronLeft, ChevronRight, Download, FileUp, Flame, Plus, RefreshCw, Search, Users, X } from "lucide-react";

type Lead = {
  id: string; name: string; username: string | null; email: string | null; phone: string | null; company: string | null;
  socialUserId?: string | null; socialPlatform?: string | null;
  temperature: "COLD" | "WARM" | "HOT"; status: "NEW" | "CONTACTED" | "QUALIFIED" | "CUSTOMER" | "LOST";
  source: "SOCIAL" | "MANUAL" | "IMPORT"; notes: string | null; createdAt: string; updatedAt: string;
};
type FormValues = Pick<Lead, "name" | "username" | "email" | "phone" | "company" | "temperature" | "status" | "notes">;
const EMPTY: FormValues = { name: "", username: "", email: "", phone: "", company: "", temperature: "WARM", status: "NEW", notes: "" };
const TEMPERATURES: Lead["temperature"][] = ["HOT", "WARM", "COLD"];
const STATUSES: Lead["status"][] = ["NEW", "CONTACTED", "QUALIFIED", "CUSTOMER", "LOST"];
const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export default function CalendarLeadsPanel({ calendarId, canEdit: requestedEdit, featureLocked = false, clientSlug }: { calendarId: string; canEdit: boolean; featureLocked?: boolean; clientSlug?:string }) {
  const canEdit=requestedEdit && !clientSlug;
  const [viewingLead,setViewingLead]=useState<Lead|null>(null);
  const viewDialog=useRef<HTMLDialogElement>(null);
  const readGate=useRef(createClientRequestGate());
  useEffect(()=>{
    if(!viewingLead)return;
    const dialog=viewDialog.current, previousFocus=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    dialog?.showModal();document.body.style.overflow="hidden";
    return ()=>{dialog?.close();document.body.style.overflow=previousOverflow;previousFocus?.focus({preventScroll:true});};
  },[viewingLead?.id]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY);
  const loadVersion = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const endpoint = clientSlug ? `/api/social-calendar/${encodeURIComponent(clientSlug)}/leads` : `/api/calendars/${encodeURIComponent(calendarId)}/leads`;
  const currentEndpoint=useRef(endpoint);currentEndpoint.current=endpoint;

  const load = useCallback((quiet = false) => readGate.current.run(endpoint,async () => {
    if(currentEndpoint.current!==endpoint)return;
    const version = ++loadVersion.current;
    if (!quiet) setLoading(true);
    try {
      const response = await calendarMutationFetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (version !== loadVersion.current || currentEndpoint.current !== endpoint) return;
      if (!response.ok) {
        if([401,403,404].includes(response.status)){setLeads([]);setViewingLead(null);}
        throw new Error(result.error || "Could not load leads.");
      }
      setLeads(result.leads);
      setViewingLead(current=>current ? result.leads.find((lead:Lead)=>lead.id===current.id) || null : null);
      if (!quiet) setError("");
    } catch (err) { if (version === loadVersion.current && !quiet) setError(err instanceof Error ? err.message : "Could not load leads."); }
    finally { if (version === loadVersion.current && !quiet) setLoading(false); }
  }), [endpoint]);
  useEffect(() => { setLeads([]);setViewingLead(null);setEditing(null);setModalOpen(false);void load(); }, [load]);
  useEffect(() => {
    const reset = () => { ++loadVersion.current; readGate.current.clear(); setLeads([]); setEditing(null); setModalOpen(false); void load(); };
    const unsubscribe = clientSlug ? () => {} : subscribeChannelChanges(calendarId, reset);
    const focus = () => { void load(true); };
    window.addEventListener("focus", focus);
    const timer=window.setInterval(()=>{if(!document.hidden)void load(true);},15000);
    return () => { ++loadVersion.current; readGate.current.clear(); unsubscribe(); window.clearInterval(timer);window.removeEventListener("focus", focus); };
  }, [calendarId, clientSlug, load]);

  useEffect(()=>subscribeLeadChanges(clientSlug ? undefined : calendarId,()=>{void load(true);}),[calendarId,clientSlug,load]);

  const visibleLeads = useMemo(() => leads.filter((lead) => {
    const searchMatch = !query.trim() || [lead.name, lead.username, lead.socialPlatform, lead.email, lead.phone, lead.company].some((value) => value?.toLowerCase().includes(query.trim().toLowerCase()));
    return searchMatch && (!statusFilter || lead.status === statusFilter) && (!temperatureFilter || lead.temperature === temperatureFilter);
  }), [leads, query, statusFilter, temperatureFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageLeads = visibleLeads.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(value => value === 1 || value === totalPages || Math.abs(value - currentPage) <= 1);
  useEffect(() => { setPage(1); }, [calendarId]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const hotCount = leads.filter((lead) => lead.temperature === "HOT" && lead.status !== "LOST" && lead.status !== "CUSTOMER").length;
  const activeCount = leads.filter((lead) => lead.status !== "LOST" && lead.status !== "CUSTOMER").length;
  const customers = leads.filter((lead) => lead.status === "CUSTOMER").length;
  const conversionRate = leads.length ? Math.round((customers / leads.length) * 100) : 0;

  function openForm(lead?: Lead) {
    if(!canEdit)return;
    setEditing(lead ?? null);
    setForm(lead ? { name: lead.name, username: lead.username || "", email: lead.email || "", phone: lead.phone || "", company: lead.company || "", temperature: lead.temperature, status: lead.status, notes: lead.notes || "" } : EMPTY);
    setError(""); setModalOpen(true);
  }

  async function saveLead(event: FormEvent) {
    event.preventDefault(); if(!canEdit)return; setSaving(true); setError(""); setNotice("");
    try {
      const response = await calendarMutationFetch(editing ? `${endpoint}/${encodeURIComponent(editing.id)}` : endpoint, {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this lead.");
      if (editing) setLeads((current) => current.map((lead) => lead.id === editing.id ? result.lead : lead));
      else { setNotice("Lead added."); await load(true); }
      setModalOpen(false);
      announceLeadChange(calendarId);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save this lead."); }
    finally { setSaving(false); }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !canEdit) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (file.size > 2_000_000) throw new Error("CSV files must be under 2 MB.");
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("Add a header row and at least one lead to your CSV.");
      const headers = rows[0].map((value) => value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim());
      const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const nameIndex = column("name", "full name", "contact name");
      if (nameIndex < 0) throw new Error("The CSV needs a Name or Full Name column.");
      const usernameIndex = column("username", "social username", "handle", "social handle");
      const emailIndex = column("email", "email address");
      const phoneIndex = column("phone", "phone number", "mobile");
      const companyIndex = column("company", "organization", "organisation");
      const temperatureIndex = column("temperature", "lead temperature", "priority");
      const statusIndex = column("status", "lead status", "stage");
      const notesIndex = column("notes", "description");
      if (rows.length - 1 > 500) throw new Error("Import up to 500 leads per CSV.");
      const get = (row: string[], index: number) => index < 0 ? "" : row[index]?.trim() || "";
      const imported = rows.slice(1).map((row) => {
        const temperature = get(row, temperatureIndex).toUpperCase();
        const rawStatus = get(row, statusIndex).toUpperCase().replace(/[\s-]+/g, "_");
        const status = rawStatus === "CLOSED_WON" || rawStatus === "WON" ? "CUSTOMER" : rawStatus === "CLOSED_LOST" || rawStatus === "NOT_A_LEAD" ? "LOST" : rawStatus;
        return {
          name: get(row, nameIndex), username: get(row, usernameIndex), email: get(row, emailIndex), phone: get(row, phoneIndex), company: get(row, companyIndex), notes: get(row, notesIndex),
          temperature: temperature || "WARM",
          status: status || "NEW",
        };
      }).filter((lead) => lead.name);
      if (!imported.length) throw new Error("No rows with a name were found.");
      const response = await calendarMutationFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "IMPORT", leads: imported }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not import leads.");
      setNotice(`${result.created} lead${result.created === 1 ? "" : "s"} imported${result.skipped ? `; ${result.skipped} duplicate email${result.skipped === 1 ? "" : "s"} skipped` : ""}.`);
      await load(true);
      announceLeadChange(calendarId);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not import this CSV."); }
    finally { setSaving(false); }
  }

  function exportCsv() {
    const header = ["Name", "Username", "Email", "Phone", "Company", "Temperature", "Status", "Source", ...(!clientSlug ? ["Notes"] : []), "Created", "Updated"];
    const rows = visibleLeads.map((lead) => [lead.name, lead.username, lead.email, lead.phone, lead.company, title(lead.temperature), title(lead.status), title(lead.source), ...(!clientSlug ? [lead.notes] : []), lead.createdAt, lead.updatedAt]);
    const blob = new Blob([[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "showwork-leads.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <section className={`${styles.page} space-y-5`} aria-label="Leads">
    {featureLocked && <WorkspaceFeatureNotice compact feature="leadManagement" />}
    <header className={styles.hero}>
      <div className={styles.heroIdentity}><span className={styles.heroIcon}><ContactRound size={22}/></span><div><p className={styles.eyebrow}>Leads & relationships</p><h2>From first hello.<br/><span>To your next customer.</span></h2><p className={styles.intro}>{clientSlug ? "Explore your leads, contact details and progress. This view is read-only." : "Know who to follow up with. Turn promising conversations into lasting relationships."}</p></div></div>
      <div className="flex flex-wrap gap-2">{canEdit && <><button type="button" onClick={() => fileRef.current?.click()} disabled={saving || featureLocked} className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#344054] disabled:opacity-60"><FileUp className="h-4 w-4" />Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" /><button type="button" disabled={featureLocked} onClick={() => openForm()} className="inline-flex items-center gap-2 rounded-lg bg-[#1768E8] px-3.5 py-2.5 text-xs font-semibold text-white"><Plus className="h-4 w-4" />Add lead</button></>}</div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{notice}</p>}

    <div className={styles.metrics}><Metric icon={Users} label="Active leads" value={loading && !leads.length ? "—" : activeCount} /><Metric icon={Flame} label="Hot opportunities" value={loading && !leads.length ? "—" : hotCount} accent /><Metric icon={BadgeCheck} label="Converted customers" value={loading && !leads.length ? "—" : customers} /><Metric icon={ChartNoAxesCombined} label="Lead conversion" value={loading && !leads.length ? "—" : `${conversionRate}%`} detail={`${customers} of ${leads.length} leads`} /></div>

    <div className={styles.directory}>
      <div className={styles.directoryHeading}><div><span>Your relationship pipeline</span><h3>Every opportunity, in view.</h3></div><p>Choose a stage to focus your follow-up.</p></div>
      <nav className={styles.stageTabs} aria-label="Lead pipeline stages">
        {["", ...STATUSES].map(stage => <button key={stage} type="button" aria-pressed={statusFilter === stage} onClick={() => { setStatusFilter(stage); setPage(1); }}><i data-stage={stage || "ALL"}/>{stage ? title(stage) : "All leads"}<span>{loading && !leads.length ? "—" : stage ? leads.filter(lead => lead.status === stage).length : leads.length}</span></button>)}
      </nav>
      <div className="flex flex-col gap-3 border-b border-[#E9EDF3] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-1 flex-wrap gap-2"><label className="relative min-w-[210px] flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} aria-label="Search leads" placeholder="Search name, email, phone, company" className="w-full rounded-lg border border-[#D0D5DD] py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-400" /></label><select aria-label="Filter leads by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs"><option value="">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select><select aria-label="Filter leads by temperature" value={temperatureFilter} onChange={(event) => { setTemperatureFilter(event.target.value); setPage(1); }} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs"><option value="">All temperatures</option>{TEMPERATURES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div><div className="flex items-center gap-2"><span className="text-[11px] text-[#667085]">{visibleLeads.length} lead{visibleLeads.length === 1 ? "" : "s"}</span><button type="button" onClick={exportCsv} disabled={!visibleLeads.length} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-50"><Download className="h-3.5 w-3.5" />Export CSV</button><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh leads" className="rounded-lg border border-[#D0D5DD] p-2 text-[#667085] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div></div>
      {loading && !leads.length ? <div className="p-12 text-center text-sm text-[#667085]">Loading leads…</div> : visibleLeads.length ? <div className="overflow-x-auto"><table className={styles.table}><caption className="sr-only">Leads matching the current filters</caption><thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wide text-[#667085]"><tr><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Temperature</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-[#EEF1F5]">{pageLeads.map((lead) => { const platformName = lead.socialPlatform === "WHATSAPP" ? "WhatsApp" : lead.socialPlatform ? lead.socialPlatform.charAt(0) + lead.socialPlatform.slice(1).toLowerCase() : null; const socialLabel = lead.username ? `${platformName ? `${platformName} · ` : ""}${lead.socialPlatform === "WHATSAPP" ? "" : "@"}${lead.username}` : lead.socialUserId ? `${platformName || "Social"} ID: ${lead.socialUserId}` : null; return <tr key={lead.id} className="text-xs hover:bg-[#FBFCFE]"><td data-label="Contact" className="px-4 py-3"><span className={styles.contactAvatar} aria-hidden="true">{lead.name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase()}</span><p className="font-semibold text-[#101828]">{lead.name}</p><p className="mt-1 text-[10px] text-[#667085]">{[socialLabel, lead.email, lead.phone].filter(Boolean).join(" · ") || "No username, email, or phone added"}</p></td><td data-label="Company" className="px-4 py-3 text-[#475467]">{lead.company || "—"}</td><td data-label="Temperature" className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${lead.temperature === "HOT" ? "bg-rose-50 text-rose-700" : lead.temperature === "WARM" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{title(lead.temperature)}</span></td><td data-label="Status" className="px-4 py-3"><span data-status={lead.status} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{title(lead.status)}</span></td><td data-label="Source" className="px-4 py-3 text-[#667085]"><span className={styles.source}>{lead.socialPlatform && <PlatformBrandIcon platform={lead.socialPlatform} size={14}/ >}{title(lead.source)}</span></td><td data-label="Updated" className="px-4 py-3 text-[#667085]">{new Date(lead.updatedAt).toLocaleDateString()}</td><td data-label="Actions" className="px-4 py-3 text-right">{!canEdit && <button type="button" onClick={()=>setViewingLead(lead)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-[10px] font-semibold text-[#344054] hover:bg-slate-50">View details</button>}{canEdit && <button type="button" disabled={featureLocked} onClick={() => openForm(lead)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-[10px] font-semibold text-[#344054] hover:bg-slate-50">Edit</button>}</td></tr>; })}</tbody></table></div> : <div className="px-6 py-14 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-[#344054]">{leads.length ? "No leads match these filters" : "No leads yet"}</p><p className="mt-1 text-xs text-[#667085]">{clientSlug ? "Your team’s leads will appear here as they are captured." : "Add a contact, import a CSV, or capture a social conversation in Inbox."}</p>{canEdit && !leads.length && <button type="button" disabled={featureLocked} onClick={() => openForm()} className="mt-4 rounded-lg bg-[#1768E8] px-4 py-2 text-xs font-semibold text-white">Add your first lead</button>}</div>}
      {!loading && visibleLeads.length > 0 && <nav aria-label="Leads pagination" className="flex flex-col gap-3 border-t border-[#DFE6EF] bg-[#F8FAFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-[#607898]" role="status">Showing <span className="font-semibold text-[#29476C]">{pageStart + 1}–{Math.min(pageStart + pageSize, visibleLeads.length)}</span> of {visibleLeads.length} leads</p>
          <label className="flex items-center gap-2 text-xs text-[#607898]">Per page<select aria-label="Leads per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-10 rounded-lg border border-[#CCD9EB] bg-white px-2 text-xs text-[#29476C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8]">{[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Previous leads page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#CCD9EB] bg-white px-3 text-xs font-medium text-[#35577E] hover:bg-[#EAF2FF] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8]"><ChevronLeft size={15} aria-hidden="true" /><span className="hidden sm:inline">Previous</span></button>
          {pageNumbers.map((value, index) => <span key={value} className="inline-flex items-center gap-1">{index > 0 && value - pageNumbers[index - 1] > 1 && <span aria-hidden="true" className="px-1 text-[#7890AE]">…</span>}<button type="button" aria-label={`Go to leads page ${value}`} aria-current={value === currentPage ? "page" : undefined} onClick={() => setPage(value)} className={`min-h-10 min-w-10 rounded-lg px-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8] ${value === currentPage ? "bg-[#225FC7] text-white shadow-sm" : "text-[#536F93] hover:bg-[#E4EEFD]"}`}>{value}</button></span>)}
          <button type="button" aria-label="Next leads page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#CCD9EB] bg-white px-3 text-xs font-medium text-[#35577E] hover:bg-[#EAF2FF] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1768E8]"><span className="hidden sm:inline">Next</span><ChevronRight size={15} aria-hidden="true" /></button>
        </div>
      </nav>}

    </div>

    {viewingLead && <dialog ref={viewDialog} className={styles.readDialog} aria-labelledby="shared-lead-title" onCancel={()=>setViewingLead(null)} onClick={event=>{if(event.target===event.currentTarget){const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)setViewingLead(null);}}}>
      <header><div><p>Lead details · read-only</p><h3 id="shared-lead-title">{viewingLead.name}</h3></div><button type="button" aria-label="Close lead details" onClick={()=>setViewingLead(null)}><X size={18}/></button></header>
      <dl>{[["Email",viewingLead.email],["Phone",viewingLead.phone],["Company",viewingLead.company],["Username",viewingLead.username],["Channel",viewingLead.socialPlatform],["Temperature",title(viewingLead.temperature)],["Stage",title(viewingLead.status)],["Source",title(viewingLead.source)],["Added",new Date(viewingLead.createdAt).toLocaleDateString()],["Last updated",new Date(viewingLead.updatedAt).toLocaleDateString()],...(!clientSlug ? [["Notes",viewingLead.notes]] : [])].filter(([,value])=>value).map(([label,value])=><div key={label!}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <button type="button" className={styles.readDone} onClick={()=>setViewingLead(null)}>Done</button>
    </dialog>}
    {modalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#101828]/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><form role="dialog" aria-modal="true" aria-labelledby="lead-dialog-title" onSubmit={saveLead} className={`${styles.dialog} my-6 w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6`}><div className="mb-5 flex items-start justify-between"><div><h3 id="lead-dialog-title" className="text-lg font-semibold text-[#101828]">{editing ? "Edit lead" : "Add a lead"}</h3><p className="mt-1 text-xs text-[#667085]">Contact details, qualification, and pipeline stage.</p></div><button type="button" aria-label="Close" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-[#667085] hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Name *" value={form.name} onChange={(name) => setForm({ ...form, name })} required /><Field label="Username or social handle" value={form.username || ""} onChange={(username) => setForm({ ...form, username })} /><Field label="Email" type="email" value={form.email || ""} onChange={(email) => setForm({ ...form, email })} /><Field label="Phone" type="tel" value={form.phone || ""} onChange={(phone) => setForm({ ...form, phone })} /><Field label="Company" value={form.company || ""} onChange={(company) => setForm({ ...form, company })} /><label className="text-[11px] font-semibold text-[#475467]">Temperature<select value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value as Lead["temperature"] })} className="mt-1.5 block w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-xs">{TEMPERATURES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></label><label className="text-[11px] font-semibold text-[#475467]">Pipeline status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Lead["status"] })} className="mt-1.5 block w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-xs">{STATUSES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></label><label className="text-[11px] font-semibold text-[#475467] sm:col-span-2">Notes<textarea rows={3} value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1.5 block w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-xs" /></label></div>{error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}{featureLocked && <WorkspaceFeatureNotice compact feature="leadManagement" />}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#D0D5DD] px-4 py-2.5 text-xs font-semibold text-[#344054]">Cancel</button><button type="submit" disabled={saving || featureLocked} className="rounded-lg bg-[#1768E8] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : editing ? "Save changes" : "Add lead"}</button></div></form></div>}
  </section>;
}

function Metric({ icon: Icon, label, value, accent = false, detail }: { icon: typeof Users; label: string; value: number | string; accent?: boolean; detail?: string }) {
  return <div className={styles.metric}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-700"}`}><Icon className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold text-[#667085]">{label}</p><p className="mt-0.5 text-xl font-semibold text-[#101828]">{value}</p>{detail && <p className="text-[9px] text-[#98A2B3]">{detail}</p>}</div></div>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-[11px] font-semibold text-[#475467]">{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-xs outline-none focus:border-blue-400" /></label>;
}
