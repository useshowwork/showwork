"use client";
import { ArrowUpRight, ArrowRight, Sparkles, TrendingUp, Target, ScanSearch, ChevronDown } from "lucide-react";
import { strategySummary } from "@/lib/reporting/monthlyStrategy";
import WorkspaceFeatureNotice from "./WorkspaceFeatureNotice";
import type { Report } from "./CalendarReportingPanel";
import styles from "./ReportingDashboard.module.css";

export default function ReportingInsights({ insights, total, analyzing, loading, canAnalyze, canApply, access, client, onAnalyze, onApply, objective, onObjective, goalChanged = false }: {
  insights: Report['insights']; total: number; analyzing: boolean; loading: boolean; canAnalyze: boolean; canApply: boolean; access: boolean; client: boolean;
  onAnalyze: () => void; onApply: (title: string, description: string, recommendation: string | null) => void;
  objective: string; onObjective: (value: string) => void; goalChanged?: boolean;
}) {
  const insight = insights.find(item => item.strategy);
  const strategy = insight?.strategy;
  const summary = strategy ? strategySummary(strategy) : null;
  const sources = insight?.researchSources?.filter(source => /^https?:\/\//i.test(source.url)) ?? [];
  const signalText = (text: string) => {
    if (text.length <= 300) return <p>{text}</p>;
    const firstSentence = text.match(/^[\s\S]*?[.!?](?:\s|$)/)?.[0]?.trim();
    const lead = firstSentence && firstSentence.length <= 300 ? firstSentence : "Explore the full observation and its context.";
    return <details className={styles.strategySignalDetail}>
      <summary><p>{lead}</p><span>Read full insight <ChevronDown size={13} aria-hidden="true"/></span></summary>
      <div><p>{text}</p></div>
    </details>;
  };
  return <section id="ai-insights" className={`${styles.insightSection} ${styles.strategySection}`} aria-busy={analyzing}>
    <div className={styles.insightHeader}><div><p className={styles.kicker}><Sparkles size={14} aria-hidden="true"/> Content intelligence</p><h4>Your next content move</h4><p>Understand the signals. Give your next calendar a clear purpose.</p></div></div>
    {!client && !access && <WorkspaceFeatureNotice compact feature="performanceRecommendations"/>}
    {!client && access && <div className={styles.strategyGoal}>
      <label htmlFor={`strategy-goal-${insight?.id || 'new'}`}>What’s your goal? <span>Optional</span></label>
      <div><input id={`strategy-goal-${insight?.id || 'new'}`} value={objective} maxLength={4000} disabled={analyzing} onChange={event => onObjective(event.target.value)} placeholder="For example: attract more qualified enquiries"/>
      <button type="button" className={styles.primaryButton} disabled={analyzing || loading || !canAnalyze} onClick={onAnalyze}><Sparkles size={15} aria-hidden="true"/>{analyzing ? 'Reviewing…' : strategy ? 'Refresh strategy' : 'Get recommendations'}</button></div>
    </div>}
    {analyzing && <p role="status" className={styles.infoNotice}>Reviewing your results and business context…</p>}
    {strategy && insight && summary ? <article className={styles.strategyCard} aria-label="Content strategy">
      <div className={styles.strategySignals}>
        <section className={styles.strategySignal}><div className={styles.strategySignalHeading}><span className={styles.strategySignalIcon} data-tone="positive"><TrendingUp size={16} aria-hidden="true"/></span><h5>What’s working</h5></div><div className={styles.strategySignalBody}>{signalText(summary.working)}</div></section>
        <section className={styles.strategySignal}><div className={styles.strategySignalHeading}><span className={styles.strategySignalIcon} data-tone="attention"><Target size={16} aria-hidden="true"/></span><h5>What needs attention</h5></div><div className={styles.strategySignalBody}>{signalText(strategy.diagnosis)}</div></section>
      </div>
      {access ? <section className={styles.strategyDirection}>
        <div className={styles.strategyDirectionLabel}><span><Sparkles size={14} aria-hidden="true"/> The recommended move</span><span className={styles.strategyDirectionLine}/></div>
        <h5>{strategy.title}</h5>
        <p className={styles.strategyRecommendation}>{strategy.direction}</p>
        <div className={styles.strategyReason}><span>Why this matters</span><p>{strategy.rationale}</p></div>
        {!client && <div className={styles.strategyFooter}>
          <div><strong>Build your next calendar around this direction</strong><p>You choose the platforms, dates and frequency.</p></div>
          <button type="button" className={styles.strategyApply} disabled={!canApply} onClick={() => onApply(insight.title, insight.description, insight.recommendation)}>Generate next calendar <ArrowRight size={17} aria-hidden="true"/></button>
          {goalChanged && <p className={styles.strategyChanged} role="status">Your goal changed. Refresh the strategy above before using it.</p>}
        </div>}
      </section> : <WorkspaceFeatureNotice compact feature="performanceRecommendations"/>}
      <details className={styles.strategyEvidence}>
        <summary><span className={styles.strategyEvidenceIcon}><ScanSearch size={20} aria-hidden="true"/></span><span><strong>See what shaped this strategy</strong><span>{strategy.evidence.length} supporting {strategy.evidence.length === 1 ? 'observation' : 'observations'}{sources.length ? ' · Research sources included' : ''}</span></span><ChevronDown size={18} aria-hidden="true"/></summary>
        <div className={styles.strategyEvidenceBody}><ol>{strategy.evidence.map((item, i) => <li key={`${item.sourceId}-${i}`}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><p>{item.observation}</p></li>)}</ol>
          <div className={styles.strategyLimitation}><strong>What the data can’t tell us</strong><p>{summary.limitation}</p></div>
          {sources.length > 0 && <div className={styles.strategySources}><strong>Research sources</strong><ul>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={13} aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span></a></li>)}</ul></div>}
        </div>
      </details>
    </article> : !analyzing && <div className={styles.strategyEmpty}><span><ScanSearch size={28} aria-hidden="true"/></span><h5>{client ? 'A clearer direction is on its way' : 'Give your results a direction'}</h5><p>{client ? 'Your team’s strategy will appear here.' : total ? 'Refresh your analysis to turn your results into one focused recommendation.' : 'Discover what’s connecting, what needs attention and the direction worth exploring in your next calendar.'}</p></div>}
  </section>;
}
