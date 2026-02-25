"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  getCurrentProgress,
  getPhaseStyle,
  DAY_TIPS,
  migrateLegacyConfig,
  type TreatmentConfig,
} from "@/lib/treatment";
import { getTreatmentConfig, setTreatmentConfig } from "@/lib/storage";
import { Calendar, Info, Plus, Pencil } from "lucide-react";

const DEFAULT_CONFIG: TreatmentConfig = {
  totalCycles: 6,
  cycleLength: 14,
  cycleDates: [],
};

function formatDisplayDate(str: string): string {
  const [y, m, d] = str.split("-");
  return `${y}/${m}/${d}`;
}

export default function CalendarPage() {
  const [config, setConfig] = useState<TreatmentConfig>(DEFAULT_CONFIG);
  const [showSetup, setShowSetup] = useState(false);
  const [editingCycleIndex, setEditingCycleIndex] = useState<number | null>(
    null
  );
  const [editingDateValue, setEditingDateValue] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = getTreatmentConfig();
    if (saved) {
      setConfig(migrateLegacyConfig(saved as Parameters<typeof migrateLegacyConfig>[0]));
    } else {
      setShowSetup(true);
    }
  }, []);

  const progress = mounted ? getCurrentProgress(config) : null;

  const handleSaveConfig = (newConfig: TreatmentConfig) => {
    setConfig(newConfig);
    setTreatmentConfig(newConfig);
    setShowSetup(false);
  };

  const handleUpdateCycleDate = (cycleIndex: number, date: string) => {
    const next = [...config.cycleDates];
    next[cycleIndex] = date;
    const newConfig = { ...config, cycleDates: next };
    setConfig(newConfig);
    setTreatmentConfig(newConfig);
    setEditingCycleIndex(null);
    setEditingDateValue("");
  };

  const startEditing = (cycleIndex: number) => {
    setEditingCycleIndex(cycleIndex);
    setEditingDateValue(config.cycleDates[cycleIndex] || "");
  };

  const handleReset = () => {
    setShowSetup(true);
  };

  if (!mounted) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* 標題 */}
        <div className="flex items-center gap-2 text-primary-700 font-bold">
          <Calendar className="w-5 h-5" />
          療程進度追蹤
        </div>

        {/* 設定 modal：每次療程打針日列表 */}
        {showSetup && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-2">設定療程打針日</h3>
              <p className="text-sm text-health-muted mb-4">
                每次回診打針日可能不同，請依實際日期逐次設定。
              </p>

              <div className="space-y-3 mb-4">
                {Array.from({ length: config.totalCycles }, (_, i) => i + 1).map(
                  (cycleNum) => {
                    const existingDate = config.cycleDates[cycleNum - 1];
                    const isEditing = editingCycleIndex === cycleNum - 1;
                    return (
                      <div
                        key={cycleNum}
                        className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl"
                      >
                        <span className="w-20 font-medium text-slate-700">
                          第 {cycleNum} 次
                        </span>
                        {isEditing ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="date"
                              value={editingDateValue}
                              onChange={(e) =>
                                setEditingDateValue(e.target.value)
                              }
                              className="flex-1 px-3 py-2 border border-health-border rounded-lg text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingDateValue)
                                  handleUpdateCycleDate(
                                    cycleNum - 1,
                                    editingDateValue
                                  );
                              }}
                            />
                            <button
                              onClick={() => {
                                if (editingDateValue)
                                  handleUpdateCycleDate(
                                    cycleNum - 1,
                                    editingDateValue
                                  );
                              }}
                              className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm"
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => {
                                setEditingCycleIndex(null);
                                setEditingDateValue("");
                              }}
                              className="px-3 py-2 text-slate-600 text-sm"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm">
                              {existingDate ? (
                                formatDisplayDate(existingDate)
                              ) : (
                                <span className="text-health-muted">
                                  待設定
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => startEditing(cycleNum - 1)}
                              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                              title="編輯"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  }
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const nextIndex = config.cycleDates.length;
                    if (nextIndex < config.totalCycles) {
                      handleUpdateCycleDate(nextIndex, today);
                    }
                    setShowSetup(false);
                  }}
                  className="flex-1 py-2 flex items-center justify-center gap-2 bg-primary-100 text-primary-700 rounded-xl font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  快速新增（今天）
                </button>
                <button
                  onClick={() => handleSaveConfig(config)}
                  className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl"
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 進度概覽 */}
        <div className="bg-white rounded-2xl shadow-card border border-health-border overflow-hidden">
          <div className="bg-primary-50 text-primary-800 px-4 py-2 text-sm font-medium">
            目前進度 (共 {config.totalCycles} 次，已設定 {config.cycleDates.length} 次打針日)
          </div>
          <div className="p-4">
            {progress?.status === "not_started" && (
              <p className="text-slate-600">
                請設定至少一次打針日以開始追蹤
              </p>
            )}
            {progress?.status === "in_cycle" && progress.cycle > 0 && (
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-health-muted">第幾次療程</p>
                  <p className="text-2xl font-bold text-primary-600">
                    第 {progress.cycle} 次
                  </p>
                </div>
                <div>
                  <p className="text-xs text-health-muted">第幾天</p>
                  <p className="text-2xl font-bold text-primary-600">
                    第 {progress.day} 天
                  </p>
                </div>
              </div>
            )}
            {progress?.status === "waiting_next" && (
              <div className="space-y-2">
                <p className="text-slate-600">
                  第 {progress.cycle} 次療程已結束，等待下一次回診
                </p>
                {progress.estimatedNextDate && (
                  <p className="text-sm text-health-muted">
                    約 {formatDisplayDate(progress.estimatedNextDate)} 回診（依醫師排程為準）
                  </p>
                )}
                <button
                  onClick={() => {
                    setEditingCycleIndex(config.cycleDates.length);
                    setEditingDateValue("");
                    setShowSetup(true);
                  }}
                  className="mt-2 text-primary-600 font-medium text-sm"
                >
                  + 設定第 {config.cycleDates.length + 1} 次打針日
                </button>
              </div>
            )}
            {progress?.status === "completed" && (
              <p className="text-slate-600">療程已全部完成</p>
            )}
          </div>
        </div>

        {/* 當日提示 */}
        {progress?.todayInfo && progress.status === "in_cycle" && (
          <div className="bg-white rounded-2xl shadow-card border border-health-border overflow-hidden">
            <div
              className={`flex items-center gap-2 px-4 py-2 border-b ${getPhaseStyle(progress.todayInfo.phase)}`}
            >
              <Info className="w-5 h-5" />
              <span className="font-bold">{progress.todayInfo.title}</span>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm text-slate-700">
                {progress.todayInfo.content}
              </p>
              {progress.todayInfo.tips.map((tip, i) => (
                <p
                  key={i}
                  className="text-sm text-slate-600 bg-slate-50 p-2 rounded-lg"
                >
                  {tip}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 14 天週期 */}
        <div className="bg-white rounded-2xl shadow-card border border-health-border p-4">
          <p className="text-sm font-medium text-slate-600 mb-3">
            本次療程 14 天週期：
          </p>
          <div className="grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((d) => {
              const info = DAY_TIPS[d as keyof typeof DAY_TIPS];
              const isToday = progress?.day === d;
              const phaseStyle = info
                ? getPhaseStyle(info.phase)
                : "bg-slate-100";
              return (
                <div
                  key={d}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium border-2 ${
                    isToday ? "ring-2 ring-primary-500 ring-offset-2" : ""
                  } ${phaseStyle}`}
                >
                  <span>Day</span>
                  <span className="font-bold">{d}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingCycleIndex(null);
              setShowSetup(true);
            }}
            className="flex-1 py-3 border border-health-border rounded-xl text-slate-600 font-medium hover:bg-slate-50"
          >
            管理打針日
          </button>
        </div>
      </div>
    </AppShell>
  );
}
