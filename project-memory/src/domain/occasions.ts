import type { Occasion } from './types';

/**
 * The occasion catalogue.
 *
 * Nothing here is enabled by default. A family opts into the days that matter
 * to them, which is the only defensible design for a product used by families
 * in Muscat, Manchester and everywhere between. `calendar` records how a date
 * is derived so the reminder engine can be added later without re-modelling.
 */
export const occasionCatalogue: readonly Occasion[] = [
  { key: 'birthday', labelEn: 'Birthday', labelAr: 'عيد الميلاد', calendar: 'derived' },
  { key: 'first_day_school', labelEn: 'First day at school', labelAr: 'أول يوم دراسي', calendar: 'custom' },
  { key: 'ramadan', labelEn: 'Ramadan', labelAr: 'رمضان', calendar: 'hijri' },
  { key: 'eid_al_fitr', labelEn: 'Eid al-Fitr', labelAr: 'عيد الفطر', calendar: 'hijri' },
  { key: 'eid_al_adha', labelEn: 'Eid al-Adha', labelAr: 'عيد الأضحى', calendar: 'hijri' },
  { key: 'qaranqasho', labelEn: 'Qaranqasho', labelAr: 'قرنقشوه', calendar: 'hijri' },
  { key: 'christmas', labelEn: 'Christmas', labelAr: 'عيد الميلاد المجيد', calendar: 'gregorian' },
  { key: 'new_year', labelEn: 'New Year', labelAr: 'رأس السنة', calendar: 'gregorian' },
  { key: 'national_day', labelEn: 'National Day', labelAr: 'العيد الوطني', calendar: 'gregorian' },
  { key: 'graduation', labelEn: 'Graduation', labelAr: 'التخرج', calendar: 'custom' },
  { key: 'family_anniversary', labelEn: 'Family anniversary', labelAr: 'ذكرى عائلية', calendar: 'custom' },
];

export function occasionLabel(key: string, language: 'en' | 'ar'): string {
  const occasion = occasionCatalogue.find((item) => item.key === key);
  if (!occasion) return key;
  return language === 'ar' ? occasion.labelAr : occasion.labelEn;
}
