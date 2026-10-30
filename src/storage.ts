import { validateBackup, type AppData } from "./data.ts";

export const DB_NAME = "seven-days";
const STORE = "app";
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
    });
  return database;
}
export async function loadData(): Promise<AppData | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .get("data");
    request.onsuccess = () => {
      try {
        resolve(request.result ? validateBackup(request.result) : null);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
// Read and modify inside one transaction, so rapid edits and other tabs cannot overwrite stale data.
export async function changeData(
  change: (current: AppData | null) => AppData,
): Promise<AppData> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.get("data");
    let result: AppData;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        result = change(request.result ?? null);
        store.put(result, "data");
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(failure ?? tx.error);
    tx.onabort = () =>
      reject(failure ?? tx.error ?? new Error("保存失败，请重试。"));
  });
}
