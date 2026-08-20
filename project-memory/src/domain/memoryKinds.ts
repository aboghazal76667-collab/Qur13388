import type { Ionicons } from '@expo/vector-icons';

import type { MemoryKind } from './types';

export interface MemoryKindPresentation {
  kind: MemoryKind;
  icon: keyof typeof Ionicons.glyphMap;
  labelEn: string;
  labelAr: string;
  /** Pre-fills the title field so a parent never faces a blank form. */
  suggestionEn: string;
  suggestionAr: string;
}

export const memoryKindPresentation: readonly MemoryKindPresentation[] = [
  {
    kind: 'birthday',
    icon: 'gift-outline',
    labelEn: 'Birthday',
    labelAr: 'عيد ميلاد',
    suggestionEn: 'Birthday',
    suggestionAr: 'عيد ميلاد',
  },
  {
    kind: 'first_day',
    icon: 'footsteps-outline',
    labelEn: 'First day',
    labelAr: 'أول يوم',
    suggestionEn: 'First day at school',
    suggestionAr: 'أول يوم في المدرسة',
  },
  {
    kind: 'family_moment',
    icon: 'home-outline',
    labelEn: 'Family moment',
    labelAr: 'لحظة عائلية',
    suggestionEn: 'A day together',
    suggestionAr: 'يوم جمعنا',
  },
  {
    kind: 'holiday',
    icon: 'moon-outline',
    labelEn: 'Holiday',
    labelAr: 'مناسبة',
    suggestionEn: 'Eid',
    suggestionAr: 'العيد',
  },
  {
    kind: 'achievement',
    icon: 'ribbon-outline',
    labelEn: 'Achievement',
    labelAr: 'إنجاز',
    suggestionEn: 'Something they did for the first time',
    suggestionAr: 'شيء فعله لأول مرة',
  },
  {
    kind: 'custom',
    icon: 'sparkles-outline',
    labelEn: 'Custom memory',
    labelAr: 'ذكرى خاصة',
    suggestionEn: '',
    suggestionAr: '',
  },
];

export function presentationFor(kind: MemoryKind): MemoryKindPresentation {
  return (
    memoryKindPresentation.find((item) => item.kind === kind) ??
    memoryKindPresentation[memoryKindPresentation.length - 1]
  );
}
