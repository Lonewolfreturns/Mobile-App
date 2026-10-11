import { Platform, useWindowDimensions } from 'react-native';

// Dark field theme built on the IWM brand: navy ground, leaf-green accent,
// gold for emphasis. Kept dark so the screen stays readable outdoors and
// easy on the battery.
export const C = {
  bg: '#0a1020',
  bar: '#070c18',
  panel: '#0f172b',
  card: '#16203a',
  sunk: '#080d1a',
  border: '#22304f',
  borderHi: '#2c3d63',
  text: '#eaeef7',
  soft: '#c3cbe0',
  dim: '#8c98b6',
  faint: '#6a7696',
  accent: '#6cc24a',
  accentSoft: '#6cc24a22',
  gold: '#d9a441',
  navy: '#0d2a5c',
  green: '#3ddc84',
  greenDim: '#2fae66',
  red: '#ff5a5a',
  redDim: '#e05050',
  amber: '#e0a030',
  blue: '#5aa9ff',
  purple: '#a98bea',
  co2: '#5aa9ff',
  temp: '#f08a5d',
  humid: '#4fd1a5',
};

// Numbers, IDs and log lines stay monospaced so columns line up; everything
// else uses the phone's own font.
export const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'Consolas, "Courier New", monospace',
});

// [background, pressed, border, foreground]
export const TONES = {
  green: ['#0c3320', '#12482d', '#2fae66', '#7dffb5'],
  red: ['#3a0d10', '#551419', '#d64545', '#ffaaaa'],
  steel: ['#18233a', '#22314f', '#4f6a96', '#b4cdee'],
  blue: ['#0c2747', '#123763', '#2f7fd6', '#8cc4ff'],
} as const;
export type Tone = keyof typeof TONES;

// Content wider than this gets the two-column / side-rail tablet layouts.
export const TABLET_MIN = 700;
export const RAIL_MIN = 900;
export const RAIL_W = 104;

/** True when the content area (window minus the side rail) fits two columns. */
export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return width - (width >= RAIL_MIN ? RAIL_W : 0) >= TABLET_MIN;
}

// Animations run on the native thread where there is one.
export const NATIVE_DRIVER = Platform.OS !== 'web';
