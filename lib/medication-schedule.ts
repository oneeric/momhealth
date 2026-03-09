/**
 * 用藥提醒排程 - 對應實際發送時間（台灣時間）
 * 早上 7:00、中午 12:00、晚上 18:00、睡前 21:00
 */
import { scheduleData } from "./medication-data";
import type { MedItem } from "./medication-data";

export const REMINDER_TIMES = [
  { hour: 7, label: "早上", periodIndex: 0 },
  { hour: 12, label: "中午", periodIndex: 1 },
  { hour: 18, label: "晚上", periodIndex: 2 },
  { hour: 21, label: "睡前", periodIndex: 3 },
] as const;

function filterMedsByDay(meds: MedItem[], currentDay: number): MedItem[] {
  if (currentDay >= 1 && currentDay <= 7) return meds;
  // 休養/恢復期（Day 8-14）只提醒中藥
  return meds.filter((m) => m.baseId === "tcm");
}

export function getMedsForPeriod(
  periodIndex: number,
  currentDay: number
): { name: string; id: string; baseId: string; dose: string }[] {
  const period = scheduleData[periodIndex];
  if (!period) return [];
  const out: { name: string; id: string; baseId: string; dose: string }[] = [];
  period.slots.forEach((slot) => {
    filterMedsByDay(slot.meds, currentDay).forEach((m) => {
      out.push({ name: m.name, id: m.id, baseId: m.baseId, dose: m.dose });
    });
  });
  return out;
}
