// The app only ever talks to devices on the local network. These checks are
// what makes that true rather than just intended: every request goes through
// assertLocal(), so a mistyped or tampered address can never send a command
// (or pull a file) from somewhere on the internet.

function octets(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}

/** RFC 1918 private ranges plus link-local. Loopback only while developing. */
export function isLocalAddress(ip: string): boolean {
  const o = octets(ip);
  if (!o) return false;
  const [a, b] = o;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 127) return __DEV__;
  return false;
}

/** Checks a base such as '192.168.8.' — the first three numbers of the range. */
export function isLocalBase(base: string): boolean {
  return /^(\d{1,3}\.){3}$/.test(base) && isLocalAddress(base + '1');
}

export function assertLocal(ip: string): void {
  if (!isLocalAddress(ip)) throw new Error(`blocked — ${ip} is not a local network address`);
}
