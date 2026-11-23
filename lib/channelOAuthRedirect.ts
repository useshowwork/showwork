type ChannelReturnPath = "/login" | `/dashboard/calendars/${string}`;

export function redirectWithinChannelFlow(path: ChannelReturnPath, status = 307) {
  return new Response(null, {
    status,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}
