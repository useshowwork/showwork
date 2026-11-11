import { socialPreviewImage } from "@/lib/seo";
import SiteFooter from "@/components/landing/SiteFooter";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

import Navbar from "@/components/Navbar";
import WebinarLandingContent from "@/components/webinars/WebinarLandingContent";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                METADATA                                    */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const webinar = await db.creativoWebinar.findUnique({
    where: { slug },
    select: {
      topic: true,
      description: true,
      flyerImageUrl: true,
    },
  });

  if (!webinar) {
    return {
      title: "Webinar not found | Showwork",
      description: "The requested Creativo webinar could not be found.",
      robots: { index: false, follow: false },
    };
  }

  const title = `${webinar.topic.slice(0, 42)} | Creativo`;
  const description = (webinar.description ||
    "Join a Creativo webinar for photographers, videographers and creative professionals. Learn practical ways to grow your creative business.").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://useshowwork.com";

  const image = socialPreviewImage.url;

  return {
    title,
    description,
    alternates: { canonical: `/webinars/${slug}` },

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      type: "website",
      title,
      description,
      url: `${baseUrl}/webinars/${slug}`,
      siteName: "Showwork",
      images: [
        {
          url: image,
          width: socialPreviewImage.width,
          height: socialPreviewImage.height,
          alt: socialPreviewImage.alt,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  PAGE                                      */
/* -------------------------------------------------------------------------- */

export default async function WebinarLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const webinar = await db.creativoWebinar.findUnique({
    where: { slug },
    include: {
      speakers: {
        orderBy: {
          displayOrder: "asc",
        },
      },
    },
  });

  if (!webinar) {
    notFound();
  }

  const isPast = webinar.startsAt < new Date();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08090B] text-white">
      {/* ================================================================== */}
      {/* SHOWWORK NAVIGATION                                                */}
      {/* ================================================================== */}

      <div className="relative z-[100]">
        <Navbar />
      </div>

      {/* ================================================================== */}
      {/* CINEMATIC TOP FRAME                                                 */}
      {/* ================================================================== */}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-240px] h-[620px] w-[620px] -translate-x-1/2 rounded-full opacity-[0.13] blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, #2478FF 0%, rgba(36,120,255,0.15) 45%, transparent 72%)",
          }}
        />

        <div
          className="absolute right-[-180px] top-[35%] h-[480px] w-[480px] rounded-full opacity-[0.07] blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, #68B2FF 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ================================================================== */}
      {/* WEBINAR EXPERIENCE                                                  */}
      {/* ================================================================== */}

      <div className="relative z-10">
        <WebinarLandingContent
          webinar={{
            ...webinar,
            startsAt: webinar.startsAt.toISOString(),
          }}
          isPast={isPast}
        />
      </div>

      {/* ================================================================== */}
      {/* SUBTLE PAGE FINISH                                                  */}
      {/* ================================================================== */}

      <div className="pointer-events-none relative z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <SiteFooter />
    </main>
  );
}
