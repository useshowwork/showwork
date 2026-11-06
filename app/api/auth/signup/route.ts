import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendOtpEmail, generateOtpCode } from "@/lib/resend";
import { isValidNigerianPhone } from "@/lib/phone";

// Step 1 of signup: validate details, generate a code, email it, and
// hold everything in PendingSignup. No Creator row exists yet — that
// only happens once the code is confirmed in /api/auth/verify-otp.
export async function POST(req: NextRequest) {
  const {
    email,
    password,
    name,
    phone,
    companyName,
    accountType,
    referralCode,
  } = await req.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and a password of at least 8 characters are required" },
      { status: 400 }
    );
  }

  if (!phone || !isValidNigerianPhone(phone)) {
    return NextResponse.json(
      { error: "Enter a valid Nigerian phone number, e.g. +2348012345678" },
      { status: 400 }
    );
  }

  const existingCreator = await db.creator.findUnique({ where: { email } });

  if (existingCreator) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const otpCode = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Genuinely optional — trimmed to a real value or left undefined,
  // never stored as an empty string.
  const trimmedCompanyName =
    typeof companyName === "string" && companyName.trim()
      ? companyName.trim()
      : null;

  // Only ever "AGENCY" if the form explicitly sent that — anything
  // else (missing, malformed, tampered with) safely falls back to the
  // default, ordinary account type rather than accidentally granting
  // agency behavior.
  const resolvedAccountType =
    accountType === "AGENCY"
      ? "AGENCY"
      : accountType === "SOCIAL_MEDIA_MANAGER"
        ? "SOCIAL_MEDIA_MANAGER"
        : "CREATOR";

  // Referral codes are optional. If one was supplied, verify on the
  // server that it belongs to an active partner before storing it.
  const savedReferralCode = (await cookies()).get("showwork_referral")?.value;
  const candidateReferralCode = typeof referralCode === "string" && referralCode.trim() ? referralCode : savedReferralCode;
  const normalizedReferralCode =
    typeof candidateReferralCode === "string" && candidateReferralCode.trim()
      ? candidateReferralCode.trim().toUpperCase()
      : null;

  let validReferralCode: string | null = null;

  if (normalizedReferralCode) {
    const partner = await db.partnerProfile.findUnique({
      where: {
        referralCode: normalizedReferralCode,
      },
      select: {
        referralCode: true,
        isActive: true,
          status: true,
      },
    });

    if (partner?.isActive && partner.status === "ACTIVE") {
      validReferralCode = partner.referralCode;
    }
  }

  // upsert: if they already started signing up (e.g. didn't finish
  // verifying last time), this just refreshes their code instead of
  // erroring on the unique email constraint.
  await db.pendingSignup.upsert({
    where: { email },
    update: {
      name,
      phone,
      companyName: trimmedCompanyName,
      passwordHash,
      otpCode,
      otpExpiresAt,
      accountType: resolvedAccountType,
      referralCode: validReferralCode,
    },
    create: {
      email,
      name,
      phone,
      companyName: trimmedCompanyName,
      passwordHash,
      otpCode,
      otpExpiresAt,
      accountType: resolvedAccountType,
      referralCode: validReferralCode,
    },
  });

  try {
    await sendOtpEmail(email, otpCode, name);
  } catch (err) {
    console.error("Failed to send OTP email:", err);

    return NextResponse.json(
      { error: "Couldn't send the verification email. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ email });
}