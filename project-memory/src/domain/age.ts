import type { IsoDate } from './types';

export interface Age {
  years: number;
  months: number;
  totalMonths: number;
}

export function parseIsoDate(value: IsoDate): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

/** Calendar-accurate age. `at` defaults to today. */
export function ageOn(dateOfBirth: IsoDate, at: IsoDate = todayIso()): Age {
  const birth = parseIsoDate(dateOfBirth);
  const now = parseIsoDate(at);
  if (!birth || !now || now < birth) return { years: 0, months: 0, totalMonths: 0 };

  let months =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birth.getUTCMonth());
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  months = Math.max(0, months);

  return { years: Math.floor(months / 12), months: months % 12, totalMonths: months };
}

/**
 * The years a child's timeline should span: birth year through the current
 * year. Used to render the year rail, so it grows on its own every January.
 */
export function timelineYears(dateOfBirth: IsoDate, at: IsoDate = todayIso()): number[] {
  const birth = parseIsoDate(dateOfBirth);
  const now = parseIsoDate(at);
  if (!birth || !now) return [];
  const start = birth.getUTCFullYear();
  const end = Math.max(start, now.getUTCFullYear());
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

/** Next birthday as an ISO date, and how many days away it is. */
export function nextBirthday(
  dateOfBirth: IsoDate,
  at: IsoDate = todayIso(),
): { date: IsoDate; daysAway: number; turning: number } | null {
  const birth = parseIsoDate(dateOfBirth);
  const now = parseIsoDate(at);
  if (!birth || !now) return null;

  let year = now.getUTCFullYear();
  let next = new Date(Date.UTC(year, birth.getUTCMonth(), birth.getUTCDate()));
  if (next < now) {
    year += 1;
    next = new Date(Date.UTC(year, birth.getUTCMonth(), birth.getUTCDate()));
  }

  const daysAway = Math.round((next.getTime() - now.getTime()) / 86_400_000);
  return { date: toIsoDate(next), daysAway, turning: year - birth.getUTCFullYear() };
}
