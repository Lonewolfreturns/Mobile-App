// Where COPY THE DATA puts the CSVs: a "received_data" folder inside the
// app's own documents. From there each file can be shared out (Files,
// Drive, email, AirDrop...) with the system share sheet.
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SavedFile = { name: string; uri: string; size: number; modified: number };

const FOLDER = 'received_data';
const isWeb = Platform.OS === 'web';

function dir(): Directory {
  const d = new Directory(Paths.document, FOLDER);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export function saveCsv(name: string, text: string): void {
  if (isWeb) {
    // No app sandbox in a browser — hand the file straight to the downloads.
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const f = new File(dir(), name);
  f.create({ overwrite: true });
  f.write(text);
}

export function listSaved(): SavedFile[] {
  if (isWeb) return [];
  return dir()
    .list()
    .filter((x): x is File => x instanceof File)
    .map((f) => ({ name: f.name, uri: f.uri, size: f.size ?? 0, modified: f.modificationTime ?? 0 }))
    .sort((a, b) => b.modified - a.modified);
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
