/** Date inputs use local calendar dates, independent of UTC offsets and DST. */
export function initialGenerationDates(today = new Date()) {
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const end = new Date(today);
  end.setDate(end.getDate() + 6); // Both endpoints are included: seven calendar days.
  return { start: format(today), end: format(end) };
}

export function generationFrequencyError(value: string): string | null {
  const number = Number(value);
  return !value.trim() || !Number.isInteger(number) || number < 1 || number > 14
    ? "Enter your posting frequency: 1–14 posts per week."
    : null;
}
