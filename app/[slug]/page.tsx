import { socialPreviewImage } from "@/lib/seo";
import { complimentaryAccessSelect, hasDeliveryPaidAccess } from "@/lib/complimentaryAccess";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { publicUrlFor } from "@/lib/r2";
import { getCurrentCreator, verifyViewerToken } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import DeliveryPage from "./DeliveryPage";

// A lightweight, separate query from the main page component below —
// only the couple of fields actually needed for the shared-link
// preview, not the full project with all its media/section includes.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: {
      clientName: true,
      heroMediaId: true,
      creator: { select: { companyName: true, name: true } },

    },
  });

  if (!project) {
    return { title: "Project not found | Showwork", robots: { index: false, follow: false } };
  }

  const creatorName = project.creator.companyName || project.creator.name || "Showwork";
  const title = `${project.clientName} — Delivered by ${creatorName}`;
  const description = `View, review and download ${project.clientName}'s creative project delivery from ${creatorName}. Shared securely with Showwork.`;

  const image = socialPreviewImage.url;

  return {
    title,
    description,
    robots: { index: false, follow: false, noarchive: true },
    openGraph: { title, description, url: `/${slug}`, siteName: "Showwork", images: [{ url: image, width: socialPreviewImage.width, height: socialPreviewImage.height, alt: socialPreviewImage.alt }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Gate first: locked requests never load files, review history or task briefs.
  const gate = await db.project.findUnique({ where: { slug }, select: {
    id:true, clientName:true, badgeVisible:true, primaryColor:true, bgColor:true,
    logoUrl:true, heroTagline:true, deliveryStatus:true, deletedAt:true,
    creator:{ select:{ subscriptionActive:true, ...complimentaryAccessSelect, isComped:true } },
  } });
  if (!gate || gate.deletedAt) notFound();
  const [currentCreator, cookieStore] = await Promise.all([getCurrentCreator(), cookies()]);
  const isAdminPreview = !!currentCreator && isAdminEmail(currentCreator.email);
  const token = cookieStore.get(`viewer_${gate.id}`)?.value;
  const viewerSession = token ? verifyViewerToken(token, gate.id) : null;
  if (!isAdminPreview && !viewerSession) {
    await db.project.update({where:{id:gate.id},data:{viewCount:{increment:1}}});
    return <DeliveryPage projectId={gate.id} clientName={gate.clientName}
      badgeVisible={gate.badgeVisible && !hasDeliveryPaidAccess(gate.creator)} primaryColor={gate.primaryColor ?? "#C9A84C"}
      bgColor={gate.bgColor ?? "#080808"} logoUrl={gate.logoUrl} heroTagline={gate.heroTagline}
      media={[]} sections={[]} ungroupedMedia={[]} heroMedia={null} managedProject={null}
      deliveryStatus={gate.deliveryStatus} initiallyUnlocked={false} initialViewerEmail={null} initialViewerName={null}/>;
  }

  const project = await db.project.findUnique({
    where: { slug },
    include: {
      media: {
        orderBy: { displayOrder: "asc" },
        include: { reviews: { orderBy: { createdAt: "asc" } } },
      },
      creator: { select: { subscriptionActive: true, ...complimentaryAccessSelect, isComped: true } },
      sections: {
        orderBy: { displayOrder: "asc" },
        include: {
          // Files sitting directly in the section, with no
          // sub-section — the fallback group shown after every named
          // sub-section within it.
          media: {
            where: { folderId: null },
            orderBy: { displayOrder: "asc" },
            include: { reviews: { orderBy: { createdAt: "asc" } } },
          },
          // Every sub-section within this section, each with its own
          // files — this is what lets a client browse "Sonos
          // Campaign" and "Sonance Campaign" as genuinely separate
          // groups within the same section, instead of one flat list.
          folders: {
            orderBy: { displayOrder: "asc" },
            include: {
              media: {
                orderBy: { displayOrder: "asc" },
                include: { reviews: { orderBy: { createdAt: "asc" } } },
              },
            },
          },
        },
      },
      managedProject: {
        include: {
          tasks: {
            orderBy: { createdAt: "asc" },
            select: { id: true, title: true, status: true },
          },
        },
      },
    },
  });

  if (!project || project.deletedAt) notFound();

  // Public client opens count as views. Admin previews bypass the gate
  // without changing client analytics or creating viewer records.
  if (!isAdminPreview) {
    await db.project.update({
      where: { id: project.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  const mapMedia = (m: {
    id: string;
    type: "PHOTO" | "VIDEO" | "DOCUMENT" | "PDF";
    fileKey: string;
    aspectRatio?: number | null;
    posterFileKey?: string | null;
    caption: string | null;
    approvalStatus: "PENDING" | "APPROVED" | "NEEDS_REVISION";
    approvalNote: string | null;
    reviews: { reviewerName: string | null; reviewerEmail: string; status: "PENDING" | "APPROVED" | "NEEDS_REVISION"; note: string | null; createdAt: Date }[];
  }) => ({
    id: m.id,
    type: m.type,
    url: publicUrlFor(m.fileKey),
    aspectRatio: m.aspectRatio ?? null,
    posterUrl: m.posterFileKey ? publicUrlFor(m.posterFileKey) : null,
    caption: m.caption ?? "",
    approvalStatus: m.approvalStatus,
    approvalNote: m.approvalNote,
    reviews: m.reviews.map((r) => ({
      reviewerName: r.reviewerName,
      reviewerEmail: r.reviewerEmail,
      status: r.status as "APPROVED" | "NEEDS_REVISION",
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  });

  const canView = isAdminPreview || !!viewerSession;
  const canViewFiles = canView && (!project.managedProject || !!project.managedProject.publishedAt || isAdminPreview);
  const media = canViewFiles ? project.media.map(mapMedia) : [];

  // The client-facing view of each creator-named section — replaces the
  // old hardcoded "Films" / "Photography" split entirely. Only sections
  // that actually have files in them are shown — either directly in
  // the section, or inside one of its sub-sections.
  const sections = (canViewFiles ? project.sections : [])
    .filter((s) => s.media.length > 0 || s.folders.some((f) => f.media.length > 0))
    .map((s) => ({
      id: s.id,
      name: s.name,
      mediaType: s.mediaType,
      media: s.media.map(mapMedia),
      // Only sub-sections that actually have files — an empty
      // sub-section a creator hasn't finished uploading to yet stays
      // invisible to the client rather than showing as an empty
      // heading with nothing under it.
      folders: s.folders
        .filter((f) => f.media.length > 0)
        .map((f) => ({ id: f.id, name: f.name, media: f.media.map(mapMedia) })),
    }));

  // Anything not assigned to a section (older uploads from before
  // sections existed) — shown as its own fallback group by the
  // rendering component, same as on the creator's dashboard.
  const ungroupedMedia = (canViewFiles ? project.media : [])
    .filter((m) => !m.sectionId)
    .map(mapMedia);

  // Resolve the creator's chosen hero against the actual media list — if
  // it was deleted since being picked, this just falls back to null and
  // ProjectContent auto-picks the first video/photo instead.
  const heroMedia = project.heroMediaId
    ? media.find((m) => m.id === project.heroMediaId) ?? null
    : null;

  const managedProjectForClient = canView && project.managedProject
    ? {
        name: project.managedProject.name,
        publishedAt: project.managedProject.publishedAt?.toISOString() ?? null,
        tasks: project.managedProject.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
        brief: project.managedProject.briefVisibleToClient
          ? {
              objective: project.managedProject.briefObjective,
              background: project.managedProject.briefBackground,
              targetAudience: project.managedProject.briefTargetAudience,
              creativeDirection: project.managedProject.briefCreativeDirection,
              deliverables: project.managedProject.briefDeliverables,
              brandGuidelines: project.managedProject.briefBrandGuidelines,
              references: project.managedProject.briefReferences,
              requiredFormats: project.managedProject.briefRequiredFormats,
              platforms: project.managedProject.briefPlatforms,
              importantNotes: project.managedProject.briefImportantNotes,
              deadline: project.managedProject.briefDeadline?.toISOString() ?? null,
            }
          : null,
      }
    : null;

  return (
    <DeliveryPage
      projectId={project.id}
      clientName={project.clientName}
      badgeVisible={project.badgeVisible && !hasDeliveryPaidAccess(project.creator)}
      primaryColor={project.primaryColor ?? "#C9A84C"}
      bgColor={project.bgColor ?? "#080808"}
      logoUrl={project.logoUrl}
      media={media}
      sections={sections}
      ungroupedMedia={ungroupedMedia}
      heroMedia={heroMedia}
      heroTagline={project.heroTagline}
      deliveryStatus={project.deliveryStatus}
      initiallyUnlocked={isAdminPreview || !!viewerSession}
      initialViewerEmail={isAdminPreview ? currentCreator!.email : viewerSession?.email ?? null}
      initialViewerName={isAdminPreview ? currentCreator!.name : viewerSession?.name ?? null}
      managedProject={managedProjectForClient}
    />
  );
}
