import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import RouteTransitionIndicator from "@/components/RouteTransitionIndicator";
import ShowworkSupport from "@/components/support/ShowworkSupport";

// The platform's one and only font source — swap the typeface by
// changing this import and the name below; every component using
// font-sans (or nothing at all, since this becomes Tailwind's
// default) picks up the change automatically.
const brandFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://useshowwork.com"),
  ...pageMetadata({
    title: "Showwork | Marketing Workspace, Project Delivery & Portfolios",
    description: "Plan social media content, collaborate with your team, deliver client projects and showcase creative work with Showwork.",
    path: "/",
    keywords: ["marketing workspace", "social media content calendar", "client project delivery", "creative portfolio builder"],
  }),
  // Canonicals belong to individual pages; private routes must not inherit the homepage URL.
  alternates: undefined,
};

// Lets TypeScript know window.fbq exists (set by the Meta Pixel
// script below) — without this, any file that calls window.fbq
// elsewhere in the app would get a type error, since fbq isn't a
// real, built-in property of Window.
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={brandFont.variable}>
           <body>
        
        {/* Meta Pixel Code — loads on every page, tracks pageviews site-wide */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1047882427696794');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1047882427696794&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}

        <Suspense fallback={null}>
          <RouteTransitionIndicator />
        </Suspense>
        {children}
        <ShowworkSupport />
      </body>
    </html>
  );
}
