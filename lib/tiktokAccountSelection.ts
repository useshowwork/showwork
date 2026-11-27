import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

const COOKIE = "showwork_tiktok_account_selection";
const TTL = 600;

type Selection = {
  calendarId: string;
  actorId: string;
  accountId: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  scopes: string;
  connectionVersion: number | null;
};

function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("TikTok account selection requires a server secret.");
  return createHmac("sha256", secret).update(COOKIE).digest();
}

function cookieOptions(calendarId: string, maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: `/api/calendars/${encodeURIComponent(calendarId)}/tiktok/select-account`, maxAge };
}

function stageTikTokAccount(response: NextResponse, selection: Selection, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = Buffer.from(JSON.stringify({ ...selection, id, expiresAt: Date.now() + TTL * 1000 }));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const value = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  if (value.length > 3750) throw new Error("TikTok account selection exceeds the browser cookie limit.");
  response.cookies.set(COOKIE, value, cookieOptions(selection.calendarId, TTL));
  return response;
}

export function tikTokSelectionRedirect(settingsUrl: URL, selection: Selection) {
  const attempt = randomUUID();
  settingsUrl.searchParams.set("tiktokSelection", attempt);
  const response = NextResponse.redirect(settingsUrl);
  response.headers.set("Cache-Control", "no-store");
  return stageTikTokAccount(response, selection, attempt);
}

export async function handleTikTokAccountSelection(
  request: NextRequest,
  calendarId: string,
  actorId: string,
  confirm: (selection: Selection & { id: string }) => Promise<void>,
) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  let action: unknown;
  let id: unknown = request.nextUrl.searchParams.get("attempt");
  if (request.method === "POST") {
    if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Invalid request origin." }, 403);
    const body = await request.json().catch(() => null);
    action = body?.action;
    id = body?.attempt;
    if (action !== "confirm" && action !== "cancel") return reply({ error: "Choose whether to connect this account." }, 400);
  }

  let selection: (Selection & { id: string; expiresAt: number }) | undefined;
  try {
    const value = request.cookies.get(COOKIE)?.value;
    if (value) {
      const bytes = Buffer.from(value, "base64url");
      const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      selection = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    }
  } catch { /* An invalid cookie cannot authorize a connection. */ }

  if (!selection || selection.id !== id || selection.actorId !== actorId || selection.calendarId !== calendarId || selection.expiresAt <= Date.now() || selection.accessExpiresAt <= Date.now()) {
    return reply({ error: "This TikTok connection attempt expired or was replaced. Start again from Connect TikTok." }, 409);
  }
  if (request.method === "GET") return reply({ displayName: selection.displayName, avatarUrl: selection.avatarUrl });
  if (action === "confirm") {
    try {
      await confirm(selection);
    } catch (error) {
      if (error instanceof Error && error.message === "ACCOUNT_VERSION_CONFLICT") {
        return reply({ error: "The TikTok connection changed. Start a new connection attempt." }, 409);
      }
      console.error("Could not confirm TikTok account connection.");
      return reply({ error: "Could not connect this TikTok account. Please try again." }, 500);
    }
  }
  const response = reply({ ok: true });
  response.cookies.set(COOKIE, "", cookieOptions(calendarId, 0));
  return response;
}
