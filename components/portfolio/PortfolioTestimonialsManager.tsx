"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, CheckCircle2, Copy, Eye, EyeOff, Link2, Loader2, MessageSquareQuote, Plus, Star, Trash2, X } from 'lucide-react';
import styles from './PortfolioTestimonials.module.css';

type Testimonial = {id:string;clientName:string;clientRole:string|null;quote:string;rating:number|null;isApproved:boolean};
type Filter = 'all' | 'pending' | 'published';
export default function PortfolioTestimonialsManager({testimonials,collectionUrl}:{testimonials:Testimonial[];collectionUrl?:string}) {
  const router=useRouter();
  const [filter,setFilter]=useState<Filter>(testimonials.some(item=>!item.isApproved)?'pending':'all');
  const [adding,setAdding]=useState(false);
  const [clientName,setClientName]=useState('');
  const [clientRole,setClientRole]=useState('');
  const [quote,setQuote]=useState('');
  const [rating,setRating]=useState(0);
  const [saving,setSaving]=useState(false);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [confirming,setConfirming]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [copied,setCopied]=useState(false);
  const linkInput=useRef<HTMLInputElement>(null);
  const addButton=useRef<HTMLButtonElement>(null);
  const pending=testimonials.filter(item=>!item.isApproved).length;
  const published=testimonials.length-pending;
  const visible=testimonials.filter(item=>filter==='all'||(filter==='published'?item.isApproved:!item.isApproved));
  const busy=saving||!!busyId;
  async function request(url:string,method:string,body?:unknown) {
    const response=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.error||'We couldn’t complete that change. Please try again.');}
  }
  async function toggle(item:Testimonial){
    if(busy)return;setBusyId(item.id);setError('');setNotice('');
    try{await request(`/api/portfolio/testimonials/${item.id}/approval`,'PATCH',{isApproved:!item.isApproved});setNotice(item.isApproved?'Testimonial hidden from your portfolio.':'Testimonial published on your portfolio.');router.refresh();}
    catch(error){setError(error instanceof Error?error.message:'Please try again.');}finally{setBusyId(null);}
  }
  async function remove(item:Testimonial){
    if(busy)return;setBusyId(item.id);setError('');setNotice('');
    try{await request(`/api/portfolio/testimonials/${item.id}`,'DELETE');setConfirming(null);setNotice('Testimonial removed.');router.refresh();}
    catch(error){setError(error instanceof Error?error.message:'Please try again.');}finally{setBusyId(null);}
  }
  async function add(){
    if(busy)return;
    if(!clientName.trim()||!quote.trim()){setError('Add the client’s name and their testimonial.');return;}
    setSaving(true);setError('');setNotice('');
    try{await request('/api/portfolio/testimonials','POST',{clientName:clientName.trim(),clientRole:clientRole.trim()||null,quote:quote.trim(),rating:rating||null});setClientName('');setClientRole('');setQuote('');setRating(0);setAdding(false);setFilter('pending');setNotice('Testimonial added. Review it before publishing.');router.refresh();addButton.current?.focus();}
    catch(error){setError(error instanceof Error?error.message:'Please try again.');}finally{setSaving(false);}
  }
  async function copy(){
    if(!collectionUrl)return;
    try{await navigator.clipboard.writeText(new URL(collectionUrl,window.location.origin).href);setCopied(true);}
    catch{linkInput.current?.focus();linkInput.current?.select();setError('Select the link and copy it to share with your client.');}
  }
  return <div className={styles.studio}>
    {collectionUrl&&<section className={styles.collect} aria-labelledby="testimonial-collect-heading">
      <span className={styles.linkIcon}><Link2 size={22}/></span>
      <div className={styles.collectCopy}><p className={styles.kicker}>INVITE A CLIENT</p><h3 id="testimonial-collect-heading">Great work deserves a few good words.</h3><p>Share your link. Your client leaves feedback, and you choose when to publish it.</p>
        <div className={styles.shareRow}><label className="sr-only" htmlFor="testimonial-collection-url">Testimonial collection link</label><input ref={linkInput} id="testimonial-collection-url" readOnly value={collectionUrl} onFocus={event=>event.target.select()}/><button type="button" className={styles.primary} onClick={()=>void copy()}>{copied?<Check size={15}/>:<Copy size={15}/>}<span role="status">{copied?'Copied':'Copy link'}</span></button></div>
        <a href={collectionUrl} target="_blank" rel="noopener noreferrer" className={styles.previewLink}>Preview the client form <ArrowUpRight size={13}/><span className="sr-only"> (opens in a new tab)</span></a>
      </div>
    </section>}
    <div className={styles.listHeader}><div><h3>Your testimonials</h3><p>{published} published · {pending} {pending===1?'needs':'need'} review</p></div><button ref={addButton} type="button" className={styles.secondary} disabled={busy} aria-expanded={adding} aria-controls="testimonial-add-form" onClick={()=>{setAdding(value=>!value);setError('');}}><Plus size={15}/>Add manually</button></div>
    {adding&&<section id="testimonial-add-form" className={styles.addPanel} aria-labelledby="testimonial-add-heading">
      <div className={styles.formHeading}><div><h4 id="testimonial-add-heading">Add a client’s testimonial</h4><p>Use their own words. You can review it before publishing.</p></div><button type="button" aria-label="Close testimonial form" disabled={saving} onClick={()=>{setAdding(false);addButton.current?.focus();}}><X size={18}/></button></div>
      <form onSubmit={event=>{event.preventDefault();void add();}}><fieldset disabled={saving}>
        <div className={styles.fields}><label>Client name<input autoFocus required value={clientName} onChange={event=>setClientName(event.target.value)} placeholder="e.g. Sarah Johnson" autoComplete="name"/></label><label>Role or company <span>Optional</span><input value={clientRole} onChange={event=>setClientRole(event.target.value)} placeholder="e.g. Founder, Studio North"/></label></div>
        <label>Testimonial<textarea required rows={4} value={quote} onChange={event=>setQuote(event.target.value)} placeholder="What did they say about working with you?"/></label>
        <div className={styles.formFooter}><div className={styles.ratingPicker} role="group" aria-label="Optional star rating"><span>Rating <small>Optional</small></span>{[1,2,3,4,5].map(value=><button key={value} type="button" aria-label={`${value} ${value===1?'star':'stars'}`} aria-pressed={rating===value} onClick={()=>setRating(rating===value?0:value)}><Star size={19} fill={value<=rating?'currentColor':'none'} data-filled={value<=rating}/></button>)}</div><button type="submit" className={styles.primary}>{saving?<Loader2 size={15} className={styles.spinner}/>:<Plus size={15}/>}{saving?'Adding…':'Add testimonial'}</button></div>
      </fieldset></form>
    </section>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {notice&&<p role="status" className={styles.notice}><CheckCircle2 size={15}/>{notice}</p>}
    <div className={styles.filters} role="group" aria-label="Filter testimonials">{([{id:'all',label:'All',count:testimonials.length},{id:'pending',label:'Needs review',count:pending},{id:'published',label:'Published',count:published}]as const).map(tab=><button key={tab.id} type="button" aria-pressed={filter===tab.id} onClick={()=>setFilter(tab.id)}>{tab.label}<span>{tab.count}</span></button>)}</div>
    {visible.length?<div className={styles.list}>{visible.map(item=><article key={item.id} className={styles.testimonial}>
      <div className={styles.cardHeader}><span className={styles.avatar} aria-hidden="true">{item.clientName.trim().slice(0,2).toUpperCase()||'CL'}</span><div className={styles.client}><h4>{item.clientName}</h4>{item.clientRole&&<p>{item.clientRole}</p>}</div><span className={styles.badge} data-published={item.isApproved}>{item.isApproved?<><Eye size={12}/>Published</>: 'Needs review'}</span></div>
      {item.rating!==null&&item.rating>0&&<div className={styles.stars} role="img" aria-label={`${item.rating} out of 5 stars`}>{[1,2,3,4,5].map(value=><Star key={value} size={13} aria-hidden="true" fill={value<=item.rating!?'currentColor':'none'} data-filled={value<=item.rating!}/>)}</div>}
      <blockquote>“{item.quote}”</blockquote>
      <div className={styles.cardFooter}><span>{item.isApproved?'Visible on your portfolio':'Not visible on your portfolio'}</span><div><button type="button" className={item.isApproved?styles.secondary:styles.primary} disabled={busy} onClick={()=>void toggle(item)}>{busyId===item.id?<Loader2 size={14} className={styles.spinner}/>:item.isApproved?<EyeOff size={14}/>:<Check size={14}/>}{item.isApproved?'Hide':'Publish'}</button><button type="button" aria-label={`Remove testimonial from ${item.clientName}`} className={styles.remove} disabled={busy} onClick={()=>setConfirming(item.id)}><Trash2 size={15}/></button></div></div>
      {confirming===item.id&&<div className={styles.confirm} role="group" aria-label="Confirm testimonial removal"><p>Remove this testimonial permanently?</p><div><button type="button" disabled={busy} className={styles.danger} onClick={()=>void remove(item)}>{busyId===item.id?'Removing…':'Remove testimonial'}</button><button type="button" disabled={busy} className={styles.secondary} onClick={()=>setConfirming(null)}>Keep it</button></div></div>}
    </article>)}</div>:<div className={styles.empty}><span><MessageSquareQuote size={28}/></span><h4>{!testimonials.length?'Your clients’ stories start here.':filter==='pending'?'You’re all caught up.':'No published testimonials yet.'}</h4><p>{!testimonials.length?'Copy your collection link and invite a client to share their experience.':filter==='pending'?'New feedback will appear here for you to review.':'Publish a testimonial from “Needs review” when you’re ready.'}</p>{filter!=='all'&&testimonials.length>0&&<button type="button" className={styles.secondary} onClick={()=>setFilter('all')}>View all testimonials</button>}</div>}
  </div>;
}
