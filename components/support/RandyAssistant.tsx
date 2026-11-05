"use client";
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight,BookOpenText,Check,ChevronDown,LifeBuoy,Loader2,Minus,Plus,Send,Info} from 'lucide-react';
import {humanSupportUrl,randyProduct,RANDY_PRODUCTS} from '@/lib/help/randyContext';
import type {RandyAnswer,RandyTurn} from '@/lib/help/randy';
import {helpHref,type HelpProduct} from '@/lib/help/routes';
import styles from './RandyAssistant.module.css';
import RandyAvatar from './RandyAvatar';
import {isClientView} from '@/lib/support/visibility';
type Message={id:string;role:'user';text:string}|{id:string;role:'assistant';result:RandyAnswer};
const prompts:Record<HelpProduct,string[]>={workspace:['How do I create content with AI?','How do internal approvals work?','How do I connect Instagram?'],delivery:['How do I upload files?','How do I release client downloads?','How do managed projects work?'],portfolio:['How do I add videos?','How do I change my banner?','How do I collect testimonials?']};
export default function RandyAssistant({hideLauncher=false}:{hideLauncher?:boolean}={}){
 const pathname=usePathname()||'/';
 const [open,setOpen]=useState(false),[mounted,setMounted]=useState(false),[product,setProduct]=useState<HelpProduct>(()=>randyProduct(pathname));
 const [messages,setMessages]=useState<Message[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [guideId,setGuideId]=useState<string|undefined>();
 const dialog=useRef<HTMLDialogElement>(null),launcher=useRef<HTMLButtonElement>(null),input=useRef<HTMLTextAreaElement>(null),end=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null),epoch=useRef(0);
 useEffect(()=>{setMounted(true);return()=>request.current?.abort();},[]);
 function reset(next=product){epoch.current++;request.current?.abort();setBusy(false);setMessages([]);setQuestion('');setError('');setGuideId(undefined);setProduct(next);}
 useEffect(()=>{reset(randyProduct(pathname));},[pathname]); // Each tool starts in its own context; no persistent transcript.
 useEffect(()=>{const show=(event:Event)=>{const detail=(event as CustomEvent<{product?:HelpProduct;guideId?:string}>).detail;if(detail?.product&&['workspace','delivery','portfolio'].includes(detail.product)){reset(detail.product);setGuideId(detail.guideId);}setOpen(true);};window.addEventListener('showwork-randy-open',show);return()=>window.removeEventListener('showwork-randy-open',show);},[]);
 useEffect(()=>{const element=dialog.current;if(!element)return;if(open&&!element.open){element.showModal();input.current?.focus();}else if(!open&&element.open){element.close();(launcher.current ?? document.querySelector<HTMLButtonElement>('[data-showwork-chat-launcher]'))?.focus();}if(!open)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[open,mounted]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest',behavior:'instant'});},[messages,busy]);
 async function ask(value=question){
  const text=value.trim();if(!text||busy)return;const version=epoch.current,controller=new AbortController();request.current=controller;
  const history:RandyTurn[]=messages.slice(-6).map(message=>message.role==='user'?{role:'user',text:message.text.slice(0,1200)}:{role:'assistant',text:[message.result.answer,...message.result.steps].join('\n').slice(0,1200)});
  setMessages(current=>[...current.slice(-39),{id:crypto.randomUUID(),role:'user',text}]);setQuestion('');setError('');setBusy(true);
  try{const response=await fetch('/api/help/randy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text,product,history,guideId}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});const result=await response.json();if(!response.ok)throw Error(result.error||'Randy could not answer right now.');if(!result||typeof result.answer!=='string'||!Array.isArray(result.steps)||!Array.isArray(result.sources))throw Error('Please try the help guides or contact our team.');if(version===epoch.current)setMessages(current=>[...current.slice(-39),{id:crypto.randomUUID(),role:'assistant',result}]);}
  catch(err){if(!controller.signal.aborted&&version===epoch.current){setError(err instanceof Error?err.message:'Connection interrupted. Try again or open the guides.');setQuestion(text);}}
  finally{if(version===epoch.current){setBusy(false);input.current?.focus();}}
 }
 const hidden=/^\/(?:login|signup|register|forgot-password|reset-password|verify|auth)(?:\/|$)/.test(pathname);
 if(!mounted||hidden||isClientView(pathname,typeof window==='undefined'?'':window.location.hostname))return null;
 return <div data-randy-assistant="true" data-showwork-support="true" data-public-portfolio={pathname.startsWith("/portfolio/")} className={styles.root}>
  {!hideLauncher && <button ref={launcher} data-randy-launcher hidden={open} type="button" onClick={()=>setOpen(true)} className={styles.launcher} aria-label="Open Randy, Showwork’s AI help assistant" title="Chat with Randy" aria-haspopup="dialog" aria-expanded={open}><RandyAvatar size={52}/></button>}
  <dialog ref={dialog} className={styles.dialog} aria-labelledby="randy-title" onCancel={event=>{event.preventDefault();setOpen(false);}} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)setOpen(false);}}}>
   <header className={styles.header}><RandyAvatar size={40}/><div><h2 id="randy-title">Randy<span>AI help</span></h2></div><button type="button" aria-label="Start a new Randy conversation" onClick={()=>reset()}><Plus size={18}/></button><button type="button" aria-label="Minimize Randy" title="Minimize chat" onClick={()=>setOpen(false)}><Minus size={19}/></button></header>
   <div className={styles.context}><label htmlFor="randy-product" className="sr-only">Showwork tool</label><span><select id="randy-product" value={product} disabled={busy} onChange={event=>reset(event.target.value as HelpProduct)}>{Object.entries(RANDY_PRODUCTS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><ChevronDown size={13}/></span><a href={helpHref(product)} target="_blank" rel="noopener noreferrer" aria-label={`Browse ${RANDY_PRODUCTS[product]} guides (opens in a new tab)`}><BookOpenText size={16}/></a></div>
   <div className={styles.history} aria-label="Conversation with Randy" aria-busy={busy} aria-live="polite" aria-relevant="additions">
    {!messages.length&&<div className={styles.welcome}><h3>Hi, I’m Randy. How can I help?</h3><p>I’m Showwork’s AI assistant. Tell me what you’re working on, and I’ll help you find your next step.</p><div className={styles.prompts}>{prompts[product].slice(0,2).map(text=><button key={text} type="button" onClick={()=>void ask(text)}>{text}<ArrowUpRight size={14}/></button>)}</div></div>}
    {messages.map(message=><div key={message.id} className={message.role==='user'?styles.userMessage:styles.answer}>{message.role==='user'?<p>{message.text}</p>:<><div className={styles.answerByline}><RandyAvatar size={22}/>Randy<small>{message.result.mode==='ai'?'AI answer':'From the help guides'}</small></div><p>{message.result.answer}</p>{message.result.steps.length>0&&<ol>{message.result.steps.map((step,index)=><li key={`${index}:${step}`}><span aria-hidden="true">{index+1}</span><p>{step}</p></li>)}</ol>}{message.result.notes.length>0&&<div className={styles.notes}>{message.result.notes.map(note=><p key={note}>{note}</p>)}</div>}{message.result.clarifyingQuestion&&<p className={styles.clarification}>{message.result.clarifyingQuestion}</p>}{message.result.sources.length>0&&<div className={styles.sources}><span><Check size={12}/>Supporting guides</span>{message.result.sources.map(source=><a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer"><BookOpenText size={13}/><span>{source.title}</span><ArrowUpRight size={13}/><span className="sr-only"> (opens in a new tab)</span></a>)}</div>}{message.result.needsHuman&&<a className={styles.humanAnswer} href={humanSupportUrl(product)} target="_blank" rel="noopener noreferrer"><LifeBuoy size={15}/>Speak to a human<ArrowUpRight size={13}/></a>}</>}</div>)}
    {busy&&<p className={styles.thinking} role="status"><Loader2 size={14} className={styles.spinner}/>Randy is checking the guides…</p>}
    {error&&<div className={styles.error} role="alert">{error}<a href={helpHref(product)} target="_blank" rel="noopener noreferrer">Browse the guides<ArrowUpRight size={12}/></a></div>}
    <div ref={end}/>
   </div>

   <form className={styles.composer} onSubmit={event=>{event.preventDefault();void ask();}}><label htmlFor="randy-question" className="sr-only">Ask Randy a Showwork help question</label><div><textarea ref={input} id="randy-question" rows={2} maxLength={2000} disabled={busy} placeholder="What would you like to do?" value={question} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void ask();}}}/><button type="submit" aria-label="Send question to Randy" disabled={busy||!question.trim()}><Send size={16}/></button></div><div className={styles.composerFooter}><a href={humanSupportUrl(product)} target="_blank" rel="noopener noreferrer"><LifeBuoy size={14}/>Speak to a human<ArrowUpRight size={12}/><span className="sr-only"> on WhatsApp (opens in a new tab)</span></a><details className={styles.privacy}><summary aria-label="About Randy and privacy" title="About Randy and privacy"><Info size={16}/></summary><p>Randy uses Showwork guides. AI answers may be imperfect. Questions and recent chat may be sent to our AI provider; don’t share passwords or private customer data. Chat clears when you leave or reload this page.</p></details></div></form>
  </dialog>
 </div>;
}
