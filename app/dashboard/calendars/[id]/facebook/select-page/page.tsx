import { hasCalendarPermission } from "@/lib/calendarPermissions";
import UiSymbol from "@/components/ui/UiSymbol";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  facebookPageSelectionCookieName,
  verifyFacebookPageSelection,
} from "@/lib/facebookPageSelection";

export default async function FacebookPageSelectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: calendarId } = await params;

  const creator = await getCurrentCreator();

  if (!creator) {
    redirect("/login");
  }

  const calendar = await db.socialCalendar.findUnique({
    where: { id: calendarId },
    select: {
      id: true,
      managerId: true,
      clientName: true,
    },
  });

  if (!calendar || !(await hasCalendarPermission(creator.id, calendarId, "channels.manage"))) {
    redirect("/dashboard/calendars");
  }

  const cookieStore = await cookies();

  const selection = verifyFacebookPageSelection(
    cookieStore.get(facebookPageSelectionCookieName())?.value,
  );

  if (!selection || selection.calendarId !== calendarId) {
    redirect(
      `/dashboard/calendars/${calendarId}?view=channels&facebookError=missing_state`,
    );
  }

  const safePages = selection.pages.map((page) => ({
    id: page.id,
    name: page.name,
  }));

  return (
    <main className="min-h-screen bg-[#070B12] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <a
          href={`/dashboard/calendars/${calendarId}?view=channels`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#94A3B8] transition hover:text-white"
        >
          <span aria-hidden="true"><><UiSymbol name="left" /></></span>
          Back to channels
        </a>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-[#263449] bg-[#0B111B] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="border-b border-[#223047] px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1877F2] text-xl font-bold text-white">
                f
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718096]">
                  Facebook connection
                </p>

                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Choose a Facebook Page
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-6 text-[#AAB4C3]">
                  Select the Facebook Page you want to connect to{" "}
                  <span className="font-medium text-white">
                    {calendar.clientName}
                  </span>
                  . Showwork will use the selected Page for publishing,
                  messaging and supported reporting features.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {!!selection.diagnostics?.issues.length && <p role="status" className="mb-4 text-sm text-[#AAB4C3]">Some Pages could not be checked. You can select an available Page or reconnect to retry account discovery.</p>}
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Pages you manage
                </p>
                <p className="mt-1 text-xs leading-5 text-[#718096]">
                  {safePages.length === 1
                    ? "1 Page is available to connect."
                    : `${safePages.length} Pages are available to connect.`}
                </p>
              </div>

              <span className="rounded-full border border-[#263449] bg-[#111A27] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                {safePages.length}{" "}
                {safePages.length === 1 ? "Page" : "Pages"}
              </span>
            </div>

            <div className="space-y-3">
              {safePages.map((page) => (
                <form
                  key={page.id}
                  action={`/api/calendars/${calendarId}/channels/facebook/select-page`}
                  method="POST"
                  className="group"
                >
                  <input type="hidden" name="pageId" value={page.id} />

                  <button
                    type="submit"
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#263449] bg-[#0E1622] p-4 text-left transition hover:border-[#1877F2]/60 hover:bg-[#111D2C] focus:outline-none focus:ring-2 focus:ring-[#1877F2]/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/15 text-sm font-bold text-[#5EA0FF]">
                        f
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {page.name}
                        </p>

                        <p className="mt-1 truncate text-[11px] text-[#718096]">
                          Page ID: {page.id}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-xl bg-[#1877F2] px-4 py-2 text-xs font-semibold text-white transition group-hover:brightness-110">
                      Select Page
                    </span>
                  </button>
                </form>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#263449] bg-[#0E1622] px-4 py-3">
              <p className="text-[11px] leading-5 text-[#94A3B8]">
                Only Pages returned by Meta for the Facebook account you just
                authorized can be selected. Your Facebook access credentials
                are not displayed on this page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}