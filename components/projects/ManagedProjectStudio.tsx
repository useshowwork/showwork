"use client";
import ShowworkLogo from "@/components/brand/ShowworkLogo";

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpenText, CheckSquare, Send, Users } from 'lucide-react';
import DeliveryHelpLink from '@/components/help/DeliveryHelpLink';
import CopyLinkButton from '@/components/CopyLinkButton';
import styles from './ManagedProjectStudio.module.css';
type View='brief'|'team'|'tasks'|'deliver';
type Props={name:string;status:string;isOwner:boolean;portalUrl:string|null;accessCode:string|null;brief:ReactNode;team:ReactNode;tasks:ReactNode;deliver:ReactNode};
export default function ManagedProjectStudio({name,status,isOwner,portalUrl,accessCode,brief,team,tasks,deliver}:Props){
 const [active,setActive]=useState<View>('brief');
 useEffect(()=>{
   const read=()=>{const hash=window.location.hash.slice(1);const view=hash==='publish'?'deliver':hash;if(['brief','team','tasks',...(isOwner?['deliver']:[])].includes(view))setActive(view as View);};
   read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);
 },[isOwner]);
 const select=(view:View)=>{setActive(view);window.history.replaceState(window.history.state,'',`#${view==='deliver'?'publish':view}`);};
 const sections=[{id:'brief' as const,label:'Project brief',description:'Give everyone a clear starting point.',icon:BookOpenText,content:brief},{id:'team' as const,label:'Team',description:'Bring the right people into the project.',icon:Users,content:team},{id:'tasks' as const,label:'Tasks',description:'Plan the work, assign tasks, and track progress.',icon:CheckSquare,content:tasks},...(isOwner?[{id:'deliver' as const,label:'Deliver',description:'Publish approved work to your client’s delivery.',icon:Send,content:deliver}]:[])];
 const current=sections.find(section=>section.id===active)??sections[0];
 return <main className={styles.frame}>
   <aside className={styles.rail} aria-label="Managed project navigation"><div className={styles.identity}><Link href="/dashboard" className={styles.brand}><ShowworkLogo tone="white"/></Link><p>MANAGED PROJECT</p><h1 title={name}>{name}</h1><span>{isOwner?'Project owner':'Collaborator'}</span></div><nav>{sections.map(({id,label,icon:Icon})=><button key={id} type="button" aria-current={current.id===id?'page':undefined} aria-controls={`managed-panel-${id}`} onClick={()=>select(id)}><Icon size={18}/><span>{label}</span>{current.id===id&&<ArrowRight size={14}/>}</button>)}</nav><div className={styles.projectStatus}><p>PROJECT STATUS</p><strong>{status}</strong><small>Your brief, team, and work in one place.</small></div><footer><DeliveryHelpLink className={styles.railHelp}/><Link href="/dashboard/projects"><ArrowLeft size={16}/>All projects</Link></footer></aside>
   <header className={styles.toolbar}><div><current.icon size={16}/><strong>{current.label}</strong><span>{name}</span></div><div><span className={styles.statusBadge}>{status}</span>{portalUrl&&<a href={portalUrl} target="_blank" rel="noopener noreferrer">Client portal <ArrowUpRight size={14}/></a>}</div></header>
   <section className={styles.content} aria-label="Managed project workspace"><div className={styles.pageHeading}><p>PROJECT DELIVERY</p><h2>{current.label}</h2><span>{current.description}</span></div>
     <nav className={styles.mobileNav} aria-label="Managed project sections">{sections.map(section=><button key={section.id} type="button" aria-current={current.id===section.id?'page':undefined} onClick={()=>select(section.id)}>{section.label}</button>)}</nav>
     {sections.map(section=><div key={section.id} id={`managed-panel-${section.id}`} hidden={section.id!==current.id} className={styles.toolPanel} aria-label={section.label}>{section.content}</div>)}
     {portalUrl&&<details className={styles.portal}><summary>Client portal <ArrowUpRight size={14}/></summary><p>Share this link when your client needs to view their delivery.</p><div><a href={portalUrl} target="_blank" rel="noopener noreferrer">{portalUrl}</a><CopyLinkButton url={portalUrl} appearance="light" label="Copy client portal link"/></div>{isOwner&&accessCode&&<div><span>Access code <strong>{accessCode}</strong></span><CopyLinkButton url={accessCode} appearance="light" label="Copy client access code"/></div>}</details>}
     <footer className={styles.pageFooter}><span>Showwork · Project Delivery</span><Link href="/dashboard/projects">Back to projects</Link></footer>
   </section>
 </main>;
}
