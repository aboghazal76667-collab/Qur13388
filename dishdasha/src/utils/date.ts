export const nowIso = (): string => new Date().toISOString();

export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatDate = (iso: string, lang: 'ar' | 'en' = 'ar'): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = lang === 'ar' ? AR_MONTHS : EN_MONTHS;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatDateTime = (iso: string, lang: 'ar' | 'en' = 'ar'): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${formatDate(iso, lang)} · ${hh}:${mm}`;
};

export const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

/** Season inferred from the Omani calendar: long hot season, short cool one. */
export const currentSeason = (date = new Date()): 'summer' | 'winter' => {
  const m = date.getMonth() + 1;
  return m >= 4 && m <= 10 ? 'summer' : 'winter';
};

export const currentTimeOfDay = (date = new Date()): 'day' | 'evening' =>
  date.getHours() >= 17 || date.getHours() < 6 ? 'evening' : 'day';
