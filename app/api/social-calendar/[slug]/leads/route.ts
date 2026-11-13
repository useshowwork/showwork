import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyViewerToken } from "@/lib/auth";
import { canAccessCalendarById } from "@/lib/calendarPermissions";
import { visibleChannelLead } from "@/lib/socialMessaging/visibility";
import { clientLeadRecord } from "@/lib/clientLeads";

export async function GET(req: NextRequest, {params}: {params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const calendar=await db.socialCalendar.findUnique({where:{slug},select:{id:true}});
  if(!calendar)return NextResponse.json({error:"Not found."},{status:404});
  const token=req.cookies.get(`calendar_viewer_${calendar.id}`)?.value;
  if(!token || !verifyViewerToken(token,calendar.id))return NextResponse.json({error:"Please sign in to this client workspace first."},{status:401});
  if(!await canAccessCalendarById(calendar.id))return NextResponse.json({error:"This workspace is not active."},{status:403});
  try {
    const leads=await db.calendarLead.findMany({
      where:{calendarId:calendar.id,AND:[visibleChannelLead]},
      orderBy:[{updatedAt:"desc"},{createdAt:"desc"}],take:5000,
      select:{id:true,name:true,username:true,email:true,phone:true,company:true,temperature:true,status:true,source:true,createdAt:true,updatedAt:true,
        socialConversation:{select:{platform:true,participantName:true,participantUsername:true}}},
    });
    return NextResponse.json({leads:leads.map(clientLeadRecord)},{headers:{"Cache-Control":"no-store, private"}});
  }catch{return NextResponse.json({error:"Could not load leads. Please try again."},{status:503});}
}
