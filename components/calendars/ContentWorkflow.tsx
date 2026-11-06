'use client';
import { FilePenLine, Users, ShieldCheck, Send, Radio, LockKeyhole } from 'lucide-react';
import { calendarWorkflow, type WorkflowPost } from '@/lib/calendarWorkflow';
const steps = [
  {label:'Create',icon:FilePenLine,tab:'content'},
  {label:'Internal review',icon:ShieldCheck,tab:'internal'},
  {label:'Client review',icon:Users,tab:'client'},
  {label:'Publish',icon:Send,tab:'publishing'},
  {label:'Live',icon:Radio,tab:'publishing'},
] as const;
export default function ContentWorkflow({post,onNavigate,dark=false}:{post:WorkflowPost;onNavigate:(tab:'content'|'internal'|'client'|'publishing')=>void;dark?:boolean}) {
 const workflow=calendarWorkflow(post);
 const next = steps[Math.min(workflow.stage, steps.length - 1)];
 return <section aria-label="Content delivery progress" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${dark?'border-slate-700 bg-slate-800 text-white':'border-blue-100 bg-blue-50/60 text-slate-900'}`}>
   <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500"/><h3 className="text-sm font-semibold">{workflow.label}</h3><span className={`inline-flex items-center gap-1 text-[10px] ${dark?'text-slate-300':'text-slate-500'}`}><LockKeyhole size={11}/>{post.internalReviewStatus==='APPROVED'?'Client access enabled':'Team only'}</span></div><p className={`mt-1 text-xs leading-5 ${dark?'text-slate-300':'text-slate-500'}`}>{workflow.detail}</p></div>
   <button type="button" onClick={()=>onNavigate(next.tab)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{workflow.stage===4?'View publishing':`Next: ${next.label.toLowerCase()}`}<Send size={13}/></button>
 </section>;
}
