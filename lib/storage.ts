/**
 * 本地儲存（後續可替換為 Supabase/Vercel Postgres）
 */

const STORAGE_KEYS = {
  TREATMENT: "momhealth_treatment",
  MED_RECORDS: "momhealth_med_records",
  MEMOS: "momhealth_memos",
  PILL_IMAGES: "momhealth_pill_images",
} as const;

export interface TreatmentConfig {
  totalCycles: number;
  cycleLength: number;
  /** 每次療程 Day 1（打針日）的實際日期 */
  cycleDates: string[];
}

export interface MemoCard {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export function getTreatmentConfig(): TreatmentConfig | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEYS.TREATMENT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TreatmentConfig;
  } catch {
    return null;
  }
}

export function setTreatmentConfig(config: TreatmentConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.TREATMENT, JSON.stringify(config));
}

export function getMedRecords(date: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(`${STORAGE_KEYS.MED_RECORDS}_${date}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function setMedRecords(date: string, records: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEYS.MED_RECORDS}_${date}`, JSON.stringify(records));
}

export function getMemos(): MemoCard[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.MEMOS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MemoCard[];
  } catch {
    return [];
  }
}

export function setMemos(memos: MemoCard[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.MEMOS, JSON.stringify(memos));
}
