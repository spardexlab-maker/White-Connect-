/**
 * Design tokens — single source of truth (see docs/DESIGN_SYSTEM.md).
 * apps/web/src/styles/tokens.css mirrors these values as CSS variables;
 * `pnpm --filter @app/shared test` verifies the WCAG contrast pairs.
 */
export const color = {
  primary: '#123B5D',
  primaryHover: '#0B2A43',
  accent: '#0F766E',
  accentSoft: '#E6F4F1',
  canvas: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSunken: '#EEF2F6',
  text: '#152536',
  mutedText: '#526171',
  border: '#DCE3EB',
  borderStrong: '#B8C4D1',
  success: '#166534',
  successSoft: '#E8F5EC',
  warningText: '#92400E',
  warningSoft: '#FDF3E2',
  danger: '#B91C1C',
  dangerSoft: '#FCECEC',
  information: '#1D4ED8',
  informationSoft: '#EAF0FD',
  focus: '#1D4ED8',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const radius = { sm: 8, md: 10, lg: 14, pill: 999 } as const;
export const font = {
  family: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
  size: { label: 13, small: 14, body: 15, bodyLg: 16, h3: 20, h2: 24, h1: 32 },
  lineHeight: { body: 1.7, heading: 1.35 },
} as const;
export const motion = { fast: 120, base: 160, slow: 200 } as const;

/** Contrast pairs that must reach WCAG AA (4.5:1 normal text). */
export const contrastPairs: [fg: keyof typeof color, bg: keyof typeof color][] = [
  ['text', 'canvas'], ['text', 'surface'], ['mutedText', 'surface'], ['mutedText', 'canvas'],
  ['surface', 'primary'], ['surface', 'primaryHover'], ['surface', 'accent'], ['accent', 'accentSoft'],
  ['accent', 'surface'], ['primary', 'surface'],
  ['success', 'successSoft'], ['warningText', 'warningSoft'], ['danger', 'dangerSoft'],
  ['information', 'informationSoft'], ['danger', 'surface'], ['surface', 'danger'],
];

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
