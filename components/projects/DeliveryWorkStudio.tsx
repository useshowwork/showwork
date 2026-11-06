"use client";
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Clock3, FolderOpen, MessageSquare, Search } from 'lucide-react';
import styles from './DeliveryWorkStudio.module.css';
type Status='all'|'PENDING'|'NEEDS_REVISION'|'APPROVED';
type Section={id:string;name:string;count:number;pending:number;revisions:number;approved:number};
export default function DeliveryWorkStudio({sections,uploadAction,children,releasePanel}:{sections:Section[];uploadAction:ReactNode;children:ReactNode;releasePanel:ReactNode}){
 const [selected,setSelected]=useState(sections[0]?.id??'');
 const [filter,setFilter]=useState<Status>('all');
 const [query,setQuery]=useState('');
 const active=sections.find(section=>section.id===selected)??sections[0];
 const total=sections.reduce((sum,section)=>sum+section.count,0);
 const pending=sections.reduce((sum,section)=>sum+section.pending,0);
 const revisions=sections.reduce((sum,section)=>sum+section.revisions,0);
 const approved=sections.reduce((sum,section)=>sum+section.approved,0);
 const matches=active?(filter==='all'?active.count:filter==='PENDING'?active.pending:filter==='NEEDS_REVISION'?active.revisions:active.approved):0;
 return <div className={styles.studio}>
   <div className={styles.summary}><div><Clock3 size={16}/><span>Awaiting review<strong>{pending}</strong></span></div><div><MessageSquare size={16}/><span>Changes requested<strong>{revisions}</strong></span></div><div><CheckCircle2 size={16}/><span>Approved<strong>{approved}<small> / {total}</small></strong></span></div></div>
   <div className={styles.upload}><div><h3>Add the next piece of work.</h3><p>Create a section to group your files, or add files to an existing section below.</p></div><div>{uploadAction}</div></div>
   {!!revisions&&<p className={styles.revisionNote}><MessageSquare size={15}/>{revisions} {revisions===1?'file needs':'files need'} changes. Choose “Changes requested” to find the client’s feedback.</p>}
   {!sections.length?<div className={styles.empty}><FolderOpen size={32}/><h3>Your next delivery starts here.</h3><p>Add your first section above, then upload the work you want your client to review.</p></div>:<div className={styles.layout}>
     <aside className={styles.sectionList} aria-label="Delivery sections"><h3>Your sections <span>{sections.length}</span></h3>{sections.length>4&&<label className={styles.search}><Search size={14}/><span className="sr-only">Find a delivery section</span><input value={query} onChange={event=>setQuery(event.target.value)} type="search" placeholder="Find a section"/></label>}<nav aria-label="Choose a delivery section">{sections.filter(section=>section.name.toLowerCase().includes(query.trim().toLowerCase())).map(section=><button key={section.id} type="button" aria-current={section.id===active?.id?'true':undefined} aria-controls={`delivery-files-${section.id}`} onClick={()=>{if(active?.id!==section.id)document.getElementById(`delivery-files-${active?.id}`)?.querySelectorAll('video').forEach(video=>video.pause());setSelected(section.id);}}><FolderOpen size={17}/><span><strong>{section.name}</strong><small>{section.count} {section.count===1?'file':'files'}{section.revisions?` · ${section.revisions} need changes`:''}</small></span><ArrowRight size={13}/></button>)}</nav><p>Switch sections to manage files and feedback.</p></aside>
     <div className={styles.workspace}><div className={styles.filters} role="group" aria-label="Filter files by approval status">{([{id:'all',label:'All files'},{id:'PENDING',label:'Awaiting review'},{id:'NEEDS_REVISION',label:'Changes requested'},{id:'APPROVED',label:'Approved'}]as const).map(tab=><button key={tab.id} type="button" aria-pressed={filter===tab.id} onClick={()=>{document.getElementById(`delivery-files-${active?.id}`)?.querySelectorAll('video').forEach(video=>video.pause());setFilter(tab.id);}}>{tab.label}</button>)}</div>
       {Children.toArray(children).map(child=>{if(!isValidElement<{ 'data-delivery-section'?:string }>(child))return null;const id=child.props['data-delivery-section'];return <div key={id} id={`delivery-files-${id}`} data-filter={filter} hidden={id!==active?.id} className={styles.panel}>{child}</div>;})}
       {active&&matches===0&&<div className={styles.noMatches}><FolderOpen size={24}/><h4>{filter==='all'?'This section is ready for your files.':'No files with this status in this section.'}</h4><p>{filter==='all'?'Use the section’s upload control to add your first files.':'Choose another section or view all files.'}</p>{filter!=='all'&&<button type="button" onClick={()=>setFilter('all')}>View all files</button>}</div>}
     </div>
   </div>}
   <details className={styles.release}><summary>Delivery & download access<span>Manage final file release</span></summary><div>{releasePanel}</div></details>
 </div>;
}
