import { redirect, notFound } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/url";
import ManagedProjectBrief from "@/components/ManagedProjectBrief";
import ManagedProjectCollaborators from "@/components/ManagedProjectCollaborators";
import ManagedProjectTasks from "@/components/ManagedProjectTasks";
import ManagedProjectPublish from "@/components/ManagedProjectPublish";
import ManagedProjectStudio from "@/components/projects/ManagedProjectStudio";
function formatStatus(status:string){return status.replace(/_/g," ").toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());}

export default async function ManagedProjectDetailPage({
  params,
}: {
  params: Promise<{ managedProjectId: string }>;
}) {
  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  const { managedProjectId } = await params;

  const managedProject = await db.managedProject.findUnique({
    where: {
      id: managedProjectId,
    },
    include: {
      collaborators: {
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      deliveryProject: {
        select: {
          slug: true,
          accessCode: true,
        },
      },
    },
  });

  if (!managedProject) {
    notFound();
  }

  const isOwner = managedProject.creatorId === creator.id;

  const isCollaborator =
    !isOwner &&
    managedProject.collaborators.some(
      (c) => c.creatorId === creator.id
    );

  if (!isOwner && !isCollaborator) {
    notFound();
  }

  const assigneeOptions = [
    {
      id: managedProject.creatorId,
      name: creator.name,
      email: creator.email,
    },
    ...managedProject.collaborators
      .filter(
        (c) => c.creatorId !== managedProject.creatorId
      )
      .map((c) => ({
        id: c.creator.id,
        name: c.creator.name,
        email: c.creator.email,
      })),
  ];

  const portalUrl = managedProject.deliveryProject
    ? `${appUrl()}/${managedProject.deliveryProject.slug}`
    : null;

  const status = formatStatus(managedProject.status);

  return <ManagedProjectStudio name={managedProject.name} status={managedProject.publishedAt ? "Published" : status} isOwner={isOwner} portalUrl={portalUrl} accessCode={isOwner ? managedProject.deliveryProject?.accessCode ?? null : null}
    brief={<ManagedProjectBrief managedProjectId={managedProject.id} isOwner={isOwner} brief={{
      name: managedProject.name,
      briefObjective: managedProject.briefObjective,
      briefBackground: managedProject.briefBackground,
      briefTargetAudience: managedProject.briefTargetAudience,
      briefCreativeDirection: managedProject.briefCreativeDirection,
      briefDeliverables: managedProject.briefDeliverables,
      briefBrandGuidelines: managedProject.briefBrandGuidelines,
      briefReferences: managedProject.briefReferences,
      briefRequiredFormats: managedProject.briefRequiredFormats,
      briefPlatforms: managedProject.briefPlatforms,
      briefImportantNotes: managedProject.briefImportantNotes,
      briefDeadline: managedProject.briefDeadline?.toISOString() ?? null,
      briefVisibleToClient: managedProject.briefVisibleToClient,
    }}/>}
    team={<ManagedProjectCollaborators managedProjectId={managedProject.id} isOwner={isOwner}/>}
    tasks={<ManagedProjectTasks managedProjectId={managedProject.id} isOwner={isOwner} currentCreatorId={creator.id} assigneeOptions={assigneeOptions}/>}
    deliver={isOwner ? <ManagedProjectPublish managedProjectId={managedProject.id} publishedAt={managedProject.publishedAt?.toISOString() ?? null}/> : null}
  />;
}
