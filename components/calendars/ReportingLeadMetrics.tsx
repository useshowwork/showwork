import { Target, Flame, UserCheck } from "lucide-react";
import styles from "./ReportingLeadMetrics.module.css";

type LeadTotals = {total:number;acquired?:{value:number|null};hotCount:number|null;customers:number|null;historyStartedAt?:string|null;milestoneCountsAvailable?:boolean;milestoneBasis?:"period"|"tracked-period"|"current"|"unavailable"};
export default function ReportingLeadMetrics({leads,onOpen}:{leads:LeadTotals;onOpen?:()=>void}) {
  const basis=leads.milestoneBasis || (leads.milestoneCountsAvailable === false ? "unavailable" : "period");
  const current=basis === "current";
  const tracked=basis === "tracked-period";
  const trackingDate=leads.historyStartedAt ? new Date(leads.historyStartedAt).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}) : null;
  return <section className={styles.section} aria-label="Lead and customer analytics">
    <header><div><h3>Leads &amp; customers</h3><p>See how your audience turns into business opportunities.</p></div>{onOpen && <button type="button" onClick={onOpen}>View leads <span aria-hidden="true">→</span></button>}</header>
    <div className={styles.grid}>{[
      {label:"New leads",value:leads.acquired?.value ?? null,description:"Created during the selected period",icon:Target,tone:"blue"},
      {label:current ? "Current hot leads" : "Hot leads",value:leads.hotCount,description:current ? "Currently hot and still open" : tracked ? "Recorded hot-lead changes within this period" : "Marked hot during the selected period",icon:Flame,tone:"orange"},
      {label:current ? "Current customers" : "Converted customers",value:leads.customers,description:current ? "Leads currently marked as customers" : tracked ? "Recorded conversions within this period" : "Marked as customers during the selected period",icon:UserCheck,tone:"green"},
    ].map(({label,value,description,icon:Icon,tone})=><article key={label} className={styles.card} data-tone={tone}>
      <div><span className={styles.icon}><Icon size={18} aria-hidden="true"/></span><h4>{label}</h4></div>
      <strong>{value == null ? "—" : value.toLocaleString()}</strong><p>{description}</p>
    </article>)}</div>
    {basis === "current" && <p className={styles.historyNote}>Hot leads and customers show your current pipeline totals, filtered by channel. Conversion-date tracking is not active yet, so these two totals are not filtered by date.</p>}
    {tracked && <p className={styles.historyNote}>Showing recorded hot-lead changes and conversions from {trackingDate} within your selected period. Earlier stage-change dates are unavailable.</p>}
    {basis === "unavailable" && <p className={styles.historyNote}>{trackingDate ? `Stage-change tracking started ${trackingDate}. This period is before tracking began.` : "Stage-change dates are unavailable for this period."} Earlier stage-change dates are unavailable; new-lead counts still use creation dates.</p>}

  </section>;
}
