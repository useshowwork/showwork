"use client";
import { useId, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Eye, Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import type { Report } from "./CalendarReportingPanel";
import styles from "./ReportingDashboard.module.css";
const fmt = (v: number) => Intl.NumberFormat(undefined, { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
export default function ReportingVisuals({ timeline, posts, compact = false }: { timeline: Array<[string, number | null]>; posts: Report["accountPosts"]; compact?: boolean }) {
  const gradientId = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const observed = timeline.filter((day): day is [string, number] => day[1] != null);
  const max = Math.max(1, ...observed.map(day => day[1]));
  const active = selected == null ? null : timeline[selected];
  const chartWidth = 620, chartHeight = 170;
  const x = (i: number) => timeline.length < 2 ? chartWidth / 2 : i / (timeline.length - 1) * chartWidth;
  const y = (v: number) => chartHeight - v / max * (chartHeight - 14);
  const segments: Array<Array<[number, number]>> = [];
  timeline.forEach(([, value], index) => {
    if (value == null) return;
    if (index === 0 || timeline[index - 1][1] == null) segments.push([]);
    segments.at(-1)!.push([x(index), y(value)]);
  });
  const breakdown = [
    { key: "likes" as const, label: "Likes", color: "#1768E8", icon: Heart },
    { key: "comments" as const, label: "Comments", color: "#71A9FF", icon: MessageCircle },
    { key: "shares" as const, label: "Shares", color: "#1B344F", icon: Share2 },
    { key: "saves" as const, label: "Saves", color: "#B6C9E5", icon: Bookmark },
  ].map(item => { const available = posts.map(post => post[item.key]).filter((v): v is number => v != null); return { ...item, value: available.length ? available.reduce((a,b) => a+b, 0) : null }; });
  const total = breakdown.reduce((sum, item) => sum + (item.value ?? 0), 0);
  let offset = 0;
  return <div className={compact ? styles.singleChart : styles.charts}>
    <section className={styles.chartCard} aria-label="Reach over time">
      <div className={styles.cardHeading}><div><p className={styles.kicker}><ChartNoAxesCombined size={13} aria-hidden="true" /> Audience momentum</p><h4>Reach over time</h4></div><span className={styles.legend}><i />Daily reach</span></div>
      {observed.length > 0 && <div className={styles.chartReadout}><strong>{active ? active[1] == null ? "—" : fmt(active[1]) : observed.length ? fmt(Math.max(...observed.map(day => day[1]))) : "—"}</strong><span>{active ? active[0] : "Peak observed daily reach"}</span></div>}
      {observed.length ? <div className={styles.lineChart}>
        <div className={styles.axis}><span>{fmt(max)}</span><span>{fmt(max / 2)}</span><span>0</span></div>
        <svg viewBox={`-8 -5 ${chartWidth + 16} ${chartHeight + 18}`} role="img" aria-label="Daily observed reach. Gaps indicate missing observations." className={styles.chartSvg}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1768E8" stopOpacity=".2" /><stop offset="100%" stopColor="#1768E8" stopOpacity="0" /></linearGradient></defs>
          {[0, .5, 1].map(t => <line key={t} x1="0" x2={chartWidth} y1={t * chartHeight} y2={t * chartHeight} stroke="#E8EEF6" strokeDasharray="4 5" />)}
          {segments.map((points, index) => <g key={index}><path d={`M ${points[0][0]},${chartHeight} L ${points.map(p => p.join(',')).join(' L ')} L ${points.at(-1)![0]},${chartHeight} Z`} fill={`url(#${gradientId})`} /><path d={`M ${points.map(p => p.join(',')).join(' L ')}`} fill="none" stroke="#1768E8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></g>)}
          {timeline.map(([day, value], index) => value == null ? null : <g key={day} tabIndex={0} role="button" aria-label={`${day}: ${fmt(value)} reach`} onMouseEnter={() => setSelected(index)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(index)} onBlur={() => setSelected(null)} onClick={() => setSelected(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index); } }}><title>{`${day}: ${fmt(value)} reach`}</title><circle cx={x(index)} cy={y(value)} r="11" fill="transparent" /><circle cx={x(index)} cy={y(value)} r={selected === index ? 5 : 3} fill={selected === index ? '#1768E8' : '#fff'} stroke="#1768E8" strokeWidth="2" /></g>)}
        </svg>
        <div className={styles.chartDates}><span>{timeline[0]?.[0]}</span><span>{timeline.at(-1)?.[0]}</span></div>
      </div> : <div className={styles.chartEmpty}><Eye size={27} strokeWidth={1.3} aria-hidden="true" /><p>No daily reach observations yet.</p><span>Observed daily reach will appear here when available.</span></div>}
      <div className={styles.chartFoot}><span>{observed.length} observed {observed.length === 1 ? "day" : "days"}</span><span>Missing observations stay as gaps.</span></div>
    </section>
    {!compact && <section className={`${styles.chartCard} ${styles.mixCard}`} aria-label="Post interaction breakdown">
      <div className={styles.cardHeading}><div><p className={styles.kicker}><ArrowUpRight size={13} aria-hidden="true" /> Beyond the scroll</p><h4>How people engage.</h4></div></div>
      <div className={styles.mixContent}><div className={styles.donut}>
        <svg viewBox="0 0 160 160" role="img" aria-label={breakdown.some(item => item.value != null) ? `Recorded interaction breakdown: ${breakdown.map(i => `${i.label} ${i.value == null ? 'unavailable' : i.value}`).join(', ')}` : 'No recorded interactions available'}><circle cx="80" cy="80" r="62" fill="none" stroke="#EDF2F8" strokeWidth="13" />{breakdown.map(item => { const percent = total ? (item.value ?? 0) / total * 100 : 0; const start = offset; offset += percent; return percent > 0 ? <circle key={item.key} cx="80" cy="80" r="62" pathLength="100" fill="none" stroke={item.color} strokeWidth="13" strokeDasharray={`${percent} ${100-percent}`} strokeDashoffset={-start} transform="rotate(-90 80 80)" /> : null; })}</svg>
        <div><strong>{breakdown.some(i => i.value != null) ? fmt(total) : "—"}</strong><span>interactions</span></div>
      </div><div className={styles.mixLegend}>{breakdown.map(({ key, label, value, color, icon: Icon }) => <div key={key}><span><i style={{ background: color }} /><Icon size={12} aria-hidden="true" />{label}</span><strong>{value == null ? "—" : fmt(value)}</strong></div>)}</div></div>
      <div className={styles.chartFoot}><span>Published posts in this period</span><span>Current lifetime counters</span></div>
    </section>}
  </div>;
}
