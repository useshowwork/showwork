/** Local calendar dates: avoid UTC conversions and fixed 24-hour DST arithmetic. */
export type CalendarPeriod = "day" | "week" | "month";
export function calendarWeek(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
}
export function moveCalendarPeriod(anchor: Date, period: CalendarPeriod, delta: number): Date {
  return period === "month"
    ? new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1)
    : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + delta * (period === "week" ? 7 : 1));
}
