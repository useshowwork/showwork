import { NextResponse } from "next/server";

import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getCurrentCreator();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const partner = await db.partnerProfile.findUnique({
    where: {
      creatorId: session.id,
    },
    select: {
      id: true,
      referralCode: true, status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          referrals: true,
        },
      },
    },
  });

  if (!partner) {
    return NextResponse.json(
      {
        enrolled: false,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    enrolled: partner.status === "ACTIVE",
    access: partner.status,
    partner: {
      id: partner.id,
      referralCode: partner.status === "ACTIVE" ? partner.referralCode : null,
      isActive: partner.isActive,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
      referralCount: partner._count.referrals,
    },
  });
}