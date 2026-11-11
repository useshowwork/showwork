import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validMarketingUnsubscribeToken } from "@/lib/marketingEmailPreferences";

async function recipient(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get("creatorId");
  const token = req.nextUrl.searchParams.get("token");
  if (!creatorId || !token) return null;
  const creator = await db.creator.findUnique({ where: { id: creatorId }, select: { id: true, email: true } });
  return creator && validMarketingUnsubscribeToken(creator.id, creator.email, token) ? creator : null;
}

function page(content: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · Showwork</title></head><body style="margin:0;background:#f0f5fd;font-family:Arial,sans-serif;color:#19365b"><main style="max-width:440px;margin:12vh auto;padding:32px;background:white;border-radius:20px"><h1 style="font-size:24px">Marketing Workspace emails</h1>${content}</main></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// GET is deliberately read-only so email link scanners cannot unsubscribe users.
export async function GET(req: NextRequest) {
  if (!await recipient(req)) return page("<p>This email preferences link is invalid.</p>", 400);
  return page('<p>Stop the weekly Marketing Workspace email?</p><p>Account, security and activity notifications will continue.</p><form method="post"><button type="submit" style="border:0;border-radius:10px;background:#1764ed;color:white;padding:14px 20px;font:inherit;cursor:pointer">Unsubscribe</button></form>');
}

// Also supports provider one-click unsubscribe POSTs with the signed URL.
export async function POST(req: NextRequest) {
  const creator = await recipient(req);
  if (!creator) return page("<p>This email preferences link is invalid.</p>", 400);
  await db.creator.updateMany({ where: { id: creator.id, email: creator.email, marketingEmailsUnsubscribedAt: null }, data: { marketingEmailsUnsubscribedAt: new Date() } });
  return page("<p>You’re unsubscribed. You won’t receive weekly Marketing Workspace emails.</p><p>Account, security and activity notifications will continue.</p>");
}
