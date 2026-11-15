import { ChannelProductProvider } from "./ChannelProductContext";
import type { ReactNode } from "react";
import { Cable, CalendarClock, ChartNoAxesCombined, MessagesSquare } from "lucide-react";
import PlatformBrandIcon from "./PlatformBrandIcon";
import styles from "./ChannelsStudio.module.css";
export default function ChannelsWorkspace({children, engage = false, connectedAccounts = 0}:{children:ReactNode; engage?:boolean; connectedAccounts?:number}) {
  return <ChannelProductProvider engage={engage}><div className={styles.workspace}>
    <header className={styles.hero}><div><p className={styles.eyebrow}><Cable size={15}/> Your connected workspace</p><h1>Your channels.<br/><span>Working together.</span></h1><p>Connect the accounts behind your content and conversations. See what each channel brings to your workspace.</p></div><div className={styles.logoOrbit} aria-hidden="true">{(engage ? ["FACEBOOK","INSTAGRAM","WHATSAPP"] : ["INSTAGRAM","TIKTOK","FACEBOOK","LINKEDIN","X","WHATSAPP"]).map(platform=><span key={platform}><PlatformBrandIcon platform={platform} size={25}/></span>)}</div></header>
    <div className={styles.capabilityLegend}>{!engage && <><span><CalendarClock size={15}/> Publishing</span><span><ChartNoAxesCombined size={15}/> Analytics</span></>}<span><MessagesSquare size={15}/> Messaging</span><p>Each feature needs its own supported account and permissions.</p></div>
    {engage && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{connectedAccounts} {connectedAccounts === 1 ? "account connected" : "accounts connected"}. {connectedAccounts === 0 ? "Connect your accounts below." : "Connect more accounts across your supported channels."}</p>}
    <div className={styles.channelGrid}>{children}</div>
    <p className={styles.note}>A connected account does not automatically enable every feature. Use reauthorization or the additional setup shown on each card when permissions are missing.</p>
  </div></ChannelProductProvider>;
}
