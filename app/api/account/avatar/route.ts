import { NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateIdentityImage } from "@/lib/identityImages";

async function changeAvatar(request: Request) {
  const creator = await getCurrentCreator();
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return updateIdentityImage(request, `avatars/${creator.id}/profile-`, creator.avatarUrl, async (avatarUrl) => {
    const result = await db.creator.updateMany({
      where: { id: creator.id, avatarUrl: creator.avatarUrl },
      data: { avatarUrl },
    });
    return result.count === 1;
  });
}

export { changeAvatar as POST, changeAvatar as DELETE };
