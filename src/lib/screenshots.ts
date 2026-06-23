/* Tiny dependency-free IndexedDB store for per-trade screenshot blobs. */

import { getActiveProfileId, DEFAULT_PROFILE } from './profiles';

const DB_NAME = 'pnlcalendar';
const STORE = 'screenshots';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putShot(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getShot(key: string): Promise<Blob | null> {
  const db = await openDB();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(key);
    rq.onsuccess = () => resolve((rq.result as Blob) ?? null);
    rq.onerror = () => reject(rq.error);
  });
  db.close();
  return result;
}

export async function delShot(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Stable key for a trade's screenshot (namespaced by active profile). */
export function shotKey(date: string, tradeNumber: number, rowNumber: number): string {
  const id = getActiveProfileId();
  const prefix = id === DEFAULT_PROFILE.id ? '' : `${id}::`;
  return `${prefix}${date}#${tradeNumber || rowNumber}`;
}

/** Delete every stored screenshot (used by clear-all). */
export async function clearAllShots(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

/** Export the active profile's screenshots as { key: dataURL } for backup/sync. */
export async function exportAllShots(): Promise<Record<string, string>> {
  const id = getActiveProfileId();
  const isDefault = id === DEFAULT_PROFILE.id;
  const prefix = `${id}::`;
  const match = (key: string) => (isDefault ? !key.includes('::') : key.startsWith(prefix));

  const db = await openDB();
  const entries = await new Promise<[string, Blob][]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const out: [string, Blob][] = [];
    const cursor = tx.objectStore(STORE).openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        if (match(String(c.key))) out.push([String(c.key), c.value as Blob]);
        c.continue();
      } else resolve(out);
    };
    cursor.onerror = () => reject(cursor.error);
  });
  db.close();

  const result: Record<string, string> = {};
  for (const [key, blob] of entries) result[key] = await blobToDataUrl(blob);
  return result;
}

/** Restore screenshots from a backup's { key: dataURL } map. */
export async function importAllShots(map: Record<string, string>): Promise<void> {
  for (const [key, url] of Object.entries(map)) {
    try { await putShot(key, await dataUrlToBlob(url)); } catch { /* skip bad entries */ }
  }
}
