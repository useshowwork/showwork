import { getWorkspaceSetup } from "@/lib/workspaceSetupServer";
import { canGenerateDuringSetup } from "@/lib/workspaceSetup";
import ReportingProductionSummary from "@/components/calendars/ReportingProductionSummary";
import ChannelsWorkspace from "@/components/calendars/ChannelsWorkspace";
import KnowledgeSetupPanel from "@/components/calendars/KnowledgeSetupPanel";
import WorkspaceOverview from "@/components/calendars/WorkspaceOverview";
import { brandPersonalityDocumentId } from "@/lib/knowledge/brandPersonality";
import BrandPersonalityCard from "@/components/calendars/BrandPersonalityCard";
import BusinessResearchPanel from "@/components/calendars/BusinessResearchPanel";
import type { TeamPermission } from "@/lib/calendarTeamPolicy";
import { complimentaryAccessSelect } from "@/lib/complimentaryAccess";
import UiSymbol from "@/components/ui/UiSymbol";
import CalendarPaymentCallbackHandler from "@/components/calendars/CalendarPaymentCallbackHandler";
import { requirePostPlatform } from "@/lib/calendarPosts";
import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect, notFound } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicUrlFor } from "@/lib/r2";
import {
  getCalendarRole,
  getCalendarAccess,
  canAccessCalendarById,
} from "@/lib/calendarPermissions";
import WorkspaceFeatureNotice from "@/components/calendars/WorkspaceFeatureNotice";
import { canUseContentWorkspaceFeature, isContentWorkspaceTrialActive } from "@/lib/contentWorkspaceUsage";
import { isAdminEmail } from "@/lib/admin";

import CalendarGrid from "@/components/calendars/CalendarGrid";
import InviteCollaboratorForm from "@/components/calendars/InviteCollaboratorForm";
import CalendarSettingsMenu from "@/components/calendars/CalendarSettingsMenu";
import ClientSharingPanel from "@/components/calendars/ClientSharingPanel";
import InstagramConnectionCard from "@/components/calendars/InstagramConnectionCard";
import TikTokConnectionCard from "@/components/calendars/TikTokConnectionCard";
import AdditionalChannelCard from "@/components/calendars/AdditionalChannelCard";
import WhatsAppConnectionCard from "@/components/calendars/WhatsAppConnectionCard";
import BusinessKnowledgeCard from "@/components/calendars/BusinessKnowledgeCard";
import AiContentGeneratorCard from "@/components/calendars/AiContentGeneratorCard";
import CopyLinkButton from "@/components/CopyLinkButton";
import CalendarWorkspaceShell, { type WorkspaceSection } from "@/components/calendars/CalendarWorkspaceShell";
import CalendarReportingPanel from "@/components/calendars/CalendarReportingPanel";
import SocialLeadInbox from "@/components/calendars/SocialLeadInbox";
import CalendarLeadsPanel from "@/components/calendars/CalendarLeadsPanel";


const COLOR = {
  black: "#07090D",
  panel: "#10141B",
  panelSoft: "#151A22",
  blue: "#2478FF",
  blueSoft: "#72A8FF",
  white: "#FFFFFF",
  muted: "#929AA8",
  line: "rgba(255,255,255,0.09)",
};


function IconCalendar({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 3.5V7M16.5 3.5V7M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowUpRight({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M7 17L17 7M9 7H17V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 3V15M7.5 11L12 15.5L16.5 11M4 20H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLink({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M9.5 14.5L14.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.2 17.8L5.7 19.3C4.2 20.8 1.8 20.8 0.3 19.3C-1.2 17.8-1.2 15.4 0.3 13.9L4.9 9.3C6.4 7.8 8.8 7.8 10.3 9.3" transform="translate(2 0)" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.8 6.2L18.3 4.7C19.8 3.2 22.2 3.2 23.7 4.7C25.2 6.2 25.2 8.6 23.7 10.1L19.1 14.7C17.6 16.2 15.2 16.2 13.7 14.7" transform="translate(-2 0)" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 19C3.9 15.7 5.7 14 9 14C12.3 14 14.1 15.7 14.5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 5.5C17.4 5.6 18.8 7 18.8 9C18.8 10.5 18 11.6 16.8 12.2M16.5 14.3C19.2 14.8 20.3 16.4 20.5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconShield({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 3L19 6V11.2C19 15.7 16.1 19.3 12 21C7.9 19.3 5 15.7 5 11.2V6L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M12 2.8L13.7 9.3L20.2 11L13.7 12.7L12 19.2L10.3 12.7L3.8 11L10.3 9.3L12 2.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function CalendarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  const { id } = await params;

  const calendar = await db.socialCalendar.findUnique({
    where: { id },
    include: {
      manager: {
        select: {
          id: true,
          contentWorkspacePlan: true,
          contentWorkspaceBillingStatus: true,
          contentWorkspaceBillingCycle: true,
          contentWorkspaceTrialEndsAt: true,
          ...complimentaryAccessSelect, isComped: true,
compedUntil: true,
          
        },
      },
      _count: {
        select: {
          collaborators: true,
        },
      },
      businessDocuments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          originalName: true,
          createdAt: true,
          websiteUrl: true,
        },
      },
      posts: {
        where: { deletedAt: null },
        orderBy: { postDate: "asc" },
        include: {
          assets: {
            orderBy: { displayOrder: "asc" },
          },
          videoComments: {
            orderBy: { videoTimestampSeconds: "asc" },
          },
          customFields: true,
        },
      },
    },
  });

  if (!calendar) {
    notFound();
  }

  const isAdmin = isAdminEmail(creator.email);
  const access = await getCalendarAccess(creator.id, id);
  if (!access && !isAdmin) notFound();
  const permissions: TeamPermission[] = access?.permissions ?? ["calendar.view", "analytics.view"];
  const can = (permission: TeamPermission) => permissions.includes(permission);
  const isOwner = calendar.managerId === creator.id;
  const setup = await getWorkspaceSetup(calendar.id);
  const isManager = isOwner || access?.role === "MANAGER";
  const canEditWorkspace = can("calendar.edit");
  const userRole = canEditWorkspace ? "EDIT_CALENDAR" : can("creatives.upload") ? "ADD_CONTENT" : "VIEW_ONLY";
  const totalMembers = 1 + calendar._count.collaborators;

  const workspaceActive = await canAccessCalendarById(calendar.id);
  const agencyTrial = isContentWorkspaceTrialActive(calendar.manager);
  const featureAccess = (feature: Parameters<typeof canUseContentWorkspaceFeature>[1]) => workspaceActive && canUseContentWorkspaceFeature(calendar.manager, feature);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const clientUrl = `${appUrl}/social-calendar/${calendar.slug}`;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const thisMonthPosts = calendar.posts.filter((post) => {
    const date = new Date(post.postDate);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

const aiActive = workspaceActive;

  const calendarPosts = calendar.posts.map((p) => ({
    id: p.id,
    isAiDraft: p.isAiDraft,
    postDate: p.postDate.toISOString(),
    platform: requirePostPlatform(p.platform),
    postType: p.postType,
   category: p.category,
hook: p.hook,
script: p.script,
caption: p.caption,
contentIdea: p.contentIdea,
    cta: p.cta,
    hashtags: p.hashtags,
    taggedAccounts: p.taggedAccounts,
    linkUrl: p.linkUrl,
    approvalStatus: p.approvalStatus,
    internalReviewStatus: p.internalReviewStatus,
    internalReviewNote: p.internalReviewNote,
    internalReviewVersion: p.internalReviewVersion,
    internalReviewedAt: p.internalReviewedAt?.toISOString() ?? null,
    approvalNote: p.approvalNote,
    publishStatus: p.publishStatus,
    publishError: p.publishError,
    publishPermalink: p.publishPermalink,
    instagramPublishStatus: p.instagramPublishStatus,
    instagramPermalink: p.instagramPermalink,
    instagramPublishError: p.instagramPublishError,
    tikTokPublishStatus: p.tikTokPublishStatus,
    tikTokPrivacyLevel: p.tikTokPrivacyLevel,
    tikTokSettings: p.tikTokSettings,
    tikTokConsentAt: p.tikTokConsentAt?.toISOString() ?? null,
    tikTokInitStartedAt: p.tikTokInitStartedAt?.toISOString() ?? null,
    tikTokPublishId: p.tikTokPublishId,
    tikTokPublishError: p.tikTokPublishError,
    assets: p.assets.map((a) => ({
      id: a.id,
      fileKey: a.fileKey,
      mediaType: a.mediaType,
      contentUrl: publicUrlFor(a.fileKey),
        posterUrl: a.posterFileKey ? publicUrlFor(a.posterFileKey) : null,
    })),
    videoComments: p.videoComments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      note: c.note,
      videoTimestampSeconds: c.videoTimestampSeconds,
    })),
    customFields: p.customFields.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
    })),
  }));

  const sections: WorkspaceSection[] = [
    {
      id: "overview",
      label: "Overview",
      eyebrow: "Command center",
      title: `Good to see you. Here’s ${calendar.clientName}.`,
      description:
        "The fastest view of what needs attention, what is ready, and what is moving next.",
      group: "Workspace",
      content: <WorkspaceOverview availableSections={["content", ...(can("people.view") ? ["team"] : []), "inbox", "analytics", ...(can("knowledge.view") ? ["knowledge", "research"] : []), ...(can("ai.generate") ? ["generate"] : []), ...(can("channels.view") ? ["channels"] : [])]} clientName={calendar.clientName} totalMembers={totalMembers} aiActive={aiActive} clientUrl={clientUrl} posts={calendar.posts.map(post => ({ id: post.id, postDate: post.postDate.toISOString(), platform: requirePostPlatform(post.platform), internalReviewStatus: post.internalReviewStatus, approvalStatus: post.approvalStatus, isAiDraft: post.isAiDraft, publishStatus: post.publishStatus, instagramPublishStatus: post.instagramPublishStatus, tikTokPublishStatus: post.tikTokPublishStatus, contentIdea: post.contentIdea, hook: post.hook, caption: post.caption }))} />,
    },
    {
      id: "content",
      label: "Content Calendar",
      eyebrow: "Production",
      title: "Build the work.",
      description:
        "Plan, attach creative, review feedback and move each piece toward approval.",
      group: "Workspace",
      content: (
        <div className="min-w-0">
          <CalendarGrid
            calendarId={calendar.id}
            isOwner={isOwner}
            planStatus={calendar.planStatus}
            userRole={userRole}
            clientName={calendar.clientName}
            permissions={permissions}
            initialPosts={calendarPosts}
          />
        </div>
      ),
    },
    ...(can("people.view") ? [{
      id: "team" as const, label: "People", eyebrow: "Team & permissions", title: "The right people. The right access.",
      description: "Invite teammates, set clear roles, and choose the features they can use.", group: "Collaboration" as const,
      content: <InviteCollaboratorForm calendarId={calendar.id} />,
    }] : []),
    {
      id: "analytics",
      label: "Analytics & Reporting",
      eyebrow: "Insights",
      title: "Know what is moving.",
      description:
        "Explore social performance, post metrics, new leads and hot opportunities. Use AI recommendations to guide your next content batch.",
      group: "Insights",
      content: (
        <div className="space-y-6">
          <CalendarReportingPanel
            calendarId={calendar.id}
            isManager={can("analytics.manage")}
            canViewLeads={can("leads.view")}
            canAnalyze={can("analytics.manage") && featureAccess("performanceRecommendations")}
            advancedAccess={featureAccess("advancedAnalytics")}
            recommendationsAccess={featureAccess("performanceRecommendations")}
            canApplyRecommendations={can("analytics.manage") && canEditWorkspace && aiActive && featureAccess("performanceRecommendations")}
          />
          <ReportingProductionSummary posts={calendar.posts.map(post => ({
            id: post.id, postDate: post.postDate.toISOString(), platform: requirePostPlatform(post.platform),
            internalReviewStatus: post.internalReviewStatus, approvalStatus: post.approvalStatus,
            isAiDraft: post.isAiDraft, publishStatus: post.publishStatus,
            instagramPublishStatus: post.instagramPublishStatus, tikTokPublishStatus: post.tikTokPublishStatus,
            hasContent: post.assets.length > 0,
          }))} />
        </div>
      ),
    },
    {
      id: "leads",
      label: "Leads",
      eyebrow: "Lead management",
      title: "Keep every opportunity moving.",
      description: "Manage social contacts and manually added leads, qualify interest, and keep contact details and follow-up status current.",
      group: "Leads & Messages",
      content: (
        <div>
          <CalendarLeadsPanel calendarId={calendar.id} canEdit={can("leads.manage")} featureLocked={!featureAccess("leadManagement")} />
        </div>
      ),
    },
    {
      id: "inbox",
      label: "Inbox",
      eyebrow: "Social inbox",
      title: "Manage conversations in one inbox.",
      description: "Read connected social and WhatsApp conversations, reply where supported and prepare AI replies using business knowledge.",
      group: "Leads & Messages",
      content: (
        <div>
        <SocialLeadInbox
          key={calendar.id}
          calendarId={calendar.id}
          isManager={can("workspace.manage")}
          isOwner={isOwner}
          canManageLeads={can("leads.manage")}
          canViewChannels={can("channels.view")}
          canReplyFromWorkspace={can("inbox.reply") && featureAccess("socialInbox")}
          inboxAccess={featureAccess("socialInbox")}
          autoRepliesAccess={featureAccess("aiAutoReplies")}
          businessKnowledge={can("knowledge.manage") ? {
            aiActive,
            businessSummary: calendar.aiBusinessSummary,
            summaryUpdatedAt: calendar.aiBusinessSummaryUpdatedAt?.toISOString() ?? null,
            documents: calendar.businessDocuments.map(doc => ({ id: doc.id, originalName: doc.originalName, createdAt: doc.createdAt.toISOString(), websiteUrl: doc.websiteUrl })),
          } : undefined}
        />
        </div>
      ),
    },
    {
      id: "access",
      label: "Share with client",
      eyebrow: "Client access",
      title: "Share with your client",
      description: "Send their review link and password. Keep feedback and approvals in one place.",
      group: "Workspace",
      content: <ClientSharingPanel calendarId={calendar.id} clientUrl={clientUrl} clientName={calendar.clientName} accessCode={calendar.accessCode ?? ""} canManage={can("workspace.manage")} />,
    },
    ...((can("channels.view") || can("knowledge.view") || can("ai.generate"))
  ? [
          {
            id: "channels" as const,
            label: "Channels",
            eyebrow: "Publishing",
            title: "Connect the channels behind the work.",
            description:
              "Connect this client’s social and messaging accounts and manage their access here.",
            group: "Publishing" as const,
            content: (
              <ChannelsWorkspace>
                <InstagramConnectionCard
  calendarId={calendar.id}
  username={calendar.instagramUsername}
  connectedAt={calendar.instagramConnectedAt?.toISOString() ?? null}
  isManager={can("channels.manage")}
/>

<TikTokConnectionCard
  calendarId={calendar.id}
  username={calendar.tikTokUsername}
  connectedAt={calendar.tikTokConnectedAt?.toISOString() ?? null}
  isManager={can("channels.manage")}
/>
                <AdditionalChannelCard
                  channel="facebook"
                  calendarId={calendar.id}
                  accountName={calendar.facebookPageName}
                  connectedAt={calendar.facebookConnectedAt?.toISOString() ?? null}
                  isManager={can("channels.manage")}
                />
                <AdditionalChannelCard
                  channel="linkedin"
                  calendarId={calendar.id}
                  accountName={calendar.linkedinName}
                  connectedAt={calendar.linkedinConnectedAt?.toISOString() ?? null}
                  isManager={can("channels.manage")}
                />
                <WhatsAppConnectionCard calendarId={calendar.id} isManager={can("channels.manage")} />
                <AdditionalChannelCard
                  channel="x"
                  calendarId={calendar.id}
                  accountName={calendar.xUsername}
                  connectedAt={calendar.xConnectedAt?.toISOString() ?? null}
                  isManager={can("channels.manage")}
                />
              </ChannelsWorkspace>
            ),
          },
          {
            id: "knowledge" as const,
            label: "Business knowledge",
            eyebrow: "AI Studio · context",
            title: "Give AI the context this client deserves.",
            description:
              "Keep the client's brand, products, voice and source material close to every generation.",
            group: "AI Studio" as const,
            content: (
              <KnowledgeSetupPanel calendarId={calendar.id} hasKnowledge={setup?.hasKnowledge ?? false} hasBrandVoice={setup?.hasBrandVoice ?? false} sourceCount={calendar.businessDocuments.filter(doc => doc.id !== brandPersonalityDocumentId(calendar.id)).length} nextSection={setup?.hasChannels ? (can("ai.generate") ? "generate" : undefined) : (can("channels.view") ? "channels" : undefined)} knowledge={<BusinessKnowledgeCard
                hasBrandVoice={setup?.hasBrandVoice ?? false}
                nextSection={setup?.hasChannels ? (can("ai.generate") ? "generate" : undefined) : (can("channels.view") ? "channels" : undefined)}
                canEdit={can("knowledge.manage")}
                calendarId={calendar.id}
                aiActive={aiActive}
                businessSummary={calendar.aiBusinessSummary}
                summaryUpdatedAt={calendar.aiBusinessSummaryUpdatedAt?.toISOString() ?? null}
                lastResearchedAt={calendar.aiLastResearchedAt?.toISOString() ?? null}
                documents={calendar.businessDocuments.map((doc) => ({
                  id: doc.id,
                  originalName: doc.originalName,
                  createdAt: doc.createdAt.toISOString(),
                  websiteUrl: doc.websiteUrl,
                }))}
              />} voice={<BrandPersonalityCard reviewOnSave key={calendar.id} calendarId={calendar.id} canEdit={can("knowledge.manage")} hasKnowledge={setup?.hasKnowledge ?? false} />} />
            ),
          },
          {
            id: "research" as const,
            label: "Randy",
            eyebrow: "AI Studio · Randy",
            title: "Your business thinking partner.",
            description: "Chat about your business, research ideas and build your knowledge.",
            group: "AI Studio" as const,
            content: featureAccess("randyStudio") ? <BusinessResearchPanel calendarId={calendar.id} canManage={can("knowledge.manage")} canGenerate={can("ai.generate")} /> : <WorkspaceFeatureNotice feature="randyStudio" />,
          },
          {
            id: "generate" as const,
            label: "Generate calendar",
            eyebrow: "AI Studio · create",
            title: "Turn context into the next content batch.",
            description:
              "Set the creative direction, choose the channels and generate drafts that stay grounded in this client's world.",
            group: "AI Studio" as const,
            content: (
              <div className="min-w-0">
                  <AiContentGeneratorCard
                    calendarId={calendar.id}
                    hasBusinessSummary={calendar.businessDocuments.some(doc => doc.id !== brandPersonalityDocumentId(calendar.id))}
                    performanceRecommendationsAccess={featureAccess("performanceRecommendations")}
                  />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
    <CalendarPaymentCallbackHandler />
    <CalendarWorkspaceShell
      clientName={calendar.clientName}
      calendarId={calendar.id}
      setup={isOwner && setup?.enabled ? setup : undefined}
      clientUrl={can("delivery.manage") ? clientUrl : ""}
      isManager={isManager}
      settings={can("workspace.manage") ?
        <CalendarSettingsMenu
          onBrand
          calendarId={calendar.id}
          clientName={calendar.clientName}
          userRole={can("workspace.manage") ? "EDIT_CALENDAR" : "VIEW_ONLY"}
          isManager={isOwner}
        /> : undefined
      }
      sections={sections.filter(section => {
        const required: Record<string, TeamPermission> = { overview: "workspace.manage", content: "calendar.view", team: "people.view", analytics: "analytics.view", inbox: "inbox.view", leads: "leads.view", access: "delivery.manage", channels: "channels.view", knowledge: "knowledge.view", research: "knowledge.view", generate: "ai.generate" };
        if (section.id === "overview") return can("workspace.manage") && can("calendar.view") && can("analytics.view") && can("inbox.view") && can("leads.view");
        return can(required[section.id]);
      }).map(section => ({ ...section, content: (
        <>
          {agencyTrial && <WorkspaceFeatureNotice trial paidPlan={calendar.manager.contentWorkspaceBillingStatus === "ACTIVE" ? calendar.manager.contentWorkspacePlan : null} trialEndsAt={calendar.manager.contentWorkspaceTrialEndsAt} />}
          {!workspaceActive && <WorkspaceFeatureNotice />}
          {section.id === "generate" && setup && !canGenerateDuringSetup(setup)
            ? <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900">{isOwner ? "Complete your publishing choice, add business knowledge, set your brand voice, and connect a channel using the setup guide above. Then you’re ready to generate content." : "The workspace owner needs to finish setup before the team can generate content. Ask them to choose publishing preferences, add business knowledge, set the brand voice, and connect a channel."}</div>
            : !workspaceActive && !["overview", "analytics", "inbox", "leads", "team"].includes(section.id)
            ? <fieldset disabled className="min-w-0">{section.content}</fieldset>
            : section.content}
        </>
      ) }))}
    />
    </>
  );
}
