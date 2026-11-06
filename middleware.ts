import { NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = "useshowwork.com";

/** Old and new portfolio hosts resolve to the same database-backed slug route. */
export function middleware(req: NextRequest) {
  const capture = (response: NextResponse) => {
    const code = req.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
    // Last explicit referral link wins for 30 days; signup validates active partner eligibility.
    if (code && /^[A-Z0-9]{6,32}$/.test(code)) response.cookies.set("showwork_referral", code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
    return response;
  };
  const authority = req.headers.get("host") || "";
  // Do not interpret forwarded hosts, arbitrary origins, nested hosts or malformed DNS labels as tenants.
  if (!/^[a-z\d.-]+(?::\d+)?$/i.test(authority)) return capture(NextResponse.next());
  const hostname = authority.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
  if ([ROOT_DOMAIN, `www.${ROOT_DOMAIN}`, "localhost", "127.0.0.1"].includes(hostname)) return capture(NextResponse.next());

  const suffix = hostname.endsWith(`.${ROOT_DOMAIN}`) ? `.${ROOT_DOMAIN}`
    : hostname.endsWith(".localhost") ? ".localhost" : null;
  if (!suffix) return capture(NextResponse.next());
  const slug = hostname.slice(0, -suffix.length);
  if (!/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/.test(slug)) return capture(NextResponse.next());

  const path = req.nextUrl.pathname;
  // Keep shared assets and APIs at their actual routes, even when middleware is invoked directly.
  if (/^\/(?:_next|api|images)(?:\/|$)/.test(path)
    || /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|woff2?|ttf|otf|txt|xml|webmanifest)$/i.test(path)) return capture(NextResponse.next());

  const prefix = `/portfolio/${slug}`;
  if (path === prefix || path.startsWith(`${prefix}/`)) return capture(NextResponse.next());
  const url = req.nextUrl.clone();
  url.pathname = `${prefix}${path === "/" ? "" : path}`;
  return capture(NextResponse.rewrite(url));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|images).*)"],
};
