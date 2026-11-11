import { recordPartnerReferral } from "@/lib/partnerTerms";
import { queueGlobalBenefitsForNewUser, scheduleBenefitEmailDelivery } from "@/lib/billingBenefitNotifications";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import {
  sendWelcomeEmail,
  sendPartnerReferralSignupEmail,
} from "@/lib/resend";

// Step 2 of signup: confirms the code, then actually creates the
// Creator row from whatever was held in PendingSignup.
export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 }
    );
  }

  const pending = await db.pendingSignup.findUnique({
    where: { email },
  });

  if (!pending) {
    return NextResponse.json(
      {
        error:
          "No signup in progress for this email. Please sign up again.",
      },
      { status: 404 }
    );
  }

  if (pending.otpExpiresAt < new Date()) {
    return NextResponse.json(
      {
        error: "This code has expired. Please request a new one.",
      },
      { status: 400 }
    );
  }

  if (pending.otpCode !== code.trim()) {
    return NextResponse.json(
      { error: "Incorrect code" },
      { status: 400 }
    );
  }

  const alreadyExists = await db.creator.findUnique({
    where: { email },
  });

  if (alreadyExists) {
    await db.pendingSignup.delete({
      where: { email },
    });

    return NextResponse.json(
      {
        error:
          "An account with this email already exists",
      },
      { status: 409 }
    );
  }

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const creator = await tx.creator.create({
      data: {
        email: pending.email,
        name: pending.name,
        phone: pending.phone,
        companyName: pending.companyName,
        passwordHash: pending.passwordHash,
        accountType: pending.accountType,
        lastLoginAt: now,

        lifecycleSequenceStartedAt: now,
      },
    });

    let partnerForEmail: {
      email: string;
      name: string | null;
    } | null = null;

    if (pending.referralCode) {
      const partner = await tx.partnerProfile.findUnique({
        where: {
          referralCode: pending.referralCode,
        },
        select: {
          id: true,
          creatorId: true,
          commissionPercent: true, commissionMonths: true, discountPercent: true, discountMonths: true,
          isActive: true,
          status: true,
          creator: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      // Only attribute the signup if the partner still exists,
      // is active, and is not the newly created Creator.
      if (
        partner &&
        partner.isActive &&
        partner.status === "ACTIVE" &&
        partner.creatorId !== creator.id
      ) {
        await recordPartnerReferral(tx, partner, creator.id);

        partnerForEmail = {
          email: partner.creator.email,
          name: partner.creator.name,
        };
      }
    }

    await queueGlobalBenefitsForNewUser(tx, creator);

    await tx.pendingSignup.delete({
      where: { email: pending.email },
    });

    return {
      creator,
      partnerForEmail,
    };
  });

  scheduleBenefitEmailDelivery();

  // One-time welcome after successful account creation. Delivery failure must not
  // undo signup; the provider key prevents duplicate sends on retried delivery.
  try {
    await sendWelcomeEmail({
      to: result.creator.email, name: result.creator.name, creatorId: result.creator.id,
    });
    await db.creator.update({
      where: { id: result.creator.id }, data: { welcomeEmailSentAt: new Date() },
    });
  } catch {
    console.error("Account welcome email failed", { creatorId: result.creator.id });
  }

  // Partner referral notification — best effort.
  // This is intentionally outside the transaction so an email
  // provider failure can never undo the signup.
  if (result.partnerForEmail) {
    try {
      await sendPartnerReferralSignupEmail({
        to: result.partnerForEmail.email,
        partnerName: result.partnerForEmail.name,
        referredCreatorName: result.creator.name,
      });
    } catch (err) {
      console.error(
        "Failed to send partner referral signup email:",
        err
      );
    }
  }

  const token = createSessionToken(result.creator.id);

  const response = NextResponse.json({
    id: result.creator.id,
    email: result.creator.email,
  });

  setSessionCookie(response, token);

  return response;
}
