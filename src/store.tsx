import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { downloadCsv, fetchMonitor, postForm, Reading } from './api';
import { listSaved, saveCsv, SavedFile } from './files';
import { failureHint, PLAIN_ENDPOINT } from './util';

export type Settings = {
  deviceBaseIp: string;
  deviceIpStart: number;
  numDevices: number;
  monitorInterval: number;
  httpTimeout: number;
};

export const DEFAULT_SETTINGS: Settings = {
  deviceBaseIp: '192.168.8.',
  deviceIpStart: 101,
  numDevices: 16,
  monitorInterval: 5,
  httpTimeout: 4,
};

export type DevStatus = 'waiting' | 'scanning' | 'online' | 'offline';
export type Device = {
  ip: string;
  id: string;
  status: DevStatus;
  uid: string;
  reading?: Reading;
  lastOk?: number;
};

export type LogKind = 'ok' | 'err' | 'info' | 'poll' | 'scan' | 'sent' | 'hint';
export type LogLine = { key: number; ts: Date; kind: LogKind; text: string };

type Store = {
  settings: Settings;
  applySettings: (s: Settings) => void;
  devices: Device[];
  onlineIps: string[];
  scanning: boolean;
  scan: () => void;
  busy: boolean;
  broadcast: (endpoint: string, params: Record<string, string>) => Promise<void>;
  downloadAll: () => Promise<void>;
  sysLog: LogLine[];
  clearSysLog: () => void;
  actionLog: LogLine[];
  clearActionLog: () => void;
  files: SavedFile[];
  refreshFiles: () => void;
};

const Ctx = createContext<Store | null>(null);
const SETTINGS_KEY = 'fch.settings';
const LOG_CAP = 400;
let lineKey = 0;

function buildDevices(s: Settings, prev: Record<string, Device>): Record<string, Device> {
  const out: Record<string, Device> = {};
  for (let i = 0; i < s.numDevices; i++) {
    const ip = s.deviceBaseIp + (s.deviceIpStart + i);
    out[ip] = { ip, id: `ESP-${s.deviceIpStart + i}`, status: 'waiting', uid: prev[ip]?.uid ?? '' };
  }
  return out;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [devMap, setDevMap] = useState<Record<string, Device>>(() => buildDevices(DEFAULT_SETTINGS, {}));
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sysLog, setSysLog] = useState<LogLine[]>([]);
  const [actionLog, setActionLog] = useState<LogLine[]>([]);
  const [files, setFiles] = useState<SavedFile[]>([]);

  const settingsRef = useRef(settings);
  const devRef = useRef(devMap);
  // Bumped whenever the device list is rebuilt, so answers that were already
  // in flight for the old list are dropped instead of resurrecting old tiles.
  const gen = useRef(0);
  const polling = useRef(false);
  const busyRef = useRef(false);
  devRef.current = devMap;
  settingsRef.current = settings;

  const push = (set: typeof setSysLog) => (kind: LogKind, text: string) =>
    set((l) => [{ key: ++lineKey, ts: new Date(), kind, text }, ...l].slice(0, LOG_CAP));
  const sys = useMemo(() => push(setSysLog), []);
  const act = useMemo(() => push(setActionLog), []);

  const patch = useCallback((ip: string, p: Partial<Device>) => {
    setDevMap((m) => (m[ip] ? { ...m, [ip]: { ...m[ip], ...p } } : m));
  }, []);

  const refreshFiles = useCallback(() => {
    try {
      setFiles(listSaved());
    } catch (e: any) {
      sys('err', `[FILE] Could not list saved files — ${e?.message ?? e}`);
    }
  }, [sys]);

  useEffect(() => {
    refreshFiles();
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (!raw) return;
        const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
        gen.current++;
        setSettings(s);
        setDevMap((m) => buildDevices(s, m));
      })
      .catch(() => {});
  }, [refreshFiles]);

  const applySettings = useCallback(
    (s: Settings) => {
      gen.current++;
      setSettings(s);
      setDevMap((m) => buildDevices(s, m));
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s)).catch(() => {});
      sys('info', '[SETTINGS] Settings saved — scan again to find the chambers');
    },
    [sys],
  );

  const probe = useCallback(
    async (ip: string, g: number, tag: 'SCAN' | 'MONITOR') => {
      try {
        const r = await fetchMonitor(ip, settingsRef.current.httpTimeout);
        if (g !== gen.current) return;
        const prev = devRef.current[ip];
        patch(ip, { status: 'online', reading: r, lastOk: Date.now(), uid: r.uid || prev?.uid || '' });
        if (tag === 'SCAN') sys('scan', `[SCAN] ✓ ${ip}  ONLINE`);
        else
          sys(
            'poll',
            `[MONITOR] ${ip}  UID=${r.uid}  CO2=${r.co2.toFixed(0)}ppm  T=${r.temp.toFixed(1)}°C  ` +
              `RH=${r.humid.toFixed(0)}%  Lid=${r.lid}  Log=${r.log}  Cycle=${r.cycle}`,
          );
      } catch {
        if (g !== gen.current) return;
        patch(ip, { status: 'offline' });
        sys(tag === 'SCAN' ? 'scan' : 'err', `[${tag}] ✗ ${ip}  offline`);
      }
    },
    [patch, sys],
  );

  const scan = useCallback(() => {
    if (scanning) return;
    const g = gen.current;
    const ips = Object.keys(devRef.current);
    setScanning(true);
    setDevMap((m) => {
      const out: Record<string, Device> = {};
      for (const ip of Object.keys(m)) out[ip] = { ...m[ip], status: 'scanning' };
      return out;
    });
    Promise.all(ips.map((ip) => probe(ip, g, 'SCAN'))).finally(() => setScanning(false));
  }, [scanning, probe]);

  // Poll the chambers that are online. One that stops answering drops to
  // offline and is picked up again by the next scan, as on the desktop.
  useEffect(() => {
    const t = setInterval(async () => {
      if (polling.current) return;
      const ips = Object.values(devRef.current)
        .filter((d) => d.status === 'online')
        .map((d) => d.ip);
      if (!ips.length) return;
      polling.current = true;
      const g = gen.current;
      try {
        await Promise.all(ips.map((ip) => probe(ip, g, 'MONITOR')));
      } finally {
        polling.current = false;
      }
    }, Math.max(1, settings.monitorInterval) * 1000);
    return () => clearInterval(t);
  }, [settings.monitorInterval, probe]);

  const devices = useMemo(() => Object.values(devMap), [devMap]);
  const onlineIps = useMemo(() => devices.filter((d) => d.status === 'online').map((d) => d.ip), [devices]);

  // Commands go out one chamber at a time, in order, like the desktop's
  // single HTTP queue — so sixteen lid motors never start in the same instant.
  const runAll = useCallback(
    async (endpoint: string, each: (ip: string) => Promise<string>) => {
      if (busyRef.current) return;
      const ips = Object.values(devRef.current)
        .filter((d) => d.status === 'online')
        .map((d) => d.ip);
      if (!ips.length) return;
      busyRef.current = true;
      setBusy(true);
      const what = PLAIN_ENDPOINT[endpoint] ?? endpoint;
      act('sent', `→  ${what}  —  sent to ${ips.length} chamber${ips.length !== 1 ? 's' : ''}`);
      try {
        for (const ip of ips) {
          try {
            const body = await each(ip);
            act('ok', `✓  ${ip}  —  ${what}  —  ${body.slice(0, 140)}`);
            sys('ok', `[HTTP ✓] ${ip}${endpoint}  → ${body.slice(0, 120)}`);
          } catch (e: any) {
            const msg = String(e?.message ?? e);
            // The log reads newest-first, so the hint goes in first to land
            // underneath the failure it explains.
            act('hint', `↳  ${failureHint(msg)}`);
            act('err', `✗  ${ip}  —  ${what}  —  ${msg.slice(0, 140)}`);
            sys('err', `[HTTP ✗] ${ip}${endpoint}  — ${msg}`);
          }
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [act, sys],
  );

  const broadcast = useCallback(
    (endpoint: string, params: Record<string, string>) =>
      runAll(endpoint, (ip) => postForm(ip, endpoint, params, settingsRef.current.httpTimeout)),
    [runAll],
  );

  const downloadAll = useCallback(async () => {
    await runAll('/download', async (ip) => {
      // A whole data file takes longer than a status page; give it more room.
      const { filename, text } = await downloadCsv(ip, Math.max(30, settingsRef.current.httpTimeout));
      saveCsv(filename, text);
      return `Saved → ${filename}  (${text.length.toLocaleString()} B)`;
    });
    refreshFiles();
  }, [runAll, refreshFiles]);

  const value: Store = {
    settings,
    applySettings,
    devices,
    onlineIps,
    scanning,
    scan,
    busy,
    broadcast,
    downloadAll,
    sysLog,
    clearSysLog: useCallback(() => setSysLog([]), []),
    actionLog,
    clearActionLog: useCallback(() => setActionLog([]), []),
    files,
    refreshFiles,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
