"use client";

import { useEffect, useState, useCallback } from "react";
import {
  loadSharedData,
  saveSharedData,
  type SharedData,
} from "./sync-storage";
import type { TreatmentConfig } from "./treatment";
import type { MemoCard } from "./storage";

export function useSharedData() {
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const loaded = await loadSharedData();
    setData(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveTreatment = useCallback(async (treatment: TreatmentConfig) => {
    setData((prev) => (prev ? { ...prev, treatment } : null));
    await saveSharedData({ treatment });
  }, []);

  const saveMedRecords = useCallback(
    async (date: string, records: Record<string, boolean>) => {
      const nextMedRecords = {
        ...(data?.medRecords ?? {}),
        [date]: records,
      };
      setData((prev) => (prev ? { ...prev, medRecords: nextMedRecords } : null));
      await saveSharedData({ medRecords: nextMedRecords });
    },
    [data?.medRecords]
  );

  const saveMemos = useCallback(async (memos: MemoCard[]) => {
    setData((prev) => (prev ? { ...prev, memos } : null));
    await saveSharedData({ memos });
  }, []);

  return {
    data,
    loading,
    refresh,
    saveTreatment,
    saveMedRecords,
    saveMemos,
  };
}
