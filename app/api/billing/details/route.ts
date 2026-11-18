import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(request: Request) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Sign in to edit billing details." }, { status: 401 });

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Enter valid billing details." }, { status: 400 });
  }
  const limits = { name: 160, email: 254, address: 600, taxId: 100 };
  const details: Record<string, string | null> = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length > limit) {
      return NextResponse.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
    }
    details[field] = value.trim() || null;
  }
  if (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
    return NextResponse.json({ error: "Enter a valid billing email." }, { status: 400 });
  }

  try {
    await db.accountBillingDetails.upsert({
      where: { creatorId: creator.id },
      create: { creatorId: creator.id, ...details },
      update: details,
    });
    return NextResponse.json({ details });
  } catch {
    return NextResponse.json({ error: "Billing details couldn’t be saved. Try again." }, { status: 503 });
  }
}
