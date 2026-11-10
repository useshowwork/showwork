"use client";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { ArrowUpRight, ArrowRight, Sparkles, TrendingUp, Target, Lightbulb, LockKeyhole, Check } from "lucide-react";
import WorkspaceFeatureNotice from "./WorkspaceFeatureNotice";
import type { Report } from "./CalendarReportingPanel";
import styles from "./ReportingDashboard.module.css";
const kinds: Record<string,{ label:string; icon:typeof Target; tone:string }> = { WHAT_WORKED:{label:'Winning signal',icon:TrendingUp,tone:'win'}, UNDERPERFORMED:{label:'Room to improve',icon:Target,tone:'improve'}, TREND:{label:'Emerging trend',icon:Lightbulb,tone:'trend'}, RECOMMENDATION:{label:'Next experiment',icon:Sparkles,tone:'trend'} };
export default function ReportingInsights({ insights, total, filter, onFilter, analyzing, loading, canAnalyze, canApply, access, client, onAnalyze, onApplyAll, onApply }: {
  insights: Report['insights']; total:number; filter:string; onFilter:(filter:string)=>void; analyzing:boolean; loading:boolean; canAnalyze:boolean; canApply:boolean; access:boolean; client:boolean;
  onAnalyze:()=>void; onApplyAll:()=>void; onApply:(title:string,description:string,recommendation:string|null)=>void;
}) {
  const actionable=insights.filter(i=>i.recommendation?.trim()).length;
  return <section id="ai-insights" className={styles.insightSection}>
    <div className={styles.insightHeader}><div><p className={styles.kicker}><Sparkles size={13} aria-hidden="true" /> AI recommendations</p><h4>Recommendations</h4><p>Find your next content opportunity.</p></div>{!client && <button type="button" className={styles.primaryButton} disabled={analyzing||loading||!canAnalyze} onClick={onAnalyze}><Sparkles size={15} aria-hidden="true" />{analyzing?'Analyzing…':total?'Refresh AI analysis':'Get recommendations'}</button>}</div>
    {!client&&!access&&<WorkspaceFeatureNotice compact feature="performanceRecommendations"/>}
    <div className={styles.insightToolbar}><div className={styles.insightFilters} role="group" aria-label="Filter AI findings">{[['ALL','All findings'],['WHAT_WORKED','Wins'],['UNDERPERFORMED','Improve'],['TREND','Trends'],['ACTION','Next actions']].map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>onFilter(value)} className={filter===value?styles.filterActive:undefined}>{label}{value==='ALL'&&<span>{total}</span>}</button>)}</div>{!client&&actionable>0&&<button type="button" className={styles.applyAll} onClick={onApplyAll} disabled={!canApply}>Apply all recommendations <span className={styles.count}>{actionable}</span> <ArrowUpRight size={14} aria-hidden="true"/></button>}</div>
    {analyzing&&<p role="status" className={styles.infoNotice}>Finding patterns in your data and preparing your next content experiments…</p>}
    {insights.length?<div className={styles.insightGrid}>{insights.map((insight,index)=>{const kind=kinds[insight.type]||kinds.RECOMMENDATION;const Icon=kind.icon;return <article key={insight.id} className={styles.insightCard} data-tone={kind.tone}>
      <div className={styles.insightMeta}><span><Icon size={13} aria-hidden="true"/>{kind.label}</span><span className={styles.insightNumber}>{String(index+1).padStart(2,'0')}</span></div>
      <p className={styles.insightPlatform}>{insight.platform && <PlatformBrandIcon platform={insight.platform} size={13}/>}{insight.platform?insight.platform==='X'?'X':insight.platform.charAt(0)+insight.platform.slice(1).toLowerCase():'Across your channels'}</p>
      <h5>{insight.title}</h5>
      <details className={styles.evidence}><summary>Explore the evidence <ArrowRight size={13} aria-hidden="true"/></summary><p>{insight.description}</p></details>
      {insight.recommendation?.trim()&&(access?<div className={styles.nextStep}><p><Check size={12} aria-hidden="true"/>Your next experiment</p><div>{insight.recommendation}</div>{!client&&<button type="button" disabled={!canApply} onClick={()=>onApply(insight.title,insight.description,insight.recommendation)}>Create content from this insight <ArrowUpRight size={14} aria-hidden="true"/></button>}</div>:<div className={styles.nextStep}><LockKeyhole size={16} aria-hidden="true"/><p>AI recommendations are available from Studio.</p><a href="/dashboard/billing?product=content-workspace#content-workspace-plans">Explore Studio <ArrowUpRight size={14}/></a></div>)}
    </article>;})}</div>:<div className={styles.empty}><Sparkles size={27} strokeWidth={1.3} aria-hidden="true"/><h5>{total?'No findings match this filter.':'Your next move starts with an insight.'}</h5><p>{total?'Choose another filter to explore your analysis.':client?'Your team’s analysis will appear here.':'Once results are available, choose Get recommendations. AI analysis uses your plan’s generation allowance.'}</p></div>}
  </section>;
}
