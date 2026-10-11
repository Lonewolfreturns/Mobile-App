import { useEffect, useState } from 'react';

/** 5400 → '1 hour  30 minutes'. Only the two largest units are kept. */
export function humanizeSeconds(total: number): string {
  total = Math.trunc(total);
  if (!(total > 0)) return '';
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts: string[] = [];
  for (const [value, word] of [
    [days, 'day'],
    [hours, 'hour'],
    [mins, 'minute'],
    [secs, 'second'],
  ] as const) {
    if (value) parts.push(`${value} ${word}${value !== 1 ? 's' : ''}`);
  }
  return parts.slice(0, 2).join('  ');
}

/** A short, plain suggestion for a failed command — what to go and check. */
export function failureHint(body: string): string {
  const t = (body || '').toLowerCase();
  if (/\bsd\b/.test(t))
    return 'the SD card may be loose, full or unformatted — re-seat it and try again';
  if (t.includes('timed out') || t.includes('timeout'))
    return 'the chamber did not answer in time — it may be at the edge of WiFi range, try again';
  if (
    t.includes('network request failed') ||
    t.includes('failed to fetch') ||
    t.includes('unreachable') ||
    t.includes('refused') ||
    t.includes('not connect')
  )
    return 'cannot reach this chamber — check it is powered on and this phone is on the chamber WiFi';
  if (t.includes('not found') || t.includes('404'))
    return 'no data file on this chamber yet — press START RECORDING first, then copy the data';
  if (t.includes('missing') || t.includes('unknown') || t.includes('400') || t.startsWith('bad '))
    return 'the chamber refused that value — check the numbers and send it again';
  if (t.includes('500') || t.includes('internal'))
    return 'the chamber hit an internal error — try again, and power-cycle it if it repeats';
  return 'try again — if it keeps failing, power-cycle that chamber';
}

export const PLAIN_ENDPOINT: Record<string, string> = {
  '/lid': 'lid',
  '/logging': 'recording',
  '/config': 'timing',
  '/submit': 'calibration',
  '/set_time': 'clock',
  '/download': 'data copy',
};

const p2 = (n: number) => String(n).padStart(2, '0');

export function fmtTime(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

export function fmtDateTime(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}  ${fmtTime(d)}`;
}

/** Parses 'YYYY-MM-DD HH:MM:SS'; null if it is not a real date and time. */
export function parseDateTime(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m.slice(1).map((x) => (x ? parseInt(x, 10) : 0));
  const dt = new Date(y, mo - 1, d, h, mi, se);
  const real =
    dt.getFullYear() === y &&
    dt.getMonth() === mo - 1 &&
    dt.getDate() === d &&
    dt.getHours() === h &&
    dt.getMinutes() === mi &&
    dt.getSeconds() === se;
  return real ? dt : null;
}

/** The firmware's /set_time format: Y,M,D,h,m,s */
export function rtcTimestamp(d: Date): string {
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  ].join(',');
}

export function useNow(everyMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
