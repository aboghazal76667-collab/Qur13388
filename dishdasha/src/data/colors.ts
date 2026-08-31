import { hexToHsl } from '@dd/engine/color';
import type { ColorFamily, GarmentColor, ThreadColor } from '@dd/domain/types';

const c = (
  id: string,
  ar: string,
  en: string,
  hex: string,
  family: ColorFamily,
): GarmentColor => ({
  id,
  name: { ar, en },
  hex,
  family,
  lightness: hexToHsl(hex).l,
  active: true,
});

/**
 * Dishdasha base colours. The palette leans on the tones actually worn in
 * Oman — whites and off-whites dominate, with muted greys, sands, olives and
 * deep blues for cooler months and formal wear.
 */
export const GARMENT_COLORS: GarmentColor[] = [
  c('col_pure_white', 'أبيض ناصع', 'Pure white', '#FFFFFF', 'white'),
  c('col_soft_white', 'أبيض ناعم', 'Soft white', '#F8F6F1', 'white'),
  c('col_off_white', 'أبيض مكسور', 'Off white', '#F2EDE3', 'white'),
  c('col_ivory', 'عاجي', 'Ivory', '#EFE7D6', 'white'),
  c('col_cream', 'كريمي', 'Cream', '#EADFC8', 'beige'),
  c('col_sand', 'رملي', 'Sand', '#DFD1B6', 'beige'),
  c('col_warm_beige', 'بيج دافئ', 'Warm beige', '#D6C3A5', 'beige'),
  c('col_camel', 'جملي', 'Camel', '#C1A279', 'beige'),
  c('col_taupe', 'بني رمادي', 'Taupe', '#A2907C', 'brown'),
  c('col_stone_grey', 'رمادي حجري', 'Stone grey', '#C8C6C0', 'grey'),
  c('col_ash_grey', 'رمادي فاتح', 'Ash grey', '#AFAEA9', 'grey'),
  c('col_warm_grey', 'رمادي دافئ', 'Warm grey', '#9A928A', 'grey'),
  c('col_graphite', 'رمادي داكن', 'Graphite', '#5C5C5E', 'grey'),
  c('col_charcoal', 'فحمي', 'Charcoal', '#3B3B3D', 'black'),
  c('col_black', 'أسود', 'Black', '#1B1B1C', 'black'),
  c('col_sky_mist', 'أزرق ضبابي', 'Sky mist', '#CFD9DF', 'blue'),
  c('col_powder_blue', 'أزرق باهت', 'Powder blue', '#A8BCCB', 'blue'),
  c('col_steel_blue', 'أزرق فولاذي', 'Steel blue', '#6E869B', 'blue'),
  c('col_navy', 'كحلي', 'Navy', '#25384F', 'blue'),
  c('col_midnight', 'أزرق ليلي', 'Midnight', '#1B2536', 'blue'),
  c('col_sage', 'أخضر مريمي', 'Sage', '#B4BEA9', 'green'),
  c('col_olive', 'زيتوني', 'Olive', '#7E8259', 'green'),
  c('col_deep_green', 'أخضر عميق', 'Deep green', '#2F4A3C', 'green'),
  c('col_bottle_green', 'أخضر زجاجي', 'Bottle green', '#1E3A31', 'green'),
  c('col_mocha', 'بني موكا', 'Mocha', '#6B4F3A', 'brown'),
  c('col_chestnut', 'كستنائي', 'Chestnut', '#8A5A3B', 'brown'),
  c('col_burgundy', 'عنابي', 'Burgundy', '#5C2B33', 'accent'),
  c('col_plum', 'بنفسجي داكن', 'Plum', '#4A3552', 'accent'),
];

export const getColor = (id: string): GarmentColor | undefined =>
  GARMENT_COLORS.find((x) => x.id === id);

export const colorHex = (id: string, fallback = '#F2EDE3'): string =>
  getColor(id)?.hex ?? getThreadColor(id)?.hex ?? fallback;

const t = (
  id: string,
  ar: string,
  en: string,
  hex: string,
  metallic = false,
): ThreadColor => ({ id, name: { ar, en }, hex, metallic, active: true });

/**
 * Thread colours. Kept as a separate catalogue from garment colours because
 * thread ranges, metallics and stock behave differently from bolt fabric.
 */
export const THREAD_COLORS: ThreadColor[] = [
  t('th_white', 'أبيض', 'White', '#FBFAF7'),
  t('th_ivory', 'عاجي', 'Ivory', '#EFE6D2'),
  t('th_sand', 'رملي', 'Sand', '#D9C7A7'),
  t('th_gold', 'ذهبي', 'Gold', '#C39B4A', true),
  t('th_antique_gold', 'ذهبي عتيق', 'Antique gold', '#9C7A3C', true),
  t('th_silver', 'فضي', 'Silver', '#BFC4C7', true),
  t('th_platinum', 'بلاتيني', 'Platinum', '#DDE0E2', true),
  t('th_pearl_grey', 'رمادي لؤلؤي', 'Pearl grey', '#B7B3AC'),
  t('th_graphite', 'رمادي داكن', 'Graphite', '#585A5C'),
  t('th_black', 'أسود', 'Black', '#1E1E1F'),
  t('th_navy', 'كحلي', 'Navy', '#22354C'),
  t('th_royal_blue', 'أزرق ملكي', 'Royal blue', '#2C5686'),
  t('th_sky', 'أزرق فاتح', 'Light blue', '#8FB3CC'),
  t('th_teal', 'أزرق مخضر', 'Teal', '#2A6D6B'),
  t('th_deep_green', 'أخضر عميق', 'Deep green', '#2C4A3B'),
  t('th_olive', 'زيتوني', 'Olive', '#787A4F'),
  t('th_sage', 'مريمي', 'Sage', '#A8B49E'),
  t('th_burgundy', 'عنابي', 'Burgundy', '#6B2F38'),
  t('th_maroon', 'خمري', 'Maroon', '#4E2027'),
  t('th_copper', 'نحاسي', 'Copper', '#A9673F', true),
  t('th_chocolate', 'بني داكن', 'Chocolate', '#4F3728'),
  t('th_camel', 'جملي', 'Camel', '#B08E62'),
  t('th_plum', 'بنفسجي', 'Plum', '#523A5C'),
  t('th_charcoal_blue', 'أزرق فحمي', 'Charcoal blue', '#333F4C'),
];

export const getThreadColor = (id: string): ThreadColor | undefined =>
  THREAD_COLORS.find((x) => x.id === id);

export const threadHex = (id: string, fallback = '#22354C'): string =>
  getThreadColor(id)?.hex ?? getColor(id)?.hex ?? fallback;
