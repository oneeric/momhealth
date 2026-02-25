/**
 * SLOG 療程計算與當日提示
 * 支援每次療程獨立設定打針日（因回診不一定剛好隔 14 天）
 */

export interface TreatmentConfig {
  totalCycles: number;
  cycleLength: number;
  /** 每次療程 Day 1（打針日）的實際日期，可依實際回診日逐筆設定 */
  cycleDates: string[];
}

export interface DayInfo {
  cycle: number;
  day: number;
  phase: "injection" | "oral" | "rest" | "recovery";
  phaseLabel: string;
  title: string;
  content: string;
  tips: string[];
}

const DAY_TIPS: Record<number, DayInfo> = {
  1: {
    cycle: 0,
    day: 1,
    phase: "injection",
    phaseLabel: "打針日",
    title: "醫院打針日",
    content: "健擇 (60分) + 草酸鉑 (2小時)。務必攜帶冰敷手套/腳套。當晚開始口服藥 TS-1 + Leucovorin。",
    tips: [
      "今天是最辛苦的打針日！一定要記得戴冰敷手套與腳套防發麻。",
      "回家後開始按時吃化療口服藥 (TS-1)。",
      "當晚開始注意保暖，絕對避免碰觸冰冷物品。",
    ],
  },
  2: {
    cycle: 0,
    day: 2,
    phase: "oral",
    phaseLabel: "口服藥週",
    title: "口服藥 Day 2",
    content: "TS-1 + Leucovorin、止吐藥、止痛藥。補充速養療。",
    tips: ["噁心嘔吐、極度疲倦最明顯。少量多餐，吃得下最重要。"],
  },
  3: {
    cycle: 0,
    day: 3,
    phase: "oral",
    phaseLabel: "口服藥週",
    title: "口服藥 Day 3",
    content: "TS-1 + Leucovorin、止吐藥、止痛藥。補充速養療。",
    tips: ["噁心嘔吐、極度疲倦最明顯。少量多餐，吃得下最重要。"],
  },
  4: {
    cycle: 0,
    day: 4,
    phase: "oral",
    phaseLabel: "口服藥週",
    title: "口服藥 Day 4",
    content: "TS-1 + Leucovorin、視情況止吐/止痛藥。繼續速養療。",
    tips: ["噁心感通常會逐漸減輕。注意嘴破、腹瀉、手腳發麻。"],
  },
  5: {
    cycle: 0,
    day: 5,
    phase: "oral",
    phaseLabel: "口服藥週",
    title: "口服藥 Day 5",
    content: "TS-1 + Leucovorin、視情況止吐/止痛藥。繼續速養療。",
    tips: ["噁心感通常會逐漸減輕。注意嘴破、腹瀉、手腳發麻。"],
  },
  6: {
    cycle: 0,
    day: 6,
    phase: "oral",
    phaseLabel: "口服藥週",
    title: "口服藥 Day 6",
    content: "TS-1 + Leucovorin、視情況止吐/止痛藥。繼續速養療。",
    tips: ["噁心感通常會逐漸減輕。注意嘴破、腹瀉、手腳發麻。"],
  },
  7: {
    cycle: 0,
    day: 7,
    phase: "oral",
    phaseLabel: "口服藥週",
    title: "口服藥 Day 7（最後一天）",
    content: "TS-1 + Leucovorin 最後一天，吃滿即停藥。繼續速養療。",
    tips: ["吃滿 6 天即停藥，請特別留意。"],
  },
  8: {
    cycle: 0,
    day: 8,
    phase: "rest",
    phaseLabel: "休養週",
    title: "休養 Day 8",
    content: "TS-1、Leucovorin 皆暫停。可持續吃速養療修復黏膜。",
    tips: ["⚠️ 感染高風險期！白血球通常在這幾天降到最低。嚴格禁止生食，出門務必戴口罩。每天早晚量體溫。"],
  },
  9: {
    cycle: 0,
    day: 9,
    phase: "rest",
    phaseLabel: "休養週",
    title: "休養 Day 9",
    content: "持續停藥。可持續吃速養療。",
    tips: ["⚠️ 感染高風險期！避免出入人多場所，出門務必戴口罩。"],
  },
  10: {
    cycle: 0,
    day: 10,
    phase: "rest",
    phaseLabel: "休養週",
    title: "休養 Day 10",
    content: "持續停藥。可持續吃速養療。",
    tips: ["⚠️ 感染高風險期！避免出入人多場所。"],
  },
  11: {
    cycle: 0,
    day: 11,
    phase: "recovery",
    phaseLabel: "體力恢復期",
    title: "休養 Day 11",
    content: "持續停藥，僅維持日常保養/速養療。",
    tips: ["體力與食慾應該會明顯好轉。多補充高蛋白食物（魚肉蛋奶）。"],
  },
  12: {
    cycle: 0,
    day: 12,
    phase: "recovery",
    phaseLabel: "體力恢復期",
    title: "休養 Day 12",
    content: "持續停藥，僅維持日常保養/速養療。",
    tips: ["體力與食慾應該會明顯好轉。多補充高蛋白食物。"],
  },
  13: {
    cycle: 0,
    day: 13,
    phase: "recovery",
    phaseLabel: "體力恢復期",
    title: "休養 Day 13",
    content: "持續停藥，僅維持日常保養/速養療。",
    tips: ["體力與食慾應該會明顯好轉。多補充高蛋白食物。"],
  },
  14: {
    cycle: 0,
    day: 14,
    phase: "recovery",
    phaseLabel: "回診準備日",
    title: "回診準備日",
    content: "抽血檢查：白血球/肝腎功能。整理這兩週的副作用紀錄給醫師。",
    tips: ["確認檢查數據是否達標。若身體恢復良好，隔天 (新的 Day 1) 就會進入下一次療程。"],
  },
};

function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export type ProgressStatus =
  | "not_started"
  | "in_cycle"
  | "waiting_next"
  | "completed";

export function getCurrentProgress(config: TreatmentConfig): {
  cycle: number;
  day: number;
  todayInfo: DayInfo | null;
  isRestDay: boolean;
  status: ProgressStatus;
  /** 若在等待下次療程，可顯示的預計日期（上次 + 14 天估算） */
  estimatedNextDate?: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = config.cycleDates.filter(Boolean);
  if (dates.length === 0) {
    return {
      cycle: 0,
      day: 0,
      todayInfo: null,
      isRestDay: true,
      status: "not_started",
    };
  }

  // 找出今天落在哪個療程
  for (let i = 0; i < dates.length; i++) {
    const cycleStart = parseDate(dates[i]);
    cycleStart.setHours(0, 0, 0, 0);
    const dayInCycle = daysBetween(cycleStart, today) + 1;

    if (dayInCycle >= 1 && dayInCycle <= config.cycleLength) {
      const todayInfo: DayInfo = {
        ...DAY_TIPS[dayInCycle as keyof typeof DAY_TIPS],
        cycle: i + 1,
        day: dayInCycle,
      };
      return {
        cycle: i + 1,
        day: dayInCycle,
        todayInfo,
        isRestDay: false,
        status: "in_cycle",
      };
    }
  }

  // 今天在最後一次療程之後
  const lastStart = parseDate(dates[dates.length - 1]);
  lastStart.setHours(0, 0, 0, 0);
  const estimatedNext = new Date(lastStart);
  estimatedNext.setDate(estimatedNext.getDate() + config.cycleLength);

  if (dates.length < config.totalCycles) {
    return {
      cycle: dates.length,
      day: config.cycleLength,
      todayInfo: { ...DAY_TIPS[14], cycle: dates.length },
      isRestDay: true,
      status: "waiting_next",
      estimatedNextDate: estimatedNext.toISOString().slice(0, 10),
    };
  }

  return {
    cycle: config.totalCycles,
    day: config.cycleLength,
    todayInfo: { ...DAY_TIPS[14], cycle: config.totalCycles },
    isRestDay: true,
    status: "completed",
  };
}

export function getPhaseStyle(phase: DayInfo["phase"]): string {
  switch (phase) {
    case "injection":
      return "bg-primary-100 text-primary-800 border-primary-200";
    case "oral":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "rest":
      return "bg-cyan-50 text-cyan-800 border-cyan-200";
    case "recovery":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

/** 將舊版 startDate 格式遷移為 cycleDates */
export function migrateLegacyConfig(legacy: {
  startDate?: string;
  totalCycles?: number;
  cycleLength?: number;
  cycleDates?: string[];
}): TreatmentConfig {
  if (legacy.cycleDates && legacy.cycleDates.length > 0) {
    return {
      totalCycles: legacy.totalCycles ?? 6,
      cycleLength: legacy.cycleLength ?? 14,
      cycleDates: legacy.cycleDates,
    };
  }
  if (legacy.startDate) {
    return {
      totalCycles: legacy.totalCycles ?? 6,
      cycleLength: legacy.cycleLength ?? 14,
      cycleDates: [legacy.startDate],
    };
  }
  return {
    totalCycles: 6,
    cycleLength: 14,
    cycleDates: [],
  };
}

export { DAY_TIPS };
