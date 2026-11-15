"use client";
import { useContext } from "react";
import { ChannelProductContext } from "./ChannelProductContext";
import { CalendarClock, ChartNoAxesCombined, MessagesSquare, ContactRound } from "lucide-react";
import styles from "./ChannelsStudio.module.css";
const capabilities: Record<string, { label: string; detail: string; icon: typeof CalendarClock }[]> = {
  instagram: [
    {label:"Publishing",detail:"Schedule approved content for your professional account when auto-publish is enabled.",icon:CalendarClock},
    {label:"Analytics",detail:"Account and post insights require the Instagram Insights permission.",icon:ChartNoAxesCombined},
    {label:"Inbox",detail:"Receive and reply to DMs with messaging access and webhooks configured.",icon:MessagesSquare},
  ],
  tiktok: [
    {label:"Publishing",detail:"Schedule approved posts after choosing visibility and authorizing each post.",icon:CalendarClock},
    {label:"Analytics",detail:"Profile statistics and video performance require statistics and video permissions.",icon:ChartNoAxesCombined},
    {label:"Business messaging",detail:"DMs use a separate approved Business Messaging connection.",icon:MessagesSquare},
  ],
  facebook: [
    {label:"Publishing",detail:"Publish approved content to the Facebook Page you connect.",icon:CalendarClock},
    {label:"Analytics",detail:"Page and post reporting depends on granted insights permissions.",icon:ChartNoAxesCombined},
    {label:"Inbox",detail:"Manage Page messages with messaging permissions and webhooks enabled.",icon:MessagesSquare},
  ],
  linkedin: [
    {label:"Publishing",detail:"Publish to an authorized member profile or selected company Page.",icon:CalendarClock},
    {label:"Analytics",detail:"Member and Page metrics depend on account type and approved analytics access.",icon:ChartNoAxesCombined},
    {label:"Page messaging",detail:"Needs approved Page Messaging access and a confirmed messaging subscription.",icon:MessagesSquare},
  ],
  x: [
    {label:"Publishing",detail:"Schedule approved posts with the required write permissions.",icon:CalendarClock},
    {label:"Analytics",detail:"Post metrics depend on your authorized account and X API access.",icon:ChartNoAxesCombined},
    {label:"Direct messages",detail:"DM access requires read/write permissions; group chats are excluded.",icon:MessagesSquare},
  ],
  whatsapp: [
    {label:"Inbox",detail:"Receive business enquiries and reply through the connected Cloud API number.",icon:MessagesSquare},
    {label:"Leads",detail:"Incoming enquiries can create leads in this workspace.",icon:ContactRound},
    {label:"AI replies",detail:"Enable replies in Inbox settings. Customer messages open a 24-hour reply window.",icon:MessagesSquare},
  ],
};
export default function ChannelCapabilities({ platform }: { platform: string }) {
  const engage = useContext(ChannelProductContext);
  return <section className={styles.capabilities} aria-label={`${platform} connection capabilities`}><p>What this connection supports</p><ul>{(capabilities[platform] ?? []).filter(item => !engage || !["Publishing", "Analytics"].includes(item.label)).map(({label,detail,icon:Icon}) => <li key={label}><span><Icon size={15}/></span><div><strong>{label}</strong><p>{detail}</p></div></li>)}</ul></section>;
}
