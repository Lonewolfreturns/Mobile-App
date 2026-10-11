// Simulated chambers for demo mode. Nothing here touches the network — it
// lets someone without the hardware (a new operator, or an app-store
// reviewer) see every screen working.
import type { Reading } from './api';

type Sim = { uid: string; lid: 'open' | 'close'; log: 'log' | 'off'; cycle: number; co2: number; t0: number };
const sims: Record<string, Sim> = {};
const HEX = '0123456789ABCDEF';

const lastOctet = (ip: string) => parseInt(ip.split('.').pop() || '0', 10);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function sim(ip: string): Sim {
  if (!sims[ip]) {
    const n = lastOctet(ip);
    const h = (k: number) => HEX[(n * k) % 16] + HEX[(n * (k + 3) + 7) % 16];
    sims[ip] = {
      uid: `${h(3)}-${h(5)}-${h(11)}`,
      lid: n % 2 ? 'close' : 'open',
      log: n % 3 ? 'log' : 'off',
      cycle: 1 + (n % 7),
      co2: 420 + (n % 6) * 55,
      t0: Date.now(),
    };
  }
  return sims[ip];
}

/** Every fifth address plays a chamber that is switched off. */
async function reach(ip: string): Promise<Sim> {
  if (lastOctet(ip) % 5 === 0) {
    await wait(900);
    throw new Error('timed out');
  }
  await wait(120 + Math.random() * 260);
  return sim(ip);
}

export async function demoMonitor(ip: string): Promise<Reading> {
  const s = await reach(ip);
  // A shut lid traps soil gas so CO2 climbs; an open one airs it back out.
  s.co2 = s.lid === 'close' ? Math.min(1800, s.co2 + 6 + Math.random() * 14) : Math.max(415, s.co2 - (s.co2 - 415) * 0.35);
  const n = lastOctet(ip);
  const drift = Math.sin((Date.now() - s.t0) / 60000 + n);
  return {
    co2: s.co2 + Math.random() * 4,
    temp: 21 + (n % 5) * 0.6 + drift,
    humid: 55 + (n % 4) * 4 + drift * 3,
    uid: s.uid,
    lid: s.lid,
    log: s.log,
    cycle: s.cycle,
  };
}

export async function demoPost(ip: string, endpoint: string, params: Record<string, string>): Promise<string> {
  const s = await reach(ip);
  switch (endpoint) {
    case '/lid':
      s.lid = params.LidAction === 'open' ? 'open' : 'close';
      if (s.lid === 'close') s.cycle += 1;
      return `Lid ${s.lid === 'open' ? 'opened' : 'closed'}`;
    case '/logging':
      s.log = params.LoggingAction === 'start' ? 'log' : 'off';
      return s.log === 'log' ? 'Logging started' : 'Logging stopped';
    case '/config':
      return `Config saved: every ${params.LogInterval}s, open ${params.LidOpenT}s, shut ${params.LidCloseT}s`;
    case '/submit':
      return `Calibration applied: ${params.CalCO2} ppm`;
    case '/set_time':
      return 'Clock set';
    default:
      throw new Error('HTTP 404: Not found');
  }
}

export async function demoDownload(ip: string): Promise<{ offered: string; text: string }> {
  const s = await reach(ip);
  const rows = ['timestamp,co2_ppm,temperature_c,humidity_pct,lid,cycle'];
  const start = Date.now() - 30 * 30000;
  for (let i = 0; i < 30; i++) {
    const d = new Date(start + i * 30000).toISOString().replace('T', ' ').slice(0, 19);
    const shut = i % 10 >= 4;
    rows.push(
      `${d},${(430 + (shut ? (i % 10) * 38 : 0) + Math.random() * 6).toFixed(1)},` +
        `${(21.5 + Math.random()).toFixed(2)},${(58 + Math.random() * 4).toFixed(1)},${shut ? 'close' : 'open'},${s.cycle}`,
    );
  }
  return { offered: `${s.uid}_data.csv`, text: rows.join('\n') + '\n' };
}
