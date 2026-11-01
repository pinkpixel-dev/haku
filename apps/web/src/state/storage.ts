// Local saving with IndexedDB. One store of projects keyed by id, plus the id of the last one you had
// open in localStorage. Everything loaded back is validated with the project schema.

import { parseProject, type Project } from '@haku/core';

const DB_NAME = 'haku';
const STORE = 'projects';
const LAST_KEY = 'haku:last-project';

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  scenes: number;
  mood: string | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveProject(project: Project): Promise<void> {
  await run('readwrite', (s) => s.put(project));
  localStorage.setItem(LAST_KEY, project.id);
}

export async function loadProject(id: string): Promise<Project | null> {
  const raw = await run('readonly', (s) => s.get(id));
  return raw ? parseProject(raw) : null;
}

export async function deleteProject(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
  if (localStorage.getItem(LAST_KEY) === id) localStorage.removeItem(LAST_KEY);
}

/** Newest first. Projects that no longer validate are skipped rather than breaking the list. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const all = (await run('readonly', (s) => s.getAll())) as unknown[];
  const out: ProjectSummary[] = [];
  for (const raw of all) {
    try {
      const p = parseProject(raw);
      out.push({ id: p.id, name: p.name, updatedAt: p.updatedAt, scenes: p.scenes.length, mood: p.mood });
    } catch {
      // Unreadable entry: leave it alone, it just doesn't show up.
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The project you had open last time, if it still loads. */
export async function loadLastProject(): Promise<Project | null> {
  const id = localStorage.getItem(LAST_KEY);
  if (!id) return null;
  try {
    return await loadProject(id);
  } catch {
    return null;
  }
}
