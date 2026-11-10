import { visibleInboxConnection } from "@/lib/socialMessaging/visibility";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCalendarById, hasCalendarPermission, calendarFeatureGate } from "@/lib/calendarPermissions";
export async function POST(req: NextRequest, {params}: {params: Promise<{id:string;conversationId:string}>}) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id,conversationId} = await params;
  if (!await hasCalendarPermission(creator.id,id,"inbox.reply") || !await canAccessCalendarById(id)) return NextResponse.json({error:"Not found"},{status:404});
  const lock = await calendarFeatureGate(id,"socialInbox"); if (lock) return lock;
  const body = await req.json().catch(()=>null);
  if (typeof body?.operationId !== "string" || body.confirmation !== "CHECKED_PLATFORM_INBOX") return NextResponse.json({error:"Check the platform inbox before acknowledging this delivery."},{status:400});
  const result = await db.socialInboxOutbound.updateMany({where:{id:body.operationId,conversationId,conversation:{calendarId:id,...visibleInboxConnection},state:"UNCONFIRMED",reviewedAt:null},data:{reviewedAt:new Date(),reviewedByCreatorId:creator.id}});
  if (!result.count) return NextResponse.json({error:"This delivery is not awaiting a check."},{status:409});
  // An operator check permits future messages; it never claims provider delivery or resends this one.
  return NextResponse.json({ok:true});
}
