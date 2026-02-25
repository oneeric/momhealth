/**
 * 雲端同步儲存 - 所有使用者共享同一份資料
 * 有 API 時從雲端讀寫，否則 fallback 到 localStorage
 */
import type { TreatmentConfig } from "./treatment";
import type { MemoCard } from "./storage";

const STORAGE_KEYS = {
  TREATMENT: "momhealth_treatment",
  MED_RECORDS: "momhealth_med_records",
  MEMOS: "momhealth_memos",
} as const;

export interface SharedData {
  treatment: TreatmentConfig | null;
  medRecords: Record<string, Record<string, boolean>>;
  memos: MemoCard[];
}

async function fetchFromApi(): Promise<SharedData | null> {
  try {
    const res = await fetch("/api/data");
    const json = await res.json();
    if (json.ok && json.data) return json.data as SharedData;
  } catch {
    /* ignore */
  }
  return null;
}

async function saveToApi(data: Partial<SharedData>): Promise<void> {
  try {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    /* ignore */
  }
}

function getLocalTreatment(): TreatmentConfig | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEYS.TREATMENT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TreatmentConfig;
  } catch {
    return null;
  }
}

function getLocalMedRecords(): Record<string, Record<string, boolean>> {
  if (typeof window === "undefined") return {};
  const prefix = `${STORAGE_KEYS.MED_RECORDS}_`;
  const out: Record<string, Record<string, boolean>> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) {
      const date = k.slice(prefix.length);
      try {
        out[date] = JSON.parse(localStorage.getItem(k) ?? "{}");
      } catch {
        out[date] = {};
      }
    }
  }
  return out;
}

function getLocalMemos(): MemoCard[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.MEMOS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MemoCard[];
  } catch {
    return [];
  }
}

/** 從 API 或 localStorage 取得完整資料 */
export async function loadSharedData(): Promise<SharedData> {
  const fromApi = await fetchFromApi();
  if (fromApi) {
    // 同步到 localStorage 作為快取
    if (fromApi.treatment && typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEYS.TREATMENT,
        JSON.stringify(fromApi.treatment)
      );
    }
    if (Object.keys(fromApi.medRecords).length > 0 && typeof window !== "undefined") {
      Object.entries(fromApi.medRecords).forEach(([date, rec]) => {
        localStorage.setItem(
          `${STORAGE_KEYS.MED_RECORDS}_${date}`,
          JSON.stringify(rec)
        );
      });
    }
    if (fromApi.memos.length > 0 && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.MEMOS, JSON.stringify(fromApi.memos));
    }
    return fromApi;
  }
  return {
    treatment: getLocalTreatment(),
    medRecords: getLocalMedRecords(),
    memos: getLocalMemos(),
  };
}

/** 儲存並同步到雲端 */
export async function saveSharedData(data: Partial<SharedData>): Promise<void> {
  if (typeof window === "undefined") return;
  if (data.treatment) {
    localStorage.setItem(STORAGE_KEYS.TREATMENT, JSON.stringify(data.treatment));
  }
  if (data.medRecords) {
    Object.entries(data.medRecords).forEach(([date, rec]) => {
      localStorage.setItem(
        `${STORAGE_KEYS.MED_RECORDS}_${date}`,
        JSON.stringify(rec)
      );
    });
  }
  if (data.memos) {
    localStorage.setItem(STORAGE_KEYS.MEMOS, JSON.stringify(data.memos));
  }
  await saveToApi(data);
}
