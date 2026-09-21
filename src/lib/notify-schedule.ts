/**
 * Timing for the automated Telegram messages.
 *
 * Everything here is Sri Lanka local time — the shop's clock, never UTC.
 *
 * Pure: no database, no Prisma, so the arithmetic can be exercised directly.
 */

export const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar date in Sri Lanka, as YYYY-MM-DD. */
export function slDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + SL_OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutes since midnight in Sri Lanka. */
export function slMinutesOfDay(now: Date = new Date()): number {
  const sl = new Date(now.getTime() + SL_OFFSET_MS);
  return sl.getUTCHours() * 60 + sl.getUTCMinutes();
}

/** "22:00" -> 1320. Null for anything unparseable, so a bad value never fires. */
export function parseHHMM(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * How far back the end-of-day jobs look to decide which day they are reporting on.
 *
 * The jobs run shortly AFTER midnight, so that the day they report on is complete —
 * this shop does most of its trade between 22:00 and midnight, so any cut-off before
 * midnight silently drops real sales. That means the clock has already rolled over to
 * the next date by the time the job runs, and reading it directly would report on a
 * brand new empty day.
 *
 * Four hours puts the anchor back in the evening of the day being closed, and still
 * names that day correctly if Vercel runs the job up to ~3h50m late.
 */
const REPORT_ANCHOR_MS = 4 * 60 * 60 * 1000;

/**
 * The Sri Lanka day an end-of-day job is covering, as YYYY-MM-DD.
 *
 * Deliberately NOT "today": see REPORT_ANCHOR_MS. A run at 00:10 reports on the day
 * that has just finished, and an early or late run agrees with it.
 */
export function reportDay(now: Date = new Date()): string {
  return slDateString(new Date(now.getTime() - REPORT_ANCHOR_MS));
}

/**
 * The instants that bound a Sri Lanka calendar day, as real UTC Dates for querying.
 *
 * Half-open: midnight up to but excluding the next midnight, so consecutive days
 * neither overlap nor leave a gap a sale could fall through.
 */
export function slDayBounds(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00.000Z`).getTime() - SL_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
}

/**
 * Are we inside quiet hours? Handles a window that crosses midnight, which is the
 * normal case — 22:00 to 07:00 is nine hours of quiet, not fifteen hours of noise.
 */
export function isQuietNow({
  enabled,
  from,
  to,
  now = new Date(),
}: {
  enabled: boolean;
  from: string | null | undefined;
  to: string | null | undefined;
  now?: Date;
}): boolean {
  if (!enabled) return false;
  const start = parseHHMM(from);
  const end = parseHHMM(to);
  if (start === null || end === null) return false;
  if (start === end) return false; // a zero-length window silences nothing
  const mins = slMinutesOfDay(now);
  return start < end
    ? mins >= start && mins < end // same day, e.g. 01:00–06:00
    : mins >= start || mins < end; // wraps midnight, e.g. 22:00–07:00
}
