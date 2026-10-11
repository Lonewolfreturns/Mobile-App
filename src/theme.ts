import { Platform, useWindowDimensions } from 'react-native';

// Same dark industrial palette as the desktop dashboard.
export const C = {
  bg: '#0f1117',
  bar: '#080b12',
  panel: '#13161f',
  card: '#1a1d26',
  sunk: '#0d0f16',
  border: '#2a2d3a',
  borderHi: '#2e3248',
  text: '#e8eaf0',
  soft: '#c0c4d8',
  dim: '#7a7f9a',
  faint: '#4a4f6a',
  accent: '#00d4aa',
  green: '#00e676',
  greenDim: '#00a870',
  red: '#ff4444',
  redDim: '#cc3333',
  amber: '#c88a00',
  blue: '#4488cc',
  purple: '#9966cc',
};

export const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'Consolas, "Courier New", monospace',
});

// [background, pressed, border, foreground]
export const TONES = {
  green: ['#00351f', '#004d2e', '#00a870', '#00ffaa'],
  red: ['#3d0000', '#5c0000', '#cc2222', '#ff9999'],
  steel: ['#1a2230', '#243044', '#4a6182', '#a8c4e0'],
  blue: ['#002a42', '#003d5e', '#0078b4', '#66d4ff'],
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