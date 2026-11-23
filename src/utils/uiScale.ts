/**
 * حجم الخط والعناصر لكل جهاز: كل أحجام الواجهة بوحدة rem، فتغيير حجم الجذر يكبّر الخط والأزرار والمسافات معاً.
 * يُطبَّق قبل رسم الواجهة (main.tsx) حتى لا تقفز الصفحة.
 */
export const UI_SCALES = [
  { id: 'sm', label: 'صغير', percent: 100 },
  { id: 'md', label: 'عادي', percent: 106.25 },
  { id: 'lg', label: 'كبير', percent: 118.75 },
  { id: 'xl', label: 'كبير جداً', percent: 131.25 },
] as const;

export type UiScaleId = (typeof UI_SCALES)[number]['id'];
export const DEFAULT_UI_SCALE: UiScaleId = 'md';
const KEY = 'sas_plus_ui_scale_v1';

export function loadUiScale(): UiScaleId {
  try {
    const v = localStorage.getItem(KEY);
    if (UI_SCALES.some(s => s.id === v)) return v as UiScaleId;
  } catch { /* التخزين غير متاح */ }
  return DEFAULT_UI_SCALE;
}

export function applyUiScale(id: UiScaleId): void {
  const s = UI_SCALES.find(x => x.id === id) ?? UI_SCALES[1];
  document.documentElement.style.fontSize = `${s.percent}%`;
}

export function saveUiScale(id: UiScaleId): void {
  try { localStorage.setItem(KEY, id); } catch { /* ممتلئ */ }
  applyUiScale(id);
}
