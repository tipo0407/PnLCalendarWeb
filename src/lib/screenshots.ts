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
