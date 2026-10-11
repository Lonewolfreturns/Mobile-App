// HTTP protocol for ESP32 devices running WiFi_Function.ino.
// Wire format is identical to the desktop dashboard (v3.6):
//   GET  /monitor                                  → live sensor data
//   POST /submit   CalCO2, CalALT, CalTemp         → SCD30 calibration
//   POST /config   LogInterval, LidOpenT, LidCloseT → chamber config
//   POST /lid      LidAction (open|close)          → manual lid control
//   POST /logging  LoggingAction (start|stop)      → data logging control
//   GET  /download                                 → fetch /<UID>_data.csv
//   POST /set_time Timestamp                       → set RTC
import { demoDownload, demoMonitor, demoPost } from './demo';
import { assertLocal } from './net';

export type Reading = {
  co2: number;
  temp: number;
  humid: number;
  uid: string;
  lid: string;
  log: string;
  cycle: number;
};

// Nothing a chamber sends is trusted to be a sensible size.
const MAX_PAGE_BYTES = 64 * 1024;
const MAX_CSV_BYTES = 50 * 1024 * 1024;

let demo = false;
export function setDemoMode(on: boolean): void {
  demo = on;
}

export function parseMonitor(body: string): Reading {
  const num = (re: RegExp) => {
    const m = body.match(re);
    const v = m ? parseFloat(m[1]) : 0;
    return Number.isFinite(v) ? v : 0;
  };
  const str = (re: RegExp, fallback = '') => {
    const m = body.match(re);
    return m ? m[1].trim() : fallback;
  };
  return {
    co2: num(/CO2\s*([\d.]+)ppm/),
    temp: num(/Temperature\s*(-?[\d.]+)C/),
    humid: num(/Humidity\s*([\d.]+)%/),
    uid: str(/UID\s+([A-Fa-f0-9]{2}-[A-Fa-f0-9]{2}-[A-Fa-f0-9]{2})/),
    lid: str(/Lid\s+(open|closed|close)/, '—'),
    log: str(/Log\s+(off|log|on)/, '—'),
    cycle: Math.trunc(num(/Cycle\s+(\d+)/)),
  };
}

async function request(
  ip: string,
  path: string,
  init: RequestInit,
  timeoutSec: number,
  maxBytes: number,
): Promise<{ text: string; headers: Headers }> {
  assertLocal(ip);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutSec * 1000);
  try {
    const resp = await fetch(`http://${ip}${path}`, {
      ...init,
      signal: ctl.signal,
      // A chamber has no reason to send us anywhere else.
      redirect: 'error',
      credentials: 'omit',
    });
    // Not every platform honours redirect:'error', so check where we ended up.
    const landed = resp.url ? resp.url.match(/^https?:\/\/([^/:]+)/i)?.[1] : ip;
    if (landed && landed !== ip) throw new Error('blocked — the chamber tried to redirect the request');

    const declared = Number(resp.headers.get('Content-Length') || 0);
    if (declared > maxBytes) throw new Error('response too large');
    const text = await resp.text();
    if (text.length > maxBytes) throw new Error('response too large');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text.slice(0, 100) || resp.statusText}`);
    return { text, headers: resp.headers };
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMonitor(ip: string, timeoutSec: number): Promise<Reading> {
  if (demo) return demoMonitor(ip);
  const { text } = await request(ip, '/monitor', { method: 'GET' }, timeoutSec, MAX_PAGE_BYTES);
  return parseMonitor(text);
}

export async function postForm(
  ip: string,
  endpoint: string,
  params: Record<string, string>,
  timeoutSec: number,
): Promise<string> {
  if (demo) return demoPost(ip, endpoint, params);
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const { text } = await request(
    ip,
    endpoint,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
    timeoutSec,
    MAX_PAGE_BYTES,
  );
  return text;
}

/**
 * Builds the name a downloaded file is saved under. The device only offers
 * <UID>_data.csv, which says nothing about which chamber it came from, so the
 * source IP is stamped in. Sanitised hard, because the name comes off the
 * device and ends up in a path we write to.
 */
export function safeCsvName(offered: string, ip: string): string {
  const base = offered.split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  const stem =
    (dot > 0 ? base.slice(0, dot) : base)
      .replace(/[^0-9A-Za-z._-]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 60) || 'data';
  // Data files only — a chamber cannot plant a file of some other type.
  const suffix = /^\.(csv|txt)$/i.test(dot > 0 ? base.slice(dot) : '') ? base.slice(dot).toLowerCase() : '.csv';
  const ipTag = ip.replace(/\./g, '-').replace(/[^0-9A-Za-z-]/g, '-');
  return stem.includes(ipTag) ? `${stem}${suffix}` : `${stem}_${ipTag}${suffix}`;
}

export async function downloadCsv(
  ip: string,
  timeoutSec: number,
): Promise<{ filename: string; text: string }> {
  if (demo) {
    const d = await demoDownload(ip);
    return { filename: safeCsvName(`DEMO_${d.offered}`, ip), text: d.text };
  }
  const { text, headers } = await request(ip, '/download', { method: 'GET' }, timeoutSec, MAX_CSV_BYTES);
  const m = (headers.get('Content-Disposition') || '').match(/filename="(.+?)"/);
  const offered = m ? m[1] : `${ip.replace(/\./g, '_')}_data.csv`;
  return { filename: safeCsvName(offered, ip), text };
}
