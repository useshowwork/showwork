import type { Prisma } from "@prisma/client";

/** Disconnected accounts are excluded from workspace views without deleting history. */
export const visibleInboxConnection = {
  connection: { status: { in: ["CONNECTED", "NEEDS_REAUTH"] } },
} satisfies Prisma.SocialLeadConversationWhereInput;

/** Manual/imported leads are independent of channel connections. */
export const visibleChannelLead = {
  OR: [
    { socialConversation: null },
    { socialConversation: visibleInboxConnection },
  ],
} satisfies Prisma.CalendarLeadWhereInput;
