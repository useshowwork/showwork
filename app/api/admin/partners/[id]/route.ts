import { parsePartnerTerms, type PartnerTerms } from "@/lib/partnerTerms";
import { publishingIntegrationInstalled, invokePublishingEntrypoint, assertLegacyPublishingAllowed, nativePolicyExecutionAllowed } from "@/lib/publishing/applicationBoundary";
import { queuePartnerWelcomeBenefit, scheduleBenefitEmailDelivery } from "@/lib/billingBenefitNotifications";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { getCurrentCreator } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  sendPartnerApplicationDeclinedEmail,
  sendPartnerWelcomeEmail,
} from "@/lib/resend";

const REFERRAL_CODE_LENGTH = 10;

function generateReferralCode(): string {
  return randomBytes(8)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, REFERRAL_CODE_LENGTH)
    .toUpperCase();
}

async function createUniqueReferralCode(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();

    const existing = await tx.partnerProfile.findUnique({
      where: {
        referralCode: code,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique referral code");
}
async function requireAdmin() {
  const creator = await getCurrentCreator();

  if (!creator || !isAdminEmail(creator.email)) {
    return null;
  }

  return creator;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  /* canonical-integration-boundary */ if (publishingIntegrationInstalled()) { if (!nativePolicyExecutionAllowed("app/api/admin/partners/[id]/route.ts#PATCH@55")) { return await invokePublishingEntrypoint<never>("app/api/admin/partners/[id]/route.ts#PATCH@55",Array.from(arguments)); } } /* end-canonical-integration-boundary */

  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  let body: { action?: string; terms?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const action = body.action;

  if (!["approve", "reject", "pause", "resume", "suspend"].includes(action ?? "")) {
    return NextResponse.json(
      {
        error: 'Invalid partner action',
      },
      { status: 400 }
    );
  }

  if (action === "pause" || action === "resume" || action === "suspend") {
    try {
      const partner = await db.$transaction(async tx => {
        const current = await tx.partnerProfile.findUnique({ where: { id }, select: { status: true, isActive: true } });
        if (!current || !["ACTIVE", "SUSPENDED"].includes(current.status)) throw new Error("Only approved partners can be paused, suspended or resumed.");
        if (action === "pause" && current.status !== "ACTIVE") throw new Error("Resume this suspended partner first.");
        const changed = await tx.partnerProfile.updateMany({ where: { id, status: current.status, isActive: current.isActive }, data: { status: action === "suspend" ? "SUSPENDED" : "ACTIVE", isActive: action === "resume" } });
        if (changed.count !== 1) throw new Error("Partner changed. Refresh and retry.");
        await tx.partnerAuditEvent.create({ data: { actorId: admin.id, targetId: id, action: `PARTNER_${action.toUpperCase()}`, detail: { previousStatus: current.status, previousActive: current.isActive } } });
        return tx.partnerProfile.findUnique({ where: { id } });
      }, { isolationLevel: "Serializable" });
      return NextResponse.json({ ok: true, partner });
    } catch (error) { return NextResponse.json({ error: ["P2034", "P2002"].includes((error as { code?: string }).code ?? "") ? "Partner changed. Refresh and retry." : (error as Error).message }, { status: 409 }); }
  }

  let terms: PartnerTerms | undefined;
  if (action === "approve") {
    try { terms = parsePartnerTerms(body.terms); } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const partner = await tx.partnerProfile.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          status: true,
          isActive: true,
          referralCode: true,
          creator: {
            select: {
              id: true,
              email: true,
              name: true,
              isDeactivated: true,
              isComped: true,
              compedUntil: true,
            },
          },
        },
      });

      if (!partner) {
        throw new Error("PARTNER_NOT_FOUND");
      }

      if (partner.status !== "PENDING") {
        throw new Error("APPLICATION_ALREADY_PROCESSED");
      }

      if (partner.creator.isDeactivated) {
        throw new Error("CREATOR_DEACTIVATED");
      }

      if (action === "reject") {
        const updated = await tx.partnerProfile.update({
          where: {
            id: partner.id,
          },
          data: {
            status: "REJECTED",
            isActive: false,
          },
          select: {
            id: true,
            status: true,
            isActive: true,
          },
        });

        await tx.partnerAuditEvent.create({ data: { actorId: admin.id, targetId: id, action: "PARTNER_REJECT", detail: {} } });
        return {
          action: "reject" as const,
          partner: updated,
          creator: partner.creator,
        };
      }

      const referralCode = await createUniqueReferralCode(tx);

      const now = new Date();

      /*
       * If the creator already has complimentary access that extends
       * into the future, preserve it and add one month to the end.
       * Otherwise, the complimentary month starts now.
       */
      const compedStart =
        partner.creator.compedUntil &&
        partner.creator.compedUntil.getTime() > now.getTime()
          ? partner.creator.compedUntil
          : now;

      const compedUntil = new Date(compedStart);
      compedUntil.setMonth(compedUntil.getMonth() + 1);

      const updatedPartner = await tx.partnerProfile.update({
        where: {
          id: partner.id,
        },
        data: {
          ...terms!,
          referralCode,
          status: "ACTIVE",
          isActive: true,
        },
        select: {
          id: true,
          referralCode: true,
          status: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.creator.update({
        where: {
          id: partner.creator.id,
        },
        data: {
          isComped: true,
          compedUntil,
        },
      });

      await queuePartnerWelcomeBenefit(tx, partner.creator, compedUntil);
      await tx.partnerAuditEvent.create({ data: { actorId: admin.id, targetId: id, action: "PARTNER_APPROVE", detail: { ...terms! } } });

      return {
        action: "approve" as const,
        partner: updatedPartner,
        creator: partner.creator,
        compedUntil,
      };
    }, { isolationLevel: "Serializable" });

    if (result.action === "reject") {
      try {
        await sendPartnerApplicationDeclinedEmail({
          to: result.creator.email,
          name: result.creator.name,
        });
      } catch (emailError) {
        console.error(
          `Failed to send partner rejection email to ${result.creator.email}:`,
          emailError
        );
      }

      return NextResponse.json({
        ok: true,
        action: "reject",
        partner: result.partner,
      });
    }

    scheduleBenefitEmailDelivery();
    try {
      await sendPartnerWelcomeEmail({
        to: result.creator.email,
        name: result.creator.name,
        terms: terms!,
        partnerManagerName: "Tijesu",
        partnerManagerEmail: "otolulope@useshowwork.com",
      });
    } catch (emailError) {
      console.error(
        `Failed to send partner welcome email to ${result.creator.email}:`,
        emailError
      );
    }

    return NextResponse.json({
      ok: true,
      action: "approve",
      partner: result.partner,
      complimentaryAccess: {
        compedUntil: result.compedUntil,
      },
    });
  } catch (error) {
    if (["P2034", "P2002"].includes((error as { code?: string }).code ?? "")) return NextResponse.json({ error: "Application changed during review. Refresh and retry." }, { status: 409 });
    if (error instanceof Error) {
      if (error.message === "PARTNER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Partner application not found" },
          { status: 404 }
        );
      }

      if (error.message === "APPLICATION_ALREADY_PROCESSED") {
        return NextResponse.json(
          {
            error:
              "This Partner Program application has already been processed",
          },
          { status: 409 }
        );
      }

      if (error.message === "CREATOR_DEACTIVATED") {
        return NextResponse.json(
          {
            error:
              "This creator account is deactivated and cannot be approved",
          },
          { status: 403 }
        );
      }
    }

    console.error("Admin partner application action error:", error);

    return NextResponse.json(
      {
        error: "Failed to process partner application",
      },
      { status: 500 }
    );
  }
}