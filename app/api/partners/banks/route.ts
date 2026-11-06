import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { listNigerianBanks } from "@/lib/paystack";
export async function GET() {
  if (!await getCurrentCreator()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ banks: await listNigerianBanks() }); }
  catch { return NextResponse.json({ error: "Bank list unavailable. Try again shortly." }, { status: 503 }); }
}
