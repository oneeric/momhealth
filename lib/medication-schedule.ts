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
  return meds.filter(
    (m) => !m.applicableDays || m.applicableDays.length === 0
  );
}

export function getMedsForPeriod(
  periodIndex: number,
  currentDay: number
): { name: string; id: string }[] {
  const period = scheduleData[periodIndex];
  if (!period) return [];
  const out: { name: string; id: string }[] = [];
  period.slots.forEach((slot) => {
    filterMedsByDay(slot.meds, currentDay).forEach((m) => {
      out.push({ name: m.name, id: m.id });
    });
  });
  return out;
}
