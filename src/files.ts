// Where COPY THE DATA puts the CSVs.
//
// Android: a folder the operator picks once in the system file picker (for
// example Documents). The app makes "Flux Chamber Hub" inside it and a
// sub-folder per download day, so the files show up in any file manager:
//     Documents / Flux Chamber Hub / 2026-10-13 / D9-ED-84_data_192-168-8-101.csv
// Android only lets an app write to shared storage this way — through a
// folder the user handed over — so no storage permission is needed.
//
// iOS: the app's own Documents folder, which the Files app shows under
// "On My iPhone", with the same per-day sub-folders.
//
// Until a folder is picked (or if writing to it fails) files are kept inside
// the app, where the in-app list can still share them out.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SavedFile = { name: string; uri: string; size: number; modified: number; day: string };
export type SaveLocation = { kind: 'folder' | 'app' | 'files-app' | 'browser'; label: string };
export type SaveResult = { where: string; warning?: string };

export const APP_FOLDER = 'Flux Chamber Hub';
const INTERNAL = 'received_data';
const KEY = 'fch.saveFolder';
const REMEMBER_DAYS = 60;
// Opens the picker on Documents, which Android allows apps to be given.
const DOCUMENTS_HINT = 'content://com.android.externalstorage.documents/document/primary%3ADocuments';
const isWeb = Platform.OS === 'web';
export const canChooseFolder = Platform.OS === 'android';

type Chosen = {
  /** The folder the operator picked — the one we hold permission for. */
  treeUri: string;
  /** "Flux Chamber Hub" inside it (or the picked folder itself if it has that name). */
  rootUri: string;
  label: string;
  /** Day folders we created, by date. Some storage providers give folders
   *  opaque addresses that cannot be found again by name. */
  days: Record<string, string>;
};
let chosen: Chosen | null = null;

/** 2026-10-13 — the phone's own date, used as the sub-folder name. */
export function dayStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The last folder or file name in an address, whichever kind of address it is. */
export function leafName(uri: string): string {
  const path = uri.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {}
  const leaf = decoded.replace(/\/+$/, '').split('/').pop() || '';
  return leaf.split(':').pop() || leaf;
}

/** Turns a picked folder's address into words: "Internal storage › Documents". */
export function describeTree(uri: string): string {
  const m = uri.match(/^content:\/\/com\.android\.externalstorage\.documents\/tree\/([^/]+)/);
  if (!m) return 'The folder you chose';
  let id = m[1];
  try {
    id = decodeURIComponent(id);
  } catch {}
  const colon = id.indexOf(':');
  const volume = colon < 0 ? id : id.slice(0, colon);
  const parts = (colon < 0 ? '' : id.slice(colon + 1)).split('/').filter(Boolean);
  return [volume === 'primary' ? 'Internal storage' : 'SD card', ...parts].join(' › ');
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const asDir = (x: unknown) => (x instanceof Directory ? x : undefined);
const reason = (e: unknown) => String((e as any)?.message ?? e).slice(0, 120);

function findChild(dir: Directory, name: string): Directory | File | undefined {
  return dir.list().find((x) => sameName(leafName(x.uri), name));
}

function persist(): void {
  const job = chosen ? AsyncStorage.setItem(KEY, JSON.stringify(chosen)) : AsyncStorage.removeItem(KEY);
  job.catch(() => {});
}

/** Reads back the folder picked in an earlier session. Call once at start-up. */
export async function loadSaveLocation(): Promise<void> {
  if (!canChooseFolder) return;
  try {
    const r = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
    const ok =
      r &&
      typeof r.treeUri === 'string' &&
      r.treeUri.startsWith('content://') &&
      typeof r.rootUri === 'string' &&
      r.rootUri.startsWith('content://');
    if (!ok) return;
    const days: Record<string, string> = {};
    if (r.days && typeof r.days === 'object')
      for (const [k, v] of Object.entries(r.days))
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'string' && v.startsWith('content://')) days[k] = v;
    chosen = { treeUri: r.treeUri, rootUri: r.rootUri, label: String(r.label || 'The folder you chose').slice(0, 200), days };
  } catch {
    chosen = null;
  }
}

export function saveLocation(): SaveLocation {
  if (isWeb) return { kind: 'browser', label: "This browser's downloads" };
  if (chosen) return { kind: 'folder', label: chosen.label };
  if (Platform.OS === 'ios')
    return { kind: 'files-app', label: `Files app › On My ${Platform.isPad ? 'iPad' : 'iPhone'} › ${APP_FOLDER} › ${INTERNAL}` };
  return { kind: 'app', label: 'Inside the app only' };
}

/**
 * Opens Android's folder picker and adopts what the operator picks.
 * Returns false if they backed out without choosing.
 */
export async function chooseFolder(): Promise<boolean> {
  if (!canChooseFolder) return false;
  let picked: Directory;
  try {
    picked = await Directory.pickDirectoryAsync(DOCUMENTS_HINT);
  } catch (e) {
    if (/cancel/i.test(reason(e))) return false;
    throw e;
  }
  // Make (or reuse) our own folder inside it straight away — this also
  // proves the folder can really be written to before we rely on it.
  const nested = !sameName(leafName(picked.uri), APP_FOLDER);
  const root = nested ? asDir(findChild(picked, APP_FOLDER)) ?? picked.createDirectory(APP_FOLDER) : picked;
  const base = describeTree(picked.uri);
  chosen = { treeUri: picked.uri, rootUri: root.uri, label: nested ? `${base} › ${APP_FOLDER}` : base, days: {} };
  persist();
  return true;
}

/** Goes back to keeping files inside the app. Files already saved stay where they are. */
export function forgetFolder(): void {
  chosen = null;
  persist();
}

function folderForDay(day: string): Directory {
  if (!chosen) throw new Error('no folder chosen');
  const known = chosen.days[day];
  if (known) {
    const d = new Directory(known);
    if (d.exists) return d;
  }
  let root = new Directory(chosen.rootUri);
  if (!root.exists) {
    // Our folder was deleted or renamed in the file manager — put it back.
    const tree = new Directory(chosen.treeUri);
    if (!tree.exists) throw new Error('the chosen folder is gone, or access to it was removed');
    root = sameName(leafName(tree.uri), APP_FOLDER)
      ? tree
      : asDir(findChild(tree, APP_FOLDER)) ?? tree.createDirectory(APP_FOLDER);
    chosen.rootUri = root.uri;
  }
  const dayDir = asDir(findChild(root, day)) ?? root.createDirectory(day);
  const recent = Object.entries(chosen.days)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, REMEMBER_DAYS);
  chosen.days = { ...Object.fromEntries(recent), [day]: dayDir.uri };
  persist();
  return dayDir;
}

function writeToFolder(name: string, text: string, day: string): void {
  const dir = folderForDay(day);
  // Shared-storage files are not cleared when written over, so a copy from
  // earlier the same day is replaced rather than overwritten in place.
  const old = findChild(dir, name);
  if (old instanceof File) old.delete();
  const f = dir.createFile(name, /\.txt$/i.test(name) ? 'text/plain' : 'text/csv');
  try {
    f.write(text);
  } catch (e) {
    // Never leave a half-written file looking like real data.
    try {
      f.delete();
    } catch {}
    throw e;
  }
}

function internalRoot(): Directory {
  const d = new Directory(Paths.document, INTERNAL);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

function writeInternal(name: string, text: string, day: string): void {
  const dir = new Directory(internalRoot(), day);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const f = new File(dir, name);
  f.create({ overwrite: true });
  f.write(text);
}

/** Saves one downloaded file under today's date and says where it went. */
export function saveCsv(name: string, text: string, day: string = dayStamp(new Date())): SaveResult {
  if (isWeb) {
    // No app sandbox in a browser — hand the file straight to the downloads.
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${day}_${name}`;
    a.click();
    URL.revokeObjectURL(url);
    return { where: 'Downloads' };
  }
  if (chosen) {
    const label = chosen.label;
    try {
      writeToFolder(name, text, day);
      return { where: `${label} › ${day}` };
    } catch (e) {
      // The data matters more than where it lands: keep it in the app instead.
      writeInternal(name, text, day);
      return { where: `inside the app › ${day}`, warning: `could not write to your folder (${reason(e)})` };
    }
  }
  writeInternal(name, text, day);
  return { where: Platform.OS === 'ios' ? `Files app › ${APP_FOLDER} › ${INTERNAL} › ${day}` : `inside the app › ${day}` };
}

/** Files held inside the app: today's layout (a folder per day) and the older flat one. */
export function listSaved(): SavedFile[] {
  if (isWeb) return [];
  const entry = (f: File, day: string): SavedFile => ({
    name: leafName(f.uri),
    uri: f.uri,
    size: f.size ?? 0,
    modified: f.modificationTime ?? 0,
    day,
  });
  const out: SavedFile[] = [];
  for (const x of internalRoot().list()) {
    if (x instanceof File) out.push(entry(x, ''));
    else for (const y of x.list()) if (y instanceof File) out.push(entry(y, leafName(x.uri)));
  }
  return out.sort((a, b) => b.modified - a.modified);
}

/**
 * Moves everything held inside the app out into the chosen folder, each file
 * under the day it was downloaded. Returns how many were moved.
 */
export function moveSavedToFolder(): number {
  if (!chosen) throw new Error('choose a folder first');
  let moved = 0;
  for (const f of listSaved()) {
    const src = new File(f.uri);
    const day = f.day || dayStamp(f.modified ? new Date(f.modified) : new Date());
    writeToFolder(f.name, src.textSync(), day);
    src.delete();
    moved++;
  }
  // Tidy away the day folders that are now empty.
  for (const x of internalRoot().list()) if (x instanceof Directory && x.list().length === 0) x.delete();
  return moved;
}

export async function shareSaved(file: SavedFile): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: file.name,
  });
}

export function deleteSaved(file: SavedFile): void {
  const f = new File(file.uri);
  if (f.exists) f.delete();
}
