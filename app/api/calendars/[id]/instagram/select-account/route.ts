import { MetaDiscoveryError } from "@/lib/metaPageDiscovery";
import { NextRequest, NextResponse } from "next/server";

import {
  publishingIntegrationInstalled,
  invokePublishingEntrypoint,
} from "@/lib/publishing/applicationBoundary";

import { getCurrentCreator } from "@/lib/auth";
import { hasCalendarPermission } from "@/lib/calendarPermissions";

import {
  verifyFacebookPageSelection,
  facebookPageSelectionCookieOptions,
} from "@/lib/facebookPageSelection";

import {
  listManagedPages,
  inspectInstagramPageAccess,
  listInstagramGrantedPermissions,
} from "@/lib/instagram";

import { completeInstagramConnection } from "@/lib/instagramConnection";

const COOKIE = "showwork_instagram_legacy_selection";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function invoke(
  request: NextRequest,
  context: RouteContext
) {
  // ============================================================
  // 1. CANONICAL PUBLISHING INTEGRATION
  // ============================================================

  if (publishingIntegrationInstalled()) {
    try {
      return await invokePublishingEntrypoint<NextResponse>(
        `app/api/calendars/[id]/instagram/select-account/route.ts#${request.method}`,
        [request, context]
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof MetaDiscoveryError ? error.message : "Account selection failed. Please reconnect.",
          code: error instanceof MetaDiscoveryError ? error.code : "INSTAGRAM_DISCOVERY_FAILED",
          diagnostics: error instanceof MetaDiscoveryError ? error.diagnostics : undefined,
        },
        {
          status: 409,
          headers: NO_STORE_HEADERS,
        }
      );
    }
  }

  // ============================================================
  // 2. AUTHENTICATION
  // ============================================================

  const creator = await getCurrentCreator();

  if (!creator) {
    return NextResponse.json(
      {
        error: "Sign in to continue.",
      },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  const { id } = await context.params;

  // ============================================================
  // 3. WORKSPACE PERMISSIONS
  // ============================================================

  const allowed = await hasCalendarPermission(
    creator.id,
    id,
    "channels.manage"
  );

  if (!allowed) {
    return NextResponse.json(
      {
        error: "You cannot manage this workspace's channels.",
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  // ============================================================
  // 4. REQUEST SECURITY
  // ============================================================

  if (
    request.method === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      {
        error: "Invalid request origin.",
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  // ============================================================
  // 5. VERIFY FACEBOOK OAUTH SESSION
  // ============================================================

  const session = verifyFacebookPageSelection(
    request.cookies.get(COOKIE)?.value
  );

  if (
    !session ||
    session.calendarId !== id ||
    session.pages.length !== 1 ||
    session.pages[0].id !== creator.id
  ) {
    return NextResponse.json(
      {
        error:
          "Your account selection session expired. Connect Instagram again.",
        code: "INSTAGRAM_SESSION_EXPIRED",
      },
      {
        status: 409,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  try {
    // ==========================================================
    // 6. CHECK META PERMISSIONS
    // ==========================================================

    const userAccessToken = session.pages[0].accessToken;

    // Explicit read-only diagnostic using this browser's actor/workspace-bound
    // OAuth session. This ID is never passed to account binding or discovery.
    const checkPageId = request.nextUrl.searchParams.get("checkPageId");
    if (request.method === "GET" && checkPageId !== null) {
      if (!/^\d{5,30}$/.test(checkPageId)) return NextResponse.json({error:"Enter the numeric Facebook Page ID."},{status:400,headers:NO_STORE_HEADERS});
      return NextResponse.json({pageAccessCheck:await inspectInstagramPageAccess(userAccessToken,checkPageId)}, {headers:NO_STORE_HEADERS});
    }

    const grantedPermissions =
      await listInstagramGrantedPermissions(userAccessToken);

    const permissionDiagnostics = {
      pagesShowListGranted:
        grantedPermissions.includes("pages_show_list"),

      pagesReadEngagementGranted:
        grantedPermissions.includes("pages_read_engagement"),

      pagesManageMetadataGranted:
        grantedPermissions.includes("pages_manage_metadata"),

      instagramBasicGranted:
        grantedPermissions.includes("instagram_basic"),

      instagramContentPublishGranted:
        grantedPermissions.includes("instagram_content_publish"),

      instagramManageMessagesGranted:
        grantedPermissions.includes("instagram_manage_messages"),

      instagramInsightsGranted:
        grantedPermissions.includes("instagram_manage_insights"),
    };

    // ==========================================================
    // 7. DISCOVER FACEBOOK PAGES
    // ==========================================================

    const allPages = await listManagedPages(userAccessToken);

    // ==========================================================
    // 8. DISCOVER LINKED INSTAGRAM ACCOUNTS
    // ==========================================================

    const eligiblePages = allPages.filter(
      (page) => Boolean(page.instagram_business_account?.id)
    );

    // ==========================================================
    // 9. DETERMINE DISCOVERY STATUS
    // ==========================================================

    let discoveryStatus:
      | "PAGES_PERMISSION_MISSING"
      | "NO_FACEBOOK_PAGES"
      | "NO_INSTAGRAM_RELATIONSHIP"
      | "ACCOUNTS_FOUND";

    if (!permissionDiagnostics.pagesShowListGranted) {
      discoveryStatus = "PAGES_PERMISSION_MISSING";
    } else if (allPages.length === 0) {
      discoveryStatus = "NO_FACEBOOK_PAGES";
    } else if (eligiblePages.length === 0) {
      discoveryStatus = "NO_INSTAGRAM_RELATIONSHIP";
    } else {
      discoveryStatus = "ACCOUNTS_FOUND";
    }

    // ==========================================================
    // 10. SAFE DIAGNOSTICS
    // ==========================================================

    const diagnostics = {
      facebookPagesFound: allPages.length,

      instagramAccountsFound: eligiblePages.length,

      ...allPages.diagnostics,
      discoveryStatus: allPages.diagnostics?.discoveryStatus ?? discoveryStatus,

      permissions: permissionDiagnostics,
    };

    // ==========================================================
    // 11. GET: RETURN INSTAGRAM ACCOUNT OPTIONS
    // ==========================================================

    if (request.method === "GET") {
      const accounts = eligiblePages.map((page) => ({
        accountId: page.instagram_business_account!.id,

        pageId: page.id,

        tasks: page.tasks ?? null,
        name: `${
          page.name
        } — ${
          page.instagram_business_account?.username
            ? `@${page.instagram_business_account.username}`
            : "linked Instagram account"
        }`,
      }));

      return NextResponse.json(
        {
          accounts,
          grantedPermissions,

          expectedVersion: 0,

          insightsGranted:
            permissionDiagnostics.instagramInsightsGranted,

          diagnostics,
        },
        {
          status: 200,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    // ==========================================================
    // 12. POST: VALIDATE SELECTED ACCOUNT
    // ==========================================================

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !("accountId" in body) ||
      typeof body.accountId !== "string" ||
      !body.accountId.trim()
    ) {
      return NextResponse.json(
        {
          error: "Select a valid Instagram account.",
          code: "INVALID_INSTAGRAM_ACCOUNT",
        },
        {
          status: 400,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const accountId = body.accountId;

    const page = eligiblePages.find(
      (candidate) =>
        candidate.instagram_business_account?.id === accountId
    );

    if (!page?.instagram_business_account) {
      return NextResponse.json(
        {
          error:
            "Select an Instagram account linked to a Facebook Page you have permission to use.",
          code: "INSTAGRAM_ACCOUNT_NOT_FOUND",
        },
        {
          status: 400,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    // ==========================================================
    // 13. COMPLETE INSTAGRAM CONNECTION
    // ==========================================================

    await completeInstagramConnection(
      id,
      {
        ...page,
        instagram_business_account:
          page.instagram_business_account,
      },
      grantedPermissions,
      new Date(
        session.userTokenExpiresAt ?? Date.now()
      )
    );

    // ==========================================================
    // 14. CLEAR TEMPORARY SELECTION SESSION
    // ==========================================================

    const response = NextResponse.json(
      {
        connected: true,
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );

    response.cookies.set(
      COOKIE,
      "",
      {
        ...facebookPageSelectionCookieOptions(0),
        path: `/api/calendars/${id}/instagram/select-account`,
      }
    );

    return response;
  } catch (error) {
    // ==========================================================
    // 15. ERROR HANDLING
    // ==========================================================

    console.error("[Instagram Account Selection]", {
      code: error instanceof MetaDiscoveryError ? error.code : "INSTAGRAM_DISCOVERY_FAILED",
    });

    // Never expose Meta access tokens or raw API errors.
    return NextResponse.json(
      {
        error:
          error instanceof MetaDiscoveryError ? error.message : "Instagram account discovery failed. Please reconnect and try again.",

        code: error instanceof MetaDiscoveryError ? error.code : "INSTAGRAM_DISCOVERY_FAILED",
        diagnostics: error instanceof MetaDiscoveryError ? error.diagnostics : undefined,
      },
      {
        status: 502,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}

export const GET = invoke;
export const POST = invoke;