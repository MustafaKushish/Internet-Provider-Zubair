import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_UI_SCALE, UI_SCALES, applyUiScale, loadUiScale, saveUiScale } from '../uiScale';

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
  (globalThis as any).document = { documentElement: { style: { fontSize: '' } } };
});

describe('ui scale', () => {
  it('defaults to the normal step and ignores unknown values', () => {
    expect(loadUiScale()).toBe(DEFAULT_UI_SCALE);
    store.sas_plus_ui_scale_v1 = 'huge';
    expect(loadUiScale()).toBe(DEFAULT_UI_SCALE);
  });
  it('saves and applies the root font size', () => {
    saveUiScale('xl');
    expect(loadUiScale()).toBe('xl');
    expect(document.documentElement.style.fontSize).toBe('131.25%');
    applyUiScale('sm');
    expect(document.documentElement.style.fontSize).toBe('100%');
    expect(UI_SCALES.map(s => s.percent)).toEqual([100, 106.25, 118.75, 131.25]);
  });
});
