import { ageOn, type IsoDate } from '@/domain';
import { pluralise } from '@/i18n/plurals';
import type { Strings } from '@/i18n';

/**
 * "5 years old", "سنتان", "Newborn".
 *
 * One helper, used by every screen that shows an age, so a child is never
 * "1 years old" in one place and correct in another.
 */
export function describeAge(
  dateOfBirth: IsoDate,
  t: Strings,
  formatNumber: (value: number) => string,
): string {
  const age = ageOn(dateOfBirth);

  if (age.totalMonths < 1) return t.child.newborn;

  if (age.years < 1) {
    return pluralise(
      age.totalMonths,
      {
        one: t.child.ageMonthOne,
        two: t.child.ageMonthTwo,
        few: t.child.ageMonths,
        many: t.child.ageMonthsMany,
      },
      formatNumber,
    );
  }

  return pluralise(
    age.years,
    {
      one: t.child.ageYearOne,
      two: t.child.ageYearTwo,
      few: t.child.ageYears,
      many: t.child.ageYearsMany,
    },
    formatNumber,
  );
}

/** "Turning 6" — used for an upcoming birthday. */
export function describeTurning(
  turning: number,
  t: Strings,
  formatNumber: (value: number) => string,
): string {
  return pluralise(
    turning,
    { one: t.child.turning, two: t.child.turning, few: t.child.turning, many: t.child.turning },
    formatNumber,
  );
}

/** "1 memory", "5 memories", "ذكرى واحدة". */
export function describeMemoryCount(
  count: number,
  t: Strings,
  formatNumber: (value: number) => string,
): string {
  return pluralise(
    count,
    {
      one: t.family.memoryCountOne,
      two: t.family.memoryCountTwo,
      few: t.family.memoriesCount,
      many: t.family.memoriesCountMany,
    },
    formatNumber,
  );
}
