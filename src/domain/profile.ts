/**
 * プロフィール（保存された出生データ）の永続化。
 * まずはスマホ内（localStorage）に JSON で保存する。
 * 将来クラウド同期や四柱推命アプリとの共有をするときは、この層だけ差し替える。
 */
import type { BirthData } from './birthData.ts';

export interface Profile {
  id: string;
  /** 表示名（例: 本人 / 家族の名前） */
  label: string;
  birth: BirthData;
  createdAt: string;
  updatedAt: string;
}

const PROFILES_KEY = 'astro-app:profiles:v1';
const ACTIVE_KEY = 'astro-app:activeProfileId:v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadProfiles(): Profile[] {
  return safeParse<Profile[]>(localStorage.getItem(PROFILES_KEY), []);
}

export function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProfileId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function getActiveProfile(): Profile | null {
  const id = getActiveProfileId();
  const profiles = loadProfiles();
  return profiles.find((p) => p.id === id) ?? profiles[0] ?? null;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertProfile(input: { id?: string; label: string; birth: BirthData }): Profile {
  const profiles = loadProfiles();
  const now = new Date().toISOString();
  const existingIndex = input.id ? profiles.findIndex((p) => p.id === input.id) : -1;

  if (existingIndex >= 0) {
    const updated: Profile = {
      ...profiles[existingIndex],
      label: input.label,
      birth: input.birth,
      updatedAt: now,
    };
    profiles[existingIndex] = updated;
    saveProfiles(profiles);
    return updated;
  }

  const created: Profile = {
    id: newId(),
    label: input.label,
    birth: input.birth,
    createdAt: now,
    updatedAt: now,
  };
  profiles.push(created);
  saveProfiles(profiles);
  setActiveProfileId(created.id);
  return created;
}

export function deleteProfile(id: string): void {
  const profiles = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  if (getActiveProfileId() === id) setActiveProfileId(profiles[0]?.id ?? null);
}

/** バックアップ用のエクスポート（四柱推命アプリへの受け渡しにも使える） */
export function exportProfiles(): string {
  return JSON.stringify({ kind: 'astro-app/profiles', version: 1, profiles: loadProfiles() }, null, 2);
}

export function importProfiles(json: string, mode: 'merge' | 'replace' = 'merge'): number {
  const parsed = JSON.parse(json) as { profiles?: Profile[] };
  const incoming = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  if (mode === 'replace') {
    saveProfiles(incoming);
    return incoming.length;
  }
  const current = loadProfiles();
  const byId = new Map(current.map((p) => [p.id, p]));
  for (const p of incoming) byId.set(p.id, p);
  const merged = [...byId.values()];
  saveProfiles(merged);
  return incoming.length;
}
