"use client";

import { useState } from 'react';
import { ArrowRight, FileText, FolderOpen, Image, Layers, Search, Video } from 'lucide-react';
import PortfolioAddSection from './PortfolioAddSection';
import PortfolioSectionHeader from './PortfolioSectionHeader';
import PortfolioFileGridItem from './PortfolioFileGridItem';
import styles from './PortfolioWorkStudio.module.css';

type MediaType = 'PHOTO' | 'VIDEO' | 'PDF' | 'DOCUMENT';
type Section = { id:string; name:string; mediaType:MediaType; coverMediaId:string|null; media:{id:string;url:string;posterUrl:string|null;filename:string;type:MediaType}[] };
const mediaLabels:Record<MediaType,string> = { PHOTO:'Photos', VIDEO:'Videos', PDF:'PDFs', DOCUMENT:'Documents' };
function SectionIcon({type}:{type:MediaType}) { const Icon=type==='PHOTO'?Image:type==='VIDEO'?Video:FileText;return <Icon size={17} aria-hidden="true"/>; }

export default function PortfolioWorkStudio({sections}:{sections:Section[]}) {
  const [selected,setSelected] = useState(sections[0]?.id ?? '');
  const [query,setQuery] = useState('');
  const active = sections.find(section=>section.id===selected) ?? sections[0];
  const matching = sections.filter(section=>section.name.toLowerCase().includes(query.trim().toLowerCase()));
  const totalFiles=sections.reduce((count,section)=>count+section.media.length,0);
  return <div className={styles.studio}>
    <div className={styles.toolbar}>
      <div className={styles.summary}><span><Layers size={15}/>{sections.length} {sections.length===1?'section':'sections'}</span><span>{totalFiles} {totalFiles===1?'file':'files'}</span></div>
      <p>Group your work. Add your best pieces. Choose a cover.</p>
    </div>
    <div className={styles.createArea}><PortfolioAddSection hasSections={sections.length>0} compact /></div>
    {!sections.length ? <div className={styles.empty}>
      <span className={styles.emptyIcon}><FolderOpen size={29}/></span>
      <h3>Make room for your best work.</h3>
      <p>Create a section, then add the photos, videos, or documents you want clients to see.</p>
      <div className={styles.examples}><span>Brand films</span><span>Photography</span><span>Case studies</span></div>
      <span className={styles.emptyHint}>Start with “Add your first section” above.</span>
    </div> : <div className={styles.layout}>
      <aside className={styles.sectionList} aria-label="Your portfolio sections">
        <div className={styles.listHeading}><h3>Your sections</h3><span>{sections.length}</span></div>
        {sections.length>4 && <label className={styles.search}><Search size={14}/><span className="sr-only">Find a portfolio section</span><input type="search" placeholder="Find a section" value={query} onChange={event=>setQuery(event.target.value)}/></label>}
        <nav aria-label="Choose a section">{matching.map(section=><button key={section.id} type="button" aria-current={active?.id===section.id?'true':undefined} aria-controls={`portfolio-section-${section.id}`} onClick={()=>{ if(active?.id!==section.id) document.getElementById(`portfolio-section-${active?.id}`)?.querySelectorAll("video").forEach(video=>video.pause()); setSelected(section.id); }}>
          <span className={styles.sectionIcon}><SectionIcon type={section.mediaType}/></span>
          <span className={styles.sectionName}><strong>{section.name}</strong><small>{mediaLabels[section.mediaType]} · {section.media.length} {section.media.length===1?'file':'files'}</small></span>
          <ArrowRight size={14} className={styles.sectionArrow}/>
        </button>)}</nav>
        {!matching.length && <p className={styles.noResults}>No matching sections. Try another name.</p>}
        <p className={styles.listNote}>Select a section to manage its files.</p>
      </aside>
      <div className={styles.workspace}>
        {sections.map(section=><section key={section.id} id={`portfolio-section-${section.id}`} hidden={active?.id!==section.id} aria-label={section.name} className={styles.sectionPanel}>
          <div className={styles.sectionHeader}><PortfolioSectionHeader sectionId={section.id} name={section.name} mediaType={section.mediaType} fileCount={section.media.length}/></div>
          {section.media.length>0 ? <>
            <div className={styles.galleryHeading}><p>{mediaLabels[section.mediaType]}</p><small>The cover is the first image visitors see for this section.</small></div>
            <div className={`${styles.gallery} ${section.mediaType==='DOCUMENT'||section.mediaType==='PDF'?styles.documents:''}`}>
              {section.media.map(media=><div key={media.id} className={styles.mediaTile}><PortfolioFileGridItem mediaId={media.id} url={media.url} posterUrl={media.posterUrl} filename={media.filename} type={media.type} sectionId={section.id} isCover={section.coverMediaId?section.coverMediaId===media.id:media.id===section.media[0]?.id}/></div>)}
            </div>
          </> : <div className={styles.sectionEmpty}><FolderOpen size={26}/><h4>This section is ready for your work.</h4><p>Choose “Add files” above to upload your first pieces.</p></div>}
        </section>)}
      </div>
    </div>}
  </div>;
}
