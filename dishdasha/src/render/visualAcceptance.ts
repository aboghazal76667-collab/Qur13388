/**
 * VISUAL ACCEPTANCE GATE.
 *
 * A technically-loading GLB is not an accepted garment. These twenty-two checks
 * are the contract between us and whoever supplies the asset, taken from the
 * V3 brief, and a human answers them against the rendered views.
 *
 * Until every blocking check passes, `visuallyAccepted` stays false and the
 * asset is never served to a customer.
 */
export type AcceptanceCheckId =
  | 'front_silhouette'
  | 'view_45'
  | 'side_volume'
  | 'back_modelled'
  | 'shoulder_sleeve_transition'
  | 'ankle_length'
  | 'not_plastic'
  | 'white_folds_visible'
  | 'dark_folds_visible'
  | 'shaq_plausible'
  | 'embroidery_restrained'
  | 'embroidery_follows_surface'
  | 'furakha_volume'
  | 'no_giant_motif'
  | 'no_gulf_collar'
  | 'no_saudi_stand_collar'
  | 'no_fake_perspective'
  | 'same_mesh_all_views'
  | 'fabric_change_keeps_realism'
  | 'threads_independent'
  | 'studio_presentation'
  | 'detail_zoom_holds_up';

export type AcceptanceCheck = {
  id: AcceptanceCheckId;
  label: { ar: string; en: string };
  /** Blocking checks must pass before an asset may be shown to a customer. */
  blocking: boolean;
};

export const ACCEPTANCE_CHECKS: AcceptanceCheck[] = [
  { id: 'front_silhouette', label: { ar: 'الشكل الأمامي يطابق المرجع', en: 'Front silhouette follows the master reference' }, blocking: true },
  { id: 'view_45', label: { ar: 'زاوية 45° تبقى أصيلة', en: '45° view remains authentic' }, blocking: true },
  { id: 'side_volume', label: { ar: 'الجانب له حجم مقنع', en: 'Side view has believable volume' }, blocking: true },
  { id: 'back_modelled', label: { ar: 'الظهر مُنمذج فعلياً', en: 'Back is actually modelled' }, blocking: true },
  { id: 'shoulder_sleeve_transition', label: { ar: 'انتقال الكتف والكم طبيعي', en: 'Shoulder and sleeve transitions are natural' }, blocking: true },
  { id: 'ankle_length', label: { ar: 'الطول يصل للكاحل', en: 'Reaches the correct ankle region' }, blocking: true },
  { id: 'not_plastic', label: { ar: 'القماش لا يبدو بلاستيكياً', en: 'Cloth does not look like plastic' }, blocking: true },
  { id: 'white_folds_visible', label: { ar: 'الأبيض يحتفظ بالثنيات', en: 'White cloth retains visible folds' }, blocking: true },
  { id: 'dark_folds_visible', label: { ar: 'الداكن يحتفظ بالثنيات', en: 'Dark cloth retains visible folds' }, blocking: true },
  { id: 'shaq_plausible', label: { ar: 'الشق منطقي فيزيائياً', en: 'Shaq is physically plausible' }, blocking: true },
  { id: 'embroidery_restrained', label: { ar: 'التطريز دقيق ومتحفظ', en: 'Embroidery is restrained and fine' }, blocking: true },
  { id: 'embroidery_follows_surface', label: { ar: 'التطريز يتبع سطح القماش', en: 'Embroidery follows the cloth surface' }, blocking: true },
  { id: 'furakha_volume', label: { ar: 'الفراخة لها حجم وتدلٍّ مقنع', en: 'Furakha has believable volume and hang' }, blocking: true },
  { id: 'no_giant_motif', label: { ar: 'لا يوجد نقش عملاق', en: 'No giant decorative motif' }, blocking: true },
  { id: 'no_gulf_collar', label: { ar: 'لا ياقة ثوب خليجي عام', en: 'No generic Gulf thawb collar' }, blocking: true },
  { id: 'no_saudi_stand_collar', label: { ar: 'لا ياقة سعودية قائمة', en: 'No Saudi-style stand collar' }, blocking: true },
  { id: 'no_fake_perspective', label: { ar: 'لا دوران منظوري مزيف', en: 'No fake perspective-only rotation' }, blocking: true },
  { id: 'same_mesh_all_views', label: { ar: 'الأمام والجانب والخلف نفس المجسم', en: 'Front/side/back are the SAME mesh' }, blocking: true },
  { id: 'fabric_change_keeps_realism', label: { ar: 'تغيير القماش لا يفسد الواقعية', en: 'Fabric changes do not destroy realism' }, blocking: true },
  { id: 'threads_independent', label: { ar: 'ألوان الخيوط مستقلة', en: 'Thread colours change independently' }, blocking: true },
  // Presentation, from docs/OMANI_MASTER_VISUAL_REFERENCE.md §6: an accurate
  // garment framed like a developer viewport still fails as a product.
  { id: 'studio_presentation', label: { ar: 'العرض استوديو: الثوب يملأ الإطار بلا واجهة تطوير', en: 'Studio presentation: garment fills the frame, no debug UI' }, blocking: true },
  // The master reference includes detail crops; the detail presets must hold
  // up at zoom — real edge thickness, no UV stretch, no visible seam.
  { id: 'detail_zoom_holds_up', label: { ar: 'التفاصيل تصمد عند التقريب', en: 'Detail views hold up at zoom' }, blocking: true },
];

export type AcceptanceResult = Partial<Record<AcceptanceCheckId, boolean>>;

export type AcceptanceVerdict = {
  accepted: boolean;
  passed: number;
  total: number;
  failing: AcceptanceCheckId[];
  unanswered: AcceptanceCheckId[];
};

/**
 * An unanswered check counts as NOT passed. Silence is not acceptance — that
 * is how an unreviewed asset would otherwise slip in front of a customer.
 */
export const evaluateAcceptance = (result: AcceptanceResult): AcceptanceVerdict => {
  const blocking = ACCEPTANCE_CHECKS.filter((c) => c.blocking);
  const failing: AcceptanceCheckId[] = [];
  const unanswered: AcceptanceCheckId[] = [];
  let passed = 0;

  for (const check of blocking) {
    const answer = result[check.id];
    if (answer === undefined) unanswered.push(check.id);
    else if (answer) passed += 1;
    else failing.push(check.id);
  }

  return {
    accepted: failing.length === 0 && unanswered.length === 0,
    passed,
    total: blocking.length,
    failing,
    unanswered,
  };
};

export const VISUAL_3D_STATUS = {
  NOT_ACCEPTED: 'NOT ACCEPTED',
  ACCEPTED: 'ACCEPTED',
} as const;
