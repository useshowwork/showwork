"use client";

import { useState } from "react";
import { Layers3, ArrowRight, X } from "lucide-react";
import { calendarMutationFetch } from "@/lib/publishing/clientRequests";
import type { CalendarPostData } from "./CalendarGrid";
import { mediaDestinationLocked, sameDayMediaDestinations, reusePostMedia } from "@/lib/calendarMediaReuse";
import styles from "./ReusePostMedia.module.css";

type Props = {
  calendarId: string;
  source: CalendarPostData;
  posts: CalendarPostData[];
  canReplace: boolean;
  onUpdated: (post: CalendarPostData) => void;
};

export default function ReusePostMedia({ calendarId, source, posts, canReplace, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const candidates = sameDayMediaDestinations(source, posts);
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id];
  const apply = async () => {
    setBusy(true); setErrors([]); setMessage("");
    const failures: string[] = [];
    const completed: string[] = [];
    for (const destination of candidates.filter(post => selected.includes(post.id))) {
      try {
        await reusePostMedia({ calendarId, source, destination, fileKeys: files, replace, canReplace, request: calendarMutationFetch, onUpdated });
        completed.push(destination.id);
      } catch (error) {
        failures.push(`${destination.platform} · ${new Date(destination.postDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: ${error instanceof Error ? error.message : "Unable to apply media."}`);
      }
    }
    setSelected(previous => previous.filter(id => !completed.includes(id)));
    setErrors(failures);
    setMessage(completed.length ? `Media applied to ${completed.length} ${completed.length === 1 ? "post" : "posts"}.` : "");
    setBusy(false);
  };

  return <div className={styles.root}>
    <button type="button" className={styles.trigger} aria-expanded={open} onClick={() => {
      if (!open) { setFiles(source.assets.map(asset => asset.fileKey)); setSelected([]); setErrors([]); setMessage(""); }
      setOpen(!open);
    }} disabled={busy}><Layers3 size={18} aria-hidden="true" /><span>Also use for…<small>Share these files with other posts on this date</small></span><ArrowRight size={18} aria-hidden="true" /></button>
    {open && <section className={styles.panel} aria-label="Reuse media on same-day posts" aria-busy={busy}>
      <header><div><strong>One upload. More platforms.</strong><p>Choose posts for {new Date(source.postDate).toLocaleDateString([], { month: "short", day: "numeric" })}.</p></div><button type="button" aria-label="Close media picker" onClick={() => setOpen(false)} disabled={busy}><X size={18}/></button></header>
      <fieldset disabled={busy}><legend>Files to reuse</legend>
        <div className={styles.files}>{source.assets.map((asset, index) => <label key={asset.id}>
          <input type="checkbox" checked={files.includes(asset.fileKey)} onChange={() => setFiles(toggle(files, asset.fileKey))}/>
          {asset.mediaType === "PHOTO" ? <img src={asset.contentUrl} alt={`Uploaded image ${index + 1}`}/> : <span>{asset.mediaType.toLowerCase()}</span>}
          <span>File {index + 1}</span>
        </label>)}</div>
      </fieldset>
      <fieldset disabled={busy}><legend>Destination posts</legend>
        {!candidates.length && <p className={styles.empty}>No other posts on this date. Add a post to another platform, then return here.</p>}
        {candidates.map(post => {
          const locked = mediaDestinationLocked(post);
          const title = post.creativeBrief?.title || post.hook || post.caption || post.contentIdea || "Untitled post";
          return <label key={post.id} className={styles.destination} data-locked={locked}>
            <input type="checkbox" disabled={locked} checked={selected.includes(post.id)} onChange={() => setSelected(toggle(selected, post.id))}/>
            <span><strong>{post.platform.charAt(0) + post.platform.slice(1).toLowerCase()} <small>{new Date(post.postDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></strong><span className={styles.title}>{title}</span><small>{locked ? "Locked · request a revision to change media" : post.assets.length ? `${post.assets.length} existing ${post.assets.length === 1 ? "file" : "files"}` : "No media yet"}</small></span>
          </label>;
        })}
      </fieldset>
      {canReplace && <label className={styles.replace}><input type="checkbox" checked={replace} disabled={busy} onChange={event => setReplace(event.target.checked)}/>Replace existing media on selected posts</label>}
      <p className={styles.note}>{replace && canReplace ? "Existing media will be removed after the selected files are added." : "Files are added alongside existing media. Duplicate files are skipped."} Copy and schedules stay the same. Changed posts need a fresh review.</p>
      <button type="button" className={styles.apply} disabled={busy || !selected.length || !files.length} onClick={() => void apply()}>{busy ? "Applying…" : `Apply to ${selected.length} ${selected.length === 1 ? "post" : "posts"}`}</button>
      {message && <p role="status" className={styles.success}>{message}</p>}
      {!!errors.length && <div role="alert" className={styles.errors}><strong>Some posts could not be completed. Saved changes are kept; you can retry.</strong>{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
    </section>}
  </div>;
}
