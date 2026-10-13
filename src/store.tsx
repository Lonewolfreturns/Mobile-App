import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { downloadCsv, fetchMonitor, postForm, Reading, setDemoMode } from './api';
import {
  chooseFolder,
  forgetFolder,
  listSaved,
  loadSaveLocation,
  moveSavedToFolder,
  saveCsv,
  SavedFile,
  saveLocation,
  SaveLocation,
} from './files';
import { buzzFail, buzzOk, buzzWarn } from './haptics';
import { isLocalBase } from './net';
import { failureHint, PLAIN_ENDPOINT } from './util';

export type Settings = {
  deviceBaseIp: string;
  deviceIpStart: number;
  numDevices: number;
  monitorInterval: number;
  httpTimeout: number;
  demoMode: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  deviceBaseIp: '192.168.8.',
  deviceIpStart: 101,
  numDevices: 16,
  monitorInterval: 5,
  httpTimeout: 4,
  demoMode: false,
};

export const LIMITS = {
  numDevices: [1, 100],
  deviceIpStart: [1, 254],
  monitorInterval: [1, 300],
  httpTimeout: [1, 30],
} as const;

/**
 * Whatever comes back from storage is treated as untrusted: every field is
 * type- and range-checked, and anything off falls back to its default.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const int = (k: keyof typeof LIMITS): number => {
    const v = r[k];
    const [lo, hi] = LIMITS[k];
    return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : DEFAULT_SETTINGS[k];
  };
  const base = typeof r.deviceBaseIp === 'string' && isLocalBase(r.deviceBaseIp) ? r.deviceBaseIp : DEFAULT_SETTINGS.deviceBaseIp;
  const start = int('deviceIpStart');
  return {
    deviceBaseIp: base,
    deviceIpStart: start,
    numDevices: Math.min(int('numDevices'), 255 - start),
    monitorInterval: int('monitorInterval'),
    httpTimeout: int('httpTimeout'),
    demoMode: r.demoMode === true,
  };
}

export type DevStatus = 'waiting' | 'scanning' | 'online' | 'offline';
export type Device = {
  ip: string;
  id: string;
  status: DevStatus;
  uid: string;
  reading?: Reading;
  lastOk?: number;
  /** Recent CO2 readings, oldest first — the little trend chart. */
  trend: number[];
};
const TREND_LEN = 40;

export type LogKind = 'ok' | 'err' | 'info' | 'poll' | 'scan' | 'sent' | 'hint';
export type LogLine = { key: number; ts: Date; kind: LogKind; text: string };
export type Progress = { label: string; done: number; total: number };
export type Toast = { key: number; kind: 'ok' | 'warn' | 'err'; text: string };

type Store = {
  ready: boolean;
  settings: Settings;
  applySettings: (s: Settings) => void;
  devices: Device[];
  onlineIps: string[];
  scanning: boolean;
  scan: () => void;
  retry: (ip: string) => void;
  busy: boolean;
  progress: Progress | null;
  broadcast: (endpoint: string, params: Record<string, string>, only?: string[]) => Promise<void>;
  downloadAll: (only?: string[]) => Promise<void>;
  sysLog: LogLine[];
  clearSysLog: () => void;
  actionLog: LogLine[];
  clearActionLog: () => void;
  files: SavedFile[];
  refreshFiles: () => void;
  /** Where COPY THE DATA puts files right now. */
  saveLoc: SaveLocation;
  chooseSaveFolder: () => Promise<void>;
  keepFilesInApp: () => void;
  moveFilesToFolder: () => void;
  toast: Toast | null;
  dismissToast: () => void;
  /** The chamber whose detail sheet is open, if any. */
  selectedIp: string | null;
  select: (ip: string | null) => void;
  setDemo: (on: boolean) => void;
};

const Ctx = createContext<Store | null>(null);
const SETTINGS_KEY = 'fch.settings';
const LOG_CAP = 400;
let lineKey = 0;

function buildDevices(s: Settings, prev: Record<string, Device>): Record<string, Device> {
  const out: Record<string, Device> = {};
  for (let i = 0; i < s.numDevices; i++) {
    const ip = s.deviceBaseIp + (s.deviceIpStart + i);
    out[ip] = { ip, id: `ESP-${s.deviceIpStart + i}`, status: 'waiting', uid: prev[ip]?.uid ?? '', trend: [] };
  }
  return out;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [devMap, setDevMap] = useState<Record<string, Device>>(() => buildDevices(DEFAULT_SETTINGS, {}));
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [sysLog, setSysLog] = useState<LogLine[]>([]);
  const [actionLog, setActionLog] = useState<LogLine[]>([]);
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [saveLoc, setSaveLoc] = useState<SaveLocation>(saveLocation);
  const [toast, setToast] = useState<Toast | null>(null);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const devRef = useRef(devMap);
  // Bumped whenever the device list is rebuilt, so answers that were already
  // in flight for the old list are dropped instead of resurrecting old tiles.
  const gen = useRef(0);
  const polling = useRef(false);
  const busyRef = useRef(false);
  // Generation of the scan that is running, or -1 when none is.
  const scanRef = useRef(-1);
  devRef.current = devMap;
  settingsRef.current = settings;

  const push = (set: typeof setSysLog) => (kind: LogKind, text: string) =>
    set((l) => [{ key: ++lineKey, ts: new Date(), kind, text }, ...l].slice(0, LOG_CAP));
  const sys = useMemo(() => push(setSysLog), []);
  const act = useMemo(() => push(setActionLog), []);
  const say = useCallback((kind: Toast['kind'], text: string) => setToast({ key: ++lineKey, kind, text }), []);

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

  const adopt = useCallback((s: Settings) => {
    gen.current++;
    // Remembered UIDs belong to whichever world they were read in; switching
    // between real and simulated chambers starts with a clean slate.
    const keepUids = s.demoMode === settingsRef.current.demoMode;
    setDemoMode(s.demoMode);
    setSettings(s);
    // Updated here as well as on render, so a scan can start straight away.
    devRef.current = buildDevices(s, keepUids ? devRef.current : {});
    settingsRef.current = s;
    setDevMap(devRef.current);
  }, []);

  useEffect(() => {
    refreshFiles();
    loadSaveLocation().then(() => setSaveLoc(saveLocation()));
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (raw) adopt(sanitizeSettings(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [refreshFiles, adopt]);

  const applySettings = useCallback(
    (next: Settings) => {
      const s = sanitizeSettings(next);
      adopt(s);
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s)).catch(() => {});
      sys('info', `[SETTINGS] Saved${s.demoMode ? ' — DEMO MODE, chambers are simulated' : ''}`);
    },
    [adopt, sys],
  );

  const probe = useCallback(
    async (ip: string, g: number, tag: 'SCAN' | 'MONITOR'): Promise<boolean> => {
      try {
        const r = await fetchMonitor(ip, settingsRef.current.httpTimeout);
        if (g !== gen.current) return false;
        setDevMap((m) => {
          const d = m[ip];
          if (!d) return m;
          return {
            ...m,
            [ip]: {
              ...d,
              status: 'online',
              reading: r,
              lastOk: Date.now(),
              uid: r.uid || d.uid,
              trend: [...d.trend, r.co2].slice(-TREND_LEN),
            },
          };
        });
        if (tag === 'SCAN') sys('scan', `[SCAN] ✓ ${ip}  ONLINE`);
        else
          sys(
            'poll',
            `[MONITOR] ${ip}  UID=${r.uid}  CO2=${r.co2.toFixed(0)}ppm  T=${r.temp.toFixed(1)}°C  ` +
              `RH=${r.humid.toFixed(0)}%  Lid=${r.lid}  Log=${r.log}  Cycle=${r.cycle}`,
          );
        return true;
      } catch (e: any) {
        if (g !== gen.current) return false;
        patch(ip, { status: 'offline' });
        sys(tag === 'SCAN' ? 'scan' : 'err', `[${tag}] ✗ ${ip}  offline  (${String(e?.message ?? e).slice(0, 60)})`);
        return false;
      }
    },
    [patch, sys],
  );

  const scan = useCallback(() => {
    if (scanRef.current === gen.current || busyRef.current) return;
    const g = gen.current;
    scanRef.current = g;
    const ips = Object.keys(devRef.current);
    let done = 0;
    let found = 0;
    setScanning(true);
    setProgress({ label: 'Looking for chambers', done: 0, total: ips.length });
    setDevMap((m) => {
      const out: Record<string, Device> = {};
      for (const ip of Object.keys(m)) out[ip] = { ...m[ip], status: 'scanning' };
      return out;
    });
    Promise.all(
      ips.map(async (ip) => {
        if (await probe(ip, g, 'SCAN')) found++;
        done++;
        if (g === gen.current) setProgress({ label: 'Looking for chambers', done, total: ips.length });
      }),
    ).finally(() => {
      // A newer scan (after a settings change) owns the spinner now.
      if (scanRef.current !== g) return;
      scanRef.current = -1;
      setScanning(false);
      setProgress(null);
      if (g !== gen.current) return;
      if (found > 0) {
        buzzOk();
        say('ok', `Found ${found} of ${ips.length} chamber${ips.length !== 1 ? 's' : ''}`);
      } else {
        buzzWarn();
        say('warn', 'No chambers answered — is this device on the chamber WiFi?');
      }
    });
  }, [probe, say]);

  const setDemo = useCallback(
    (on: boolean) => {
      setSelectedIp(null);
      applySettings({ ...settingsRef.current, demoMode: on });
      // Simulated chambers are found straight away so there is something to see.
      if (on) scan();
    },
    [applySettings, scan],
  );

  const retry = useCallback(
    (ip: string) => {
      if (scanRef.current === gen.current || !devRef.current[ip]) return;
      const g = gen.current;
      patch(ip, { status: 'scanning' });
      probe(ip, g, 'SCAN').then((ok) => {
        if (g !== gen.current) return;
        if (ok) buzzOk();
        say(ok ? 'ok' : 'warn', ok ? `${ip} is back online` : `${ip} still not answering`);
      });
    },
    [patch, probe, say],
  );

  // Poll the chambers that are online. One that stops answering drops to
  // offline and is picked up again by the next scan, as on the desktop.
  // Nothing is polled while the app is in the background.
  useEffect(() => {
    const t = setInterval(async () => {
      if (polling.current || AppState.currentState !== 'active') return;
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
    async (endpoint: string, each: (ip: string) => Promise<string>, only?: string[]) => {
      if (busyRef.current) return;
      const ips = Object.values(devRef.current)
        .filter((d) => d.status === 'online' && (!only || only.includes(d.ip)))
        .map((d) => d.ip);
      if (!ips.length) return;
      busyRef.current = true;
      setBusy(true);
      const what = PLAIN_ENDPOINT[endpoint] ?? endpoint;
      const label = `Sending ${what}`;
      let failed = 0;
      setProgress({ label, done: 0, total: ips.length });
      act('sent', `→  ${what}  —  sent to ${ips.length} chamber${ips.length !== 1 ? 's' : ''}`);
      try {
        for (let i = 0; i < ips.length; i++) {
          const ip = ips[i];
          try {
            const body = await each(ip);
            act('ok', `✓  ${ip}  —  ${what}  —  ${body.slice(0, 140)}`);
            sys('ok', `[HTTP ✓] ${ip}${endpoint}  → ${body.slice(0, 120)}`);
          } catch (e: any) {
            failed++;
            const msg = String(e?.message ?? e);
            // The log reads newest-first, so the hint goes in first to land
            // underneath the failure it explains.
            act('hint', `↳  ${failureHint(msg)}`);
            act('err', `✗  ${ip}  —  ${what}  —  ${msg.slice(0, 140)}`);
            sys('err', `[HTTP ✗] ${ip}${endpoint}  — ${msg}`);
          }
          setProgress({ label, done: i + 1, total: ips.length });
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
        setProgress(null);
      }
      const ok = ips.length - failed;
      if (failed === 0) {
        buzzOk();
        say('ok', `${what} — ${ips.length === 1 ? ips[0] : `all ${ok} chambers`} answered OK`);
      } else {
        buzzFail();
        say(ok ? 'warn' : 'err', `${what} — ${ok} OK, ${failed} failed. See “What happened”.`);
      }
    },
    [act, sys, say],
  );

  const broadcast = useCallback(
    (endpoint: string, params: Record<string, string>, only?: string[]) =>
      runAll(endpoint, (ip) => postForm(ip, endpoint, params, settingsRef.current.httpTimeout), only),
    [runAll],
  );

  const downloadAll = useCallback(
    async (only?: string[]) => {
      let fellBack = false;
      await runAll(
        '/download',
        async (ip) => {
          // A whole data file takes longer than a status page; give it more room.
          const { filename, text } = await downloadCsv(ip, Math.max(30, settingsRef.current.httpTimeout));
          const saved = saveCsv(filename, text);
          if (saved.warning) fellBack = true;
          return (
            `Saved → ${saved.where} › ${filename}  (${text.length.toLocaleString()} B)` +
            (saved.warning ? `  ⚠ ${saved.warning}` : '')
          );
        },
        only,
      );
      refreshFiles();
      if (fellBack) {
        buzzWarn();
        say('warn', 'Your folder could not be written to, so the files were kept inside the app. Choose the folder again.');
      }
    },
    [runAll, refreshFiles, say],
  );

  const chooseSaveFolder = useCallback(async () => {
    try {
      if (!(await chooseFolder())) return;
      const loc = saveLocation();
      setSaveLoc(loc);
      buzzOk();
      say('ok', `Data will be saved in ${loc.label}`);
      sys('info', `[FILE] Save folder set to ${loc.label}`);
    } catch (e: any) {
      buzzFail();
      say('err', `That folder cannot be used — ${String(e?.message ?? e).slice(0, 90)}`);
    }
  }, [say, sys]);

  const keepFilesInApp = useCallback(() => {
    forgetFolder();
    setSaveLoc(saveLocation());
    sys('info', '[FILE] Save folder cleared — files are kept inside the app');
  }, [sys]);

  const moveFilesToFolder = useCallback(() => {
    try {
      const n = moveSavedToFolder();
      buzzOk();
      say('ok', `Moved ${n} file${n !== 1 ? 's' : ''} into your folder`);
    } catch (e: any) {
      buzzFail();
      say('err', `Could not move the files — ${String(e?.message ?? e).slice(0, 90)}`);
    }
    refreshFiles();
  }, [say, refreshFiles]);

  const value: Store = {
    ready,
    settings,
    applySettings,
    devices,
    onlineIps,
    scanning,
    scan,
    retry,
    busy,
    progress,
    broadcast,
    downloadAll,
    sysLog,
    clearSysLog: useCallback(() => setSysLog([]), []),
    actionLog,
    clearActionLog: useCallback(() => setActionLog([]), []),
    files,
    refreshFiles,
    saveLoc,
    chooseSaveFolder,
    keepFilesInApp,
    moveFilesToFolder,
    toast,
    dismissToast: useCallback(() => setToast(null), []),
    selectedIp,
    select: setSelectedIp,
    setDemo,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
