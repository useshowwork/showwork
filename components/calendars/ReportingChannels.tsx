"use client";
import PlatformBrandIcon from "./PlatformBrandIcon";
import IconText from "@/components/ui/IconText";
import { ArrowUpRight, ChevronDown, ChevronUp, FileText, ChevronRight } from "lucide-react";
import type { Report } from "./CalendarReportingPanel";
import styles from "./ReportingDashboard.module.css";
const platformLabel: Record<string, string> = { INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', TIKTOK: 'TikTok', LINKEDIN: 'LinkedIn', X: 'X', YOUTUBE: 'YouTube' };
const number = (v: number | null) => v == null ? '—' : Intl.NumberFormat().format(v);
export function PlatformMark({ platform }: { platform: string }) {
  return <span className={styles.platformMark}><PlatformBrandIcon platform={platform} size={20}/></span>;
}
export default function ReportingChannels({ report, expanded, onToggle }: { report: Report; expanded: boolean; onToggle: () => void }) {
  const shown = expanded ? report.accountPosts : report.accountPosts.slice(0,5);
  const maximum = Math.max(1, ...report.accountPosts.map(p=>p.engagement ?? 0));
  return <section id="channel-detail" className={styles.channelSection}>
    <div className={styles.postsCard}><div className={styles.cardHeading}><div><p className={styles.kicker}><FileText size={13} aria-hidden="true" /> Post performance</p><h4>Published posts <span className={styles.count}>{report.accountPosts.length}</span></h4><p className={styles.smallNote}>Current lifetime metrics for posts published in the selected period.</p></div></div>
      {shown.length ? <div className={styles.tableScroll}><table className={styles.postTable} id="analytics-platform-posts"><caption className="sr-only">Published platform posts and their current lifetime performance</caption><thead><tr><th scope="col">Content</th><th scope="col">Reach</th><th scope="col">Views</th><th scope="col">Engagement</th><th scope="col"><span className="sr-only">Open post</span></th></tr></thead><tbody>{shown.map(post=><tr key={post.id}><td><div className={styles.postIdentity}><PlatformMark platform={post.platform} /><div><div className={styles.postMeta}><span>{platformLabel[post.platform] || post.platform}</span><time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</time>{post.username && <span>@{post.username}</span>}</div><p><IconText text={post.caption || post.postType || 'Published post'} /></p><details className={styles.postDetails}><summary><ChevronRight size={12} aria-hidden="true" />Post details</summary><p><IconText text={post.caption || 'No caption available.'} /></p><div>{[['Likes',post.likes],['Comments',post.comments],['Shares',post.shares],['Saves',post.saves],['Impressions',post.impressions]].map(([name,value])=><span key={String(name)}>{name} <strong>{number(value as number|null)}</strong></span>)}</div></details></div></div></td><td data-label="Reach">{number(post.reach)}</td><td data-label="Views">{number(post.views)}</td><td data-label="Engagement"><span className={styles.engagementValue}>{number(post.engagement)}</span><span className={styles.microBar}><i style={{width:`${post.engagement == null ? 0 : post.engagement/maximum*100}%`}} /></span></td><td>{post.permalink && <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={styles.postLink} aria-label={`View ${platformLabel[post.platform] || post.platform} post in a new tab`}><ArrowUpRight size={17} /></a>}</td></tr>)}</tbody></table></div> : <div className={styles.empty}><FileText size={24} aria-hidden="true" /><p>No posts in this period yet. Try another date range. Available metrics update automatically.</p></div>}
      {report.accountPosts.length>5 && <div className={styles.postsFooter}><p>Showing {shown.length} of {report.accountPosts.length} posts</p><button type="button" className={styles.outlineButton} aria-expanded={expanded} aria-controls="analytics-platform-posts" onClick={onToggle}>{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>} {expanded?'View less':'View more'}</button></div>}
    </div>
  </section>;
}
