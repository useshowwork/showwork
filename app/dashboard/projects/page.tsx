import ShowworkLogo from "@/components/brand/ShowworkLogo";
import DeliveryHelpLink from "@/components/help/DeliveryHelpLink";
import { cookies } from "next/headers";
import ProjectDashboardTheme, { ProjectThemeToggle } from "@/components/projects/ProjectDashboardTheme";
import styles from "@/components/projects/ProjectDeliveryDashboard.module.css";
import { ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, CreditCard, Eye, FolderOpen, Layers, Plus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import DashboardProjectList from "@/components/DashboardProjectList";
import { getCreatorUsage } from "@/lib/subscriptionUsage";
import { TIERS, PLAN_DISPLAY_NAME, NEXT_TIER } from "@/lib/subscriptionTiers";
import { isAdminEmail } from "@/lib/admin";
const PAGE_SIZE = 12;
const SHARED_DISPLAY_LIMIT = 12;
const BILLING_HREF = "/dashboard/billing?product=delivery#project-delivery-plans";

export default async function ProjectDeliveryPage() {
  const initialTheme = (await cookies()).get("showwork-projects-theme")?.value === "dark" ? "dark" : "light";
  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  /* ─────────────────────────────────────────
     PROJECT DELIVERY DATA
  ───────────────────────────────────────── */

  const ownedWhere = {
    creatorId: creator.id,
    deletedAt: null,
  };

  const totalCount = await db.project.count({
    where: ownedWhere,
  });

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const ownedProjects = await db.project.findMany({
    where: ownedWhere,
    orderBy: {
      createdAt: "desc",
    },
    take: PAGE_SIZE,
    include: {
      _count: {
        select: {
          media: true,
          viewerEmails: true,
        },
      },
    },
  });

  /* ─────────────────────────────────────────
     SHARED PROJECTS
  ───────────────────────────────────────── */

  const collaboratorMemberships =
    await db.projectCollaborator.findMany({
      where: {
        creatorId: creator.id,
        project: {
          deletedAt: null,
        },
      },
      orderBy: {
        addedAt: "desc",
      },
      take: SHARED_DISPLAY_LIMIT + 1,
      include: {
        project: {
          include: {
            creator: {
              select: {
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                media: true,
              },
            },
          },
        },
      },
    });

  const sharedProjects = collaboratorMemberships
    .slice(0, SHARED_DISPLAY_LIMIT)
    .map((c) => c.project);

  const hasMoreShared =
    collaboratorMemberships.length > SHARED_DISPLAY_LIMIT;

  /* ─────────────────────────────────────────
     MANAGED PROJECTS
  ───────────────────────────────────────── */

  const [
    ownedManagedProjects,
    collaboratingManagedProjects,
  ] = await Promise.all([
    db.managedProject.findMany({
      where: {
        creatorId: creator.id,
        deliveryProject: {
          deletedAt: null,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        deliveryProject: {
          select: {
            id: true,
          },
        },
        tasks: {
          select: {
            status: true,
          },
        },
      },
    }),

    db.managedProject.findMany({
      where: {
        collaborators: {
          some: {
            creatorId: creator.id,
          },
        },
        deliveryProject: {
          deletedAt: null,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        deliveryProject: {
          select: {
            id: true,
          },
        },
        tasks: {
          select: {
            status: true,
          },
        },
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const managedProjects = [
    ...ownedManagedProjects.map((mp) => ({
      ...mp,
      role: "owner" as const,
      ownerLabel: null as string | null,
    })),

    ...collaboratingManagedProjects.map((mp) => ({
      ...mp,
      role: "collaborator" as const,
      ownerLabel: mp.creator.name || mp.creator.email,
    })),
  ].sort(
    (a, b) =>
      b.createdAt.getTime() -
      a.createdAt.getTime(),
  );

  /* ─────────────────────────────────────────
     STATS
  ───────────────────────────────────────── */

  const allProjectsForStats =
    await db.project.findMany({
      where: {
        creatorId: creator.id,
        deletedAt: null,
      },
      select: {
        viewCount: true,
        _count: {
          select: {
            viewerEmails: true,
          },
        },
      },
    });

  const usage = await getCreatorUsage(creator);

  const totalViews = allProjectsForStats.reduce(
    (sum, p) => sum + p.viewCount,
    0,
  );

  const totalEmails = allProjectsForStats.reduce(
    (sum, p) => sum + p._count.viewerEmails,
    0,
  );


  const planName = PLAN_DISPLAY_NAME[usage.tier];

  const nextTier = NEXT_TIER[usage.tier];

  const nextTierInfo = nextTier
    ? TIERS[nextTier]
    : null;

  const nearCap =
    usage.limit !== Infinity &&
    usage.remaining <=
      Math.max(
        1,
        Math.ceil(usage.limit * 0.2),
      );

  const atCap =
    usage.limit !== Infinity &&
    usage.remaining <= 0;

  const usagePercentage =
    usage.limit === Infinity
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            (usage.used / usage.limit) * 100,
          ),
        );

  return <ProjectDashboardTheme initialTheme={initialTheme}>
    <div className={styles.frame}>
      <aside className={styles.rail} aria-label="Project Delivery navigation">
        <div className={styles.identity}><Link href="/dashboard" className={styles.brand}><ShowworkLogo tone="white"/></Link><p>Project Delivery</p><small>From first share to final delivery.</small></div>
        <nav><span className={styles.navLabel}>YOUR WORK</span><a href="#projects" className={styles.navActive}><FolderOpen size={18}/>Projects<span>{totalCount}</span></a>{managedProjects.length>0&&<a href="#managed"><BriefcaseBusiness size={18}/>Managed projects<span>{managedProjects.length}</span></a>}<Link href={BILLING_HREF}><CreditCard size={18}/>Billing & plan</Link></nav>
        <div className={styles.planCard}><span>YOUR PLAN</span><strong>{planName}</strong><p>{usage.limit===Infinity?'Unlimited projects':`${usage.used} of ${usage.limit} projects used`}</p>{usage.limit!==Infinity&&<div className={styles.usageTrack} role="progressbar" aria-label="Project allowance used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usagePercentage}><span style={{width:`${usagePercentage}%`}}/></div>}<Link href={BILLING_HREF}>Manage plan <ArrowUpRight size={13}/></Link></div>
        <div className={styles.railFooter}><DeliveryHelpLink className={styles.railHelp}/><Link href="/dashboard"><ArrowLeft size={16}/>All tools</Link></div>
      </aside>
      <header className={styles.toolbar}><div><Layers size={16}/><span>Project Delivery</span></div><div><DeliveryHelpLink className={styles.headerHelp}/><ProjectThemeToggle/><Link href="/dashboard/profile" className={styles.profile}>Account</Link>{isAdminEmail(creator.email)&&<Link href="/admin" className={styles.profile}>Admin</Link>}<LogoutButton/></div></header>
      <section className={styles.content} aria-labelledby="delivery-title">
        <div className={styles.pageHeading}><div><p className={styles.kicker}>YOUR CLIENT WORK, TOGETHER</p><h1 id="delivery-title">Project Delivery</h1><p>{totalCount>0||sharedProjects.length>0?'Open a project to manage files, feedback, and final delivery.':'Create a project to share your work and collect client feedback.'}</p></div><Link href="/dashboard/start" className={styles.primary}><Plus size={16}/>New project</Link></div>
        {(nearCap||atCap)&&<aside className={styles.allowance} aria-label="Project allowance"><p>{atCap?'You’ve used your current project allowance.':`You have ${usage.remaining} ${usage.remaining===1?'project':'projects'} left on your plan.`}</p><Link href={BILLING_HREF}>{nextTierInfo?`Explore ${PLAN_DISPLAY_NAME[nextTier!]}`:'Manage plan'}<ArrowRight size={14}/></Link></aside>}
        {totalCount>0&&<div className={styles.stats}><div><span><FolderOpen size={16}/>Your projects</span><strong>{totalCount}</strong></div><div><span><Eye size={16}/>Project views</span><strong>{totalViews.toLocaleString()}</strong></div><div><span><Users size={16}/>Emails collected</span><strong>{totalEmails.toLocaleString()}</strong></div></div>}
        <section id="projects" aria-label="Your delivery projects" className={styles.projectList}>
          <DashboardProjectList initialData={{
            ownedProjects:ownedProjects.map(project=>({id:project.id,clientName:project.clientName,slug:project.slug,createdAt:project.createdAt.toISOString(),viewCount:project.viewCount,_count:project._count})),
            totalCount,totalPages,currentPage:1,
            sharedProjects:sharedProjects.map(project=>({id:project.id,clientName:project.clientName,createdAt:project.createdAt.toISOString(),creator:project.creator,_count:project._count})),hasMoreShared,
          }}/>
        </section>
        {managedProjects.length>0&&<section id="managed" className={styles.managed} aria-labelledby="managed-title"><div className={styles.sectionHeading}><div><h2 id="managed-title">Managed projects</h2><p>Track tasks and prepare your next client delivery.</p></div><span>{managedProjects.length}</span></div><div className={styles.managedGrid}>{managedProjects.map(project=>{
          const done=project.tasks.filter(task=>task.status==='DONE').length;
          const count=project.tasks.length;
          const published=!!project.publishedAt;
          const href=published&&project.deliveryProject?`/dashboard/${project.deliveryProject.id}`:`/dashboard/managed/${project.id}`;
          return <Link key={project.id} href={href} className={styles.managedCard}><div className={styles.cardTop}><span className={styles.status} data-published={published}>{published?'Published':'In progress'}</span>{project.role==='collaborator'&&<small>Shared with you</small>}</div><h3>{project.name}</h3>{project.ownerLabel&&<p>Managed by {project.ownerLabel}</p>}{count>0?<div className={styles.progress}><span>{done} of {count} tasks complete</span><div><span style={{width:`${Math.round(done/count*100)}%`}}/></div></div>:<p className={styles.noTasks}>No tasks added yet</p>}<div className={styles.cardAction}>{published?'Open delivery':'Open project'}<ArrowRight size={15}/></div></Link>;
        })}</div></section>}
        <footer className={styles.footer}><span>Showwork · Project Delivery</span><div><Link href={BILLING_HREF}>Billing</Link><Link href="/help/project-delivery">Help & guides</Link><a href="mailto:hello@useshowwork.com">Contact support</a></div></footer>
      </section>
    </div>
  </ProjectDashboardTheme>;
}
