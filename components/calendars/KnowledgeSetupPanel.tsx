"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpenText, Check, Fingerprint } from "lucide-react";
import styles from "./KnowledgeSetupPanel.module.css";

export default function KnowledgeSetupPanel({calendarId,hasKnowledge,hasBrandVoice,sourceCount,nextSection,knowledge,voice}: {calendarId:string;hasKnowledge:boolean;hasBrandVoice:boolean;sourceCount:number;nextSection?:"channels"|"generate";knowledge:ReactNode;voice:ReactNode}) {
  const [guided] = useState(!hasBrandVoice);
  const [step,setStep] = useState<"knowledge"|"voice"|"review">(hasKnowledge && !hasBrandVoice ? "voice" : "knowledge");
  const [knowledgeReady,setKnowledgeReady]=useState(hasKnowledge);
  const [voiceReady,setVoiceReady]=useState(hasBrandVoice);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>setKnowledgeReady(hasKnowledge),[hasKnowledge]);
  useEffect(()=>setVoiceReady(hasBrandVoice),[hasBrandVoice]);
  function move(next:typeof step){setStep(next);requestAnimationFrame(()=>heading.current?.focus());}
  useEffect(()=>{
    const focus=(event:Event)=>{if((event as CustomEvent).detail?.calendarId !== calendarId)return;setKnowledgeReady(true);move("voice");};
    const saved=(event:Event)=>{if((event as CustomEvent).detail?.calendarId !== calendarId)return;setVoiceReady(true);if(guided)move("review");};
    window.addEventListener("showwork-brand-voice-focus",focus);window.addEventListener("showwork-brand-voice-saved",saved);
    return ()=>{window.removeEventListener("showwork-brand-voice-focus",focus);window.removeEventListener("showwork-brand-voice-saved",saved);};
  },[calendarId,guided]);
  const titles={knowledge:"Add your business knowledge",voice:"Make it sound like your brand",review:"Your business foundation is ready"};
  const descriptions={knowledge:"Upload documents or add your website.",voice:"Choose the personality and tone behind your content.",review:"Your sources and saved brand voice will guide your content."};
  return <section className={styles.panel} aria-label="Business knowledge and brand voice">
    <header className={styles.header}>{guided && <div className={styles.progress}><span>Step {step === "knowledge" ? 1 : step === "voice" ? 2 : 3} of 3</span><progress value={step === "knowledge" ? 1 : step === "voice" ? 2 : 3} max={3} aria-label="Business knowledge setup progress"/></div>}<h1 ref={heading} tabIndex={-1}>{guided ? titles[step] : "Business knowledge & brand voice"}</h1><p>{guided ? descriptions[step] : "Keep your business facts and brand personality up to date."}</p></header>
    {!guided && <div className={styles.tabs} role="tablist" aria-label="Knowledge settings">{([['knowledge','Business knowledge',BookOpenText],['voice','Brand voice',Fingerprint]] as const).map(([id,label,Icon],index)=><button type="button" key={id} id={`knowledge-tab-${id}`} role="tab" aria-selected={step===id} aria-controls={`knowledge-panel-${id}`} tabIndex={step===id?0:-1} onClick={()=>move(id)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'knowledge':event.key==='End'?'voice':index===0?'voice':'knowledge';move(next);document.getElementById(`knowledge-tab-${next}`)?.focus();}}}><Icon size={16}/>{label}</button>)}</div>}
    <div id="knowledge-panel-knowledge" role={guided ? undefined : "tabpanel"} aria-labelledby={guided ? undefined : "knowledge-tab-knowledge"} hidden={step!=="knowledge"} className={styles.content}>{knowledge}</div>
    <div id="knowledge-panel-voice" role={guided ? undefined : "tabpanel"} aria-labelledby={guided ? undefined : "knowledge-tab-voice"} hidden={step!=="voice"} className={styles.content}>{voice}</div>
    {step === "review" && <div className={styles.review}><div><Check size={19}/><span>Business sources added{sourceCount ? ` · ${sourceCount} sources` : ""}</span><button type="button" onClick={()=>move("knowledge")}>Review</button></div><div><Check size={19}/><span>Brand voice saved</span><button type="button" onClick={()=>move("voice")}>Edit</button></div></div>}
    {guided && <footer className={styles.footer}><button type="button" className={styles.back} disabled={step==="knowledge"} onClick={()=>move(step==="review"?"voice":"knowledge")}>Back</button>{step==="knowledge" ? <button type="button" className={styles.primary} disabled={!knowledgeReady} onClick={()=>move("voice")}>Next: Brand voice <ArrowRight size={15}/></button> : step==="voice" ? <span>Save your brand voice to continue.</span> : nextSection ? <button type="button" className={styles.primary} disabled={!knowledgeReady||!voiceReady} onClick={()=>window.dispatchEvent(new CustomEvent("showwork-workspace-navigate",{detail:{id:nextSection}}))}>{nextSection==="channels"?"Connect channels":"Generate calendar"}<ArrowRight size={15}/></button> : <span>Knowledge and brand voice saved.</span>}</footer>}
  </section>;
}
