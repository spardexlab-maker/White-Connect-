/** Reminder times for "every N hours starting at HH:MM" within one day (e.g. 08:00 every 8 h → 00:00, 08:00, 16:00). */
export function timesEvery(first: string, everyHours: number): string[] {
  const m = first.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || !(everyHours >= 1 && everyHours <= 24)) return [];
  const start = (Number(m[1]) % 24) * 60 + Number(m[2]);
  const out: string[] = [];
  for (let k = 0; k < Math.floor(24 / everyHours); k++) {
    const t = (start + k * everyHours * 60) % 1440;
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return [...new Set(out)].sort();
}

export const reminderIntervals = [4, 6, 8, 12, 24] as const;
