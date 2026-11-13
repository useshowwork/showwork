"use client";
import { useRef, useState } from "react";
import { CheckCheck, Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import { approveCalendarPosts, canBulkApproveClient, canBulkApproveInternal } from "@/lib/calendarBulkApproval";
import styles from "./BulkApprovalBubble.module.css";

type Post = Parameters<typeof canBulkApproveInternal>[0];
export default function BulkApprovalBubble<T extends Post>({posts, mode, calendarKey, onUpdated, hidden = false}: {
  posts: T[]; mode: "internal" | "client"; calendarKey: string; onUpdated: (post: T) => void; hidden?: boolean;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({done:0,total:0});
  const [result, setResult] = useState<Awaited<ReturnType<typeof approveCalendarPosts>> | null>(null);
  const count = posts.filter(mode === "internal" ? canBulkApproveInternal : canBulkApproveClient).length;
  async function approveAll() {
    if (inFlight.current || !count) return;
    inFlight.current = true; setBusy(true); setResult(null); setProgress({done:0,total:count});
    try {
      setResult(await approveCalendarPosts({ posts, mode, calendarKey, request: calendarMutationFetch, onUpdated, onProgress:(done,total)=>setProgress({done,total}) }));
    } finally {
      inFlight.current = false; setBusy(false); router.refresh();
    }
  }
  if (hidden || (!count && !busy && !result)) return null;
  return <aside className={styles.root} aria-label={mode === "internal" ? "Bulk internal approval" : "Bulk client approval"}>
    {result && <div className={styles.result}>
      <button type="button" aria-label="Dismiss approval result" className={styles.dismiss} onClick={()=>setResult(null)}><X size={15}/></button>
      <p role="status"><Check size={16} aria-hidden="true"/>{result.approved} {result.approved === 1 ? "post approved" : "posts approved"}{mode === "internal" ? " internally" : ""}.</p>
      {!!result.failures.length && <details><summary>{result.failures.length} could not be approved</summary><ul>{result.failures.map(failure=>{
        const post=posts.find(post=>post.id===failure.id);
        return <li key={failure.id}>{post?.platform || "Post"}: {failure.message}</li>;
      })}</ul><p>Successful approvals are saved. Resolve these issues and try again.</p></details>}
    </div>}
    {(count > 0 || busy) && <button type="button" className={styles.bubble} disabled={busy} onClick={()=>void approveAll()} aria-label={`${mode === "internal" ? "Approve all internal content" : "Approve all posts"}: ${count} posts across this calendar`}>
      <span className={styles.icon}>{busy ? <Loader2 size={20} className={styles.spinner}/> : <CheckCheck size={21}/>}</span>
      <span><strong>{busy ? `Approving ${progress.done} of ${progress.total}…` : mode === "internal" ? "Approve all internal content" : "Approve all posts"}</strong><small>{busy ? "Keep this calendar open" : `${count} ${count === 1 ? "post" : "posts"} across this calendar`}</small></span>
    </button>}
    {busy && <span role="status" className="sr-only">Processed {progress.done} of {progress.total} posts.</span>}
  </aside>;
}
