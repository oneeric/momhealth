"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  scheduleData,
  prnMeds,
  pillGuide,
  type MedItem,
} from "@/lib/medication-data";
import { getTreatmentConfig } from "@/lib/storage";
import { getCurrentProgress, migrateLegacyConfig } from "@/lib/treatment";
import { getMedRecords, setMedRecords } from "@/lib/storage";
import PillImage from "@/components/PillImage";
import {
  Sun,
  CloudSun,
  Moon,
  MoonStar,
  AlertCircle,
  CheckCircle2,
  Circle,
  Pill,
  Calendar,
  Clock,
  Info,
} from "lucide-react";

const PERIOD_ICONS = [Sun, CloudSun, Moon, MoonStar];

function filterMedsByDay(meds: MedItem[], currentDay: number): MedItem[] {
  if (currentDay >= 1 && currentDay <= 7) return meds;
  return meds.filter(
    (m) => !m.applicableDays || m.applicableDays.length === 0
  );
}

export default function MedsPage() {
  const [activeTab, setActiveTab] = useState<"schedule" | "prn" | "guide">(
    "schedule"
  );
  const [checkedMeds, setCheckedMeds] = useState<Record<string, boolean>>({});
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const raw = getTreatmentConfig();
    const config = raw ? migrateLegacyConfig(raw as Parameters<typeof migrateLegacyConfig>[0]) : null;
    if (config) {
      const progress = getCurrentProgress(config);
      setCurrentDay(progress.day >= 1 && progress.day <= 14 ? progress.day : 1);
    }
    const today = new Date().toISOString().slice(0, 10);
    setCheckedMeds(getMedRecords(today));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const toggleCheck = (id: string) => {
    const next = { ...checkedMeds, [id]: !checkedMeds[id] };
    setCheckedMeds(next);
    setMedRecords(today, next);
  };

  const resetDaily = () => {
    if (window.confirm("確定要清除今天的吃藥紀錄嗎？")) {
      setCheckedMeds({});
      setMedRecords(today, {});
    }
  };

  // 計算今日完成率
  const allMedIds: string[] = [];
  scheduleData.forEach((p) =>
    p.slots.forEach((s) =>
      filterMedsByDay(s.meds, currentDay).forEach((m) => allMedIds.push(m.id))
    )
  );
  const checkedCount = allMedIds.filter((id) => checkedMeds[id]).length;
  const totalCount = allMedIds.length;
  const completionRate =
    totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-4">
        {activeTab === "schedule" && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> 每日例行清單
              </span>
              <button
                onClick={resetDaily}
                className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full hover:bg-slate-200"
              >
                重置今日
              </button>
            </div>

            {/* 完成率 */}
            <div className="bg-white rounded-xl p-4 shadow-card border border-health-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600">
                  今日完成率
                </span>
                <span className="text-lg font-bold text-primary-600">
                  {completionRate}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            {/* 口服藥週提示 */}
            {currentDay >= 8 && currentDay <= 14 && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-xl flex items-start gap-2">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  本週為休養期，TS-1、Folina 已停藥，僅顯示其他常規用藥。
                </p>
              </div>
            )}

            {currentDay >= 1 && currentDay <= 7 && (
              <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-xl flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-800">
                  TS-1 與 Folina 吃滿 <strong>6 天</strong> 即須停藥，請特別留意。
                </p>
              </div>
            )}

            {scheduleData.map((period, idx) => (
              <div
                key={idx}
                className="rounded-2xl shadow-card border border-health-border overflow-hidden bg-white"
              >
                <div
                  className={`${period.bgColor} ${period.headerColor} px-4 py-3 font-bold flex items-center gap-2`}
                >
                  {(() => {
                    const Icon = PERIOD_ICONS[idx] || Sun;
                    return <Icon className="w-5 h-5" />;
                  })()}
                  {period.timeOfDay}
                </div>
                <div className="px-4 py-3 space-y-4">
                  {period.slots.map((slot, sIdx) => (
                    <div key={sIdx}>
                      <div className="flex items-center text-sm font-semibold text-slate-500 mb-2 border-b pb-1">
                        <Clock className="w-4 h-4 mr-1" /> {slot.timing}
                      </div>
                      <div className="space-y-3">
                        {filterMedsByDay(slot.meds, currentDay).map((med) => (
                          <div
                            key={med.id}
                            onClick={() => toggleCheck(med.id)}
                            className={`flex items-stretch overflow-hidden rounded-xl border transition-all active:scale-[0.98] cursor-pointer mb-3 last:mb-0 ${
                              checkedMeds[med.id]
                                ? "bg-primary-50 border-primary-200"
                                : "bg-white border-slate-100 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center pl-4 py-3 pr-3 flex-shrink-0">
                              {checkedMeds[med.id] ? (
                                <CheckCircle2 className="w-7 h-7 text-primary-500" />
                              ) : (
                                <Circle className="w-7 h-7 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 py-3 pr-3 flex flex-col justify-center">
                              <div className="flex justify-between items-start gap-2">
                                <h4
                                  className={`font-bold ${
                                    checkedMeds[med.id]
                                      ? "text-primary-700 line-through opacity-70"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {med.name}
                                </h4>
                                <span className="font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded text-sm flex-shrink-0">
                                  {med.dose}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {med.purpose}
                              </p>
                              {med.isAlert && (
                                <p className="text-xs text-rose-600 font-bold mt-1 bg-rose-50 inline-block px-1 rounded">
                                  ⚠️ {med.alertText}
                                </p>
                              )}
                            </div>
                            <PillImage
                              baseId={med.baseId}
                              fallbackCss={med.pillCss}
                              hasLine={med.hasLine}
                              size="sm"
                              align="right"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === "prn" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800">有症狀才吃的備用藥</h2>
            {prnMeds.map((condition, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-card border border-rose-100 overflow-hidden"
              >
                <div className="bg-rose-50 text-rose-700 p-3 font-bold flex items-center gap-2 border-b border-rose-100">
                  <AlertCircle className="w-5 h-5" />
                  {condition.condition}
                </div>
                <div className="space-y-0">
                  {condition.meds.map((med, mIdx) => (
                    <div
                      key={mIdx}
                      className="flex items-stretch overflow-hidden"
                    >
                      <div className="flex-1 min-w-0 pl-4 py-3 pr-3 flex flex-col justify-center">
                        <h4 className="font-bold text-slate-800">{med.name}</h4>
                        <p className="text-sm text-primary-600 font-medium mt-1">
                          {med.dose}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          時機: {med.timing}
                        </p>
                      </div>
                      <PillImage
                        baseId={med.baseId}
                        fallbackCss={med.pillCss}
                        size="md"
                        align="right"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="bg-primary-50 text-primary-800 p-4 rounded-xl text-sm flex items-start gap-2">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>
                備用藥品平常不需要吃。若症狀緩解即可停用。若症狀持續嚴重，請提前回診。
              </p>
            </div>
          </div>
        )}

        {activeTab === "guide" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800">圖文對照指南</h2>
            {pillGuide.map((med, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-card border border-health-border overflow-hidden flex items-stretch"
              >
                <PillImage
                  baseId={med.baseId}
                  fallbackCss={med.pillCss}
                  hasLine={med.hasLine}
                  size="md"
                  align="left"
                />
                <div className="flex-1 min-w-0 pl-4 py-4 pr-4 flex flex-col justify-center">
                  <h4 className="font-bold text-slate-800 text-sm">{med.name}</h4>
                  <span className="inline-block px-2 py-0.5 mt-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                    {med.type}
                  </span>
                  <p className="text-xs text-slate-500 mt-2">{med.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 切換 */}
        <div className="flex gap-2 bg-white p-2 rounded-xl shadow-card border border-health-border">
          {(
            [
              ["schedule", "每日課表", Calendar],
              ["prn", "備用藥品", AlertCircle],
              ["guide", "藥品圖鑑", Pill],
            ] as const
          ).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 flex flex-col items-center justify-center text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-primary-100 text-primary-700"
                  : "text-health-muted hover:bg-slate-50"
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
