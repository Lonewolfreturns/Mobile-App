// HTTP protocol for ESP32 devices running WiFi_Function.ino.
// Wire format is identical to the desktop dashboard (v3.6):
//   GET  /monitor                                  → live sensor data
//   POST /submit   CalCO2, CalALT, CalTemp         → SCD30 calibration
//   POST /config   LogInterval, LidOpenT, LidCloseT → chamber config
//   POST /lid      LidAction (open|close)          → manual lid control
//   POST /logging  LoggingAction (start|stop)      → data logging control
//   GET  /download                                 → fetch /<UID>_data.csv
//   POST /set_time Timestamp                       → set RTC

export type Reading = {
  co2: number;
  temp: number;
  humid: number;
  uid: string;
  lid: string;
  log: string;
  cycle: number;
};

export function parseMonitor(body: string): Reading {
  const num = (re: RegExp) => {
    const m = body.match(re);
    return m ? parseFloat(m[1]) : 0;
  };
  const str = (re: RegExp, fallback = '') => {
    const m = body.match(re);
    return m ? m[1].trim() : fallback;
  };
  return {
    co2: num(/CO2\s*([\d.]+)ppm/),
    temp: num(/Temperature\s*([\d.]+)C/),
    humid: num(/Humidity\s*([\d.]+)%/),
    uid: str(/UID\s+([A-Fa-f0-9]{2}-[A-Fa-f0-9]{2}-[A-Fa-f0-9]{2})/),
    lid: str(/Lid\s+(open|closed|close)/, '—'),
    log: str(/Log\s+(off|log|on)/, '—'),
    cycle: Math.trunc(num(/Cycle\s+(\d+)/)),
  };
}

async function request(url: string, init: RequestInit, timeoutSec: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutSec * 1000);
  try {
    const resp = await fetch(url, { ...init, signal: ctl.signal });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${body.slice(0, 100) || resp.statusText}`);
    }
    return resp;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMonitor(ip: string, timeoutSec: number): Promise<Reading> {
  const resp = await request(`http://${ip}/monitor`, { method: 'GET' }, timeoutSec);
  return parseMonitor(await resp.text());
}

export async function postForm(
  ip: string,
  endpoint: string,
  params: Record<string, string>,
  timeoutSec: number,
): Promise<string> {
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const resp = await request(
    `http://${ip}${endpoint}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
    timeoutSec,
  );
  return resp.text();
}

export async function downloadCsv(
  ip: string,
  timeoutSec: number,
): Promise<{ filename: string; text: string }> {
  const resp = await request(`http://${ip}/download`, { method: 'GET' }, timeoutSec);
  const text = await resp.text();
  const cd = resp.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="(.+?)"/);
  const offered = m ? m[1] : `${ip.replace(/\./g, '_')}_data.csv`;

  // Stamp the source IP into the name — the device only offers
  // <UID>_data.csv, which says nothing about which chamber it came from.
  // Sanitised, because the name comes off the device and ends up in a path.
  const base = offered.split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[^0-9A-Za-z._-]/g, '_') || 'data';
  let suffix = dot > 0 ? base.slice(dot) : '.csv';
  if (!/^\.[0-9A-Za-z]{1,8}$/.test(suffix)) suffix = '.csv';
  const ipTag = ip.replace(/\./g, '-').replace(/[^0-9A-Za-z-]/g, '-');
  const filename = stem.includes(ipTag) ? `${stem}${suffix}` : `${stem}_${ipTag}${suffix}`;
  return { filename, text };
}
