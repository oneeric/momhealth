/**
 * 排程提醒 API（由 QStash / GitHub Actions 備援觸發）
 * 每日 8 點階段提醒 + 用藥時間提醒
 * 台灣時間：8:00, 7:00, 12:00, 18:00, 21:00 (UTC: 0:00, 23:00, 4:00, 10:00, 13:00)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  kvClearReminderSent,
  kvGetSharedData,
  kvMarkReminderSent,
  kvPushReminderLog,
  kvSetCheckToken,
  kvWasReminderSent,
} from "@/lib/kv";
import {
  isLineMessagingConfigured,
  pushMessages,
  type LinePushMessage,
} from "@/lib/line-messaging";
import { getCurrentProgress, migrateLegacyConfig } from "@/lib/treatment";
import { scheduleData, type MedItem } from "@/lib/medication-data";
import { isQstashVerificationConfigured, verifyQstashSignature } from "@/lib/qstash";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

type ReminderSlot =
  | "day"
  | "morning"
  | "noon"
  | "evening"
  | "bedtime"
  | "morning_tcm"
  | "noon_tcm"
  | "evening_tcm";

const MEDS_SLOT_CONFIG: Record<
  Exclude<ReminderSlot, "day">,
  { hour: number; periodIndex: number; label: string; onlyTcm?: boolean }
> = {
  morning: { hour: 7, periodIndex: 0, label: "早上" },
  noon: { hour: 12, periodIndex: 1, label: "中午" },
  evening: { hour: 18, periodIndex: 2, label: "晚上" },
  bedtime: { hour: 21, periodIndex: 3, label: "睡前" },
  morning_tcm: {
    hour: 8,
    periodIndex: 0,
    label: "早上中藥（餐後一小時）",
    onlyTcm: true,
  },
  noon_tcm: {
    hour: 13,
    periodIndex: 1,
    label: "中午中藥（餐後一小時）",
    onlyTcm: true,
  },
  evening_tcm: {
    hour: 19,
    periodIndex: 2,
    label: "晚上中藥（餐後一小時）",
    onlyTcm: true,
  },
};

function parseReminderSlot(raw: string | null): ReminderSlot | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "day" ||
    normalized === "morning" ||
    normalized === "noon" ||
    normalized === "evening" ||
    normalized === "bedtime" ||
    normalized === "morning_tcm" ||
    normalized === "noon_tcm" ||
    normalized === "evening_tcm"
  ) {
    return normalized;
  }
  return null;
}

function filterMedsForSlot(
  meds: { name: string; id: string; baseId: string; dose: string }[],
  slot: Exclude<ReminderSlot, "day">
): { name: string; id: string; baseId: string; dose: string }[] {
  const onlyTcm = !!MEDS_SLOT_CONFIG[slot].onlyTcm;
  return meds.filter((m) => (onlyTcm ? m.baseId === "tcm" : m.baseId !== "tcm"));
}

type ReminderMedRow = { name: string; id: string; baseId: string; dose: string };
type ReminderTimingGroup = {
  timing: string;
  meds: ReminderMedRow[];
};

function filterMedsByDay(meds: MedItem[], currentDay: number): MedItem[] {
  if (currentDay >= 1 && currentDay <= 7) return meds;
  return meds.filter((m) => m.baseId === "tcm");
}

function getTimingGroupsForPeriod(
  periodIndex: number,
  currentDay: number,
  slot: Exclude<ReminderSlot, "day">
): ReminderTimingGroup[] {
  const period = scheduleData[periodIndex];
  if (!period) return [];
  const out: ReminderTimingGroup[] = [];
  for (const timingSlot of period.slots) {
    const meds = filterMedsForSlot(
      filterMedsByDay(timingSlot.meds, currentDay).map((m) => ({
        name: m.name,
        id: m.id,
        baseId: m.baseId,
        dose: m.dose,
      })),
      slot
    );
    if (meds.length > 0) {
      out.push({ timing: timingSlot.timing, meds });
    }
  }
  return out;
}

function getTaiwanHour(): number {
  const now = new Date();
  return (now.getUTCHours() + 8) % 24;
}

function getTaiwanMinute(): number {
  return new Date().getUTCMinutes();
}

function parseHourMinute(raw: string | null): { hour: number; minute: number } | null {
  if (!raw) return null;
  const match = raw.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function isBeforeTaiwanTime(target: { hour: number; minute: number }): boolean {
  const currentHour = getTaiwanHour();
  const currentMinute = getTaiwanMinute();
  if (currentHour < target.hour) return true;
  if (currentHour > target.hour) return false;
  return currentMinute < target.minute;
}

function isAfterTaiwanTime(target: { hour: number; minute: number }): boolean {
  const currentHour = getTaiwanHour();
  const currentMinute = getTaiwanMinute();
  if (currentHour > target.hour) return true;
  if (currentHour < target.hour) return false;
  return currentMinute > target.minute;
}

function formatTaiwanDate(date: Date): string {
  const y = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
  }).format(date);
  const m = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
  }).format(date);
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    day: "2-digit",
  }).format(date);
  return `${y}-${m}-${d}`;
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

type MemoItem = {
  id?: string;
  title?: string;
  content?: string;
  scheduledDate?: string;
  updatedAt?: string;
};

function getTomorrowMemos(
  data: Awaited<ReturnType<typeof kvGetSharedData>>,
  twDate: string
): MemoItem[] {
  const tomorrow = shiftDate(twDate, 1);
  const memos = (Array.isArray(data?.memos) ? data?.memos : []) as MemoItem[];
  return memos
    .filter((m) => m.scheduledDate === tomorrow)
    .sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""));
}

function getPillPreviewUrl(baseId: string, baseUrl: string): string | null {
  const fileByBaseId: Record<string, string> = {
    allegra: "Allegra.png",
    creon: "Creon.png",
    emetrol: "EmetroL.png",
    folina: "Folina.png",
    loperam: "Loperam.png",
    panzolec: "Panzolec.png",
    ts1: "TS-1.jpg",
    traceton: "Traceton.png",
    xyzal: "XyzaL.png",
  };
  const file = fileByBaseId[baseId];
  if (!file) return null;
  return `${baseUrl}/pills/preview/${file}`;
}

function getOpenAppUrl(baseUrl: string): string {
  const liffId = process.env.LINE_LIFF_ID;
  if (liffId) return `line://app/${liffId}`;
  return `${baseUrl}/`;
}

function getOpenMemosUrl(baseUrl: string): string {
  const liffId = process.env.LINE_LIFF_ID;
  if (liffId) return `line://app/${liffId}?liff.state=%2Fmemos`;
  return `${baseUrl}/memos`;
}

type DayReminderCardPayload = {
  month: string;
  day: string;
  phaseLabel: string;
  stageLabel: string;
  title: string;
  content: string;
};

function buildDayReminderMessage(
  payload: DayReminderCardPayload,
  baseUrl: string
): LinePushMessage {
  const openAppUrl = getOpenAppUrl(baseUrl);
  return {
    type: "flex",
    altText: "🐾 今日療程提醒",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#14b8a6",
        paddingAll: "12px",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: "🐾 今日療程提醒",
            color: "#ffffff",
            weight: "bold",
            size: "md",
          },
          {
            type: "text",
            text: `${payload.month} 月 ${payload.day} 日`,
            color: "#ffffff",
            weight: "bold",
            size: "3xl",
          },
          {
            type: "text",
            text: payload.phaseLabel,
            color: "#ccfbf1",
            size: "sm",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "14px",
        contents: [
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "狀態",
                size: "xs",
                color: "#0f766e",
                weight: "bold",
                flex: 0,
              },
              {
                type: "text",
                text: payload.stageLabel,
                size: "sm",
                color: "#0f172a",
                weight: "bold",
                wrap: true,
              },
            ],
          },
          {
            type: "separator",
            color: "#d1d5db",
            margin: "sm",
          },
          {
            type: "text",
            text: "療程資訊",
            size: "xs",
            color: "#0f766e",
            weight: "bold",
            margin: "sm",
          },
          {
            type: "text",
            text: payload.title,
            wrap: true,
            size: "xl",
            color: "#0f172a",
            weight: "bold",
          },
          {
            type: "text",
            text: "今日重點",
            size: "xs",
            color: "#0f766e",
            weight: "bold",
            margin: "md",
          },
          {
            type: "text",
            text: payload.content,
            wrap: true,
            size: "md",
            color: "#334155",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#0f766e",
            action: {
              type: "uri",
              label: "開啟 App",
              uri: openAppUrl,
            },
          },
        ],
      },
    },
  };
}

function buildMemoPreReminderMessage(
  rows: MemoItem[],
  twDate: string,
  baseUrl: string
): LinePushMessage {
  const tomorrow = shiftDate(twDate, 1);
  const topRows = rows.slice(0, 5);
  const contents = topRows.flatMap((memo, idx) => {
    const title = memo.title?.trim() || "未命名";
    const content = memo.content?.trim() || "";
    const preview = content.length > 80 ? `${content.slice(0, 80)}...` : content;
    const block: Record<string, unknown>[] = [
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        backgroundColor: "#fff7ed",
        cornerRadius: "8px",
        paddingAll: "10px",
        contents: [
          {
            type: "text",
            text: `預約 ${idx + 1}`,
            size: "xs",
            color: "#b45309",
            weight: "bold",
          },
          {
            type: "text",
            text: title,
            wrap: true,
            size: "md",
            color: "#1f2937",
            weight: "bold",
          },
          ...(preview
            ? [
                {
                  type: "text",
                  text: preview,
                  wrap: true,
                  size: "sm",
                  color: "#475569",
                },
              ]
            : []),
          {
            type: "text",
            text: `日期：${memo.scheduledDate || tomorrow}`,
            wrap: true,
            size: "sm",
            color: "#92400e",
            weight: "bold",
          },
        ],
      },
    ];
    if (idx < topRows.length - 1) block.push({ type: "separator", margin: "md" });
    return block;
  });

  return {
    type: "flex",
    altText: `備忘提前提醒（${topRows.length} 則）喵～`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#f59e0b",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "⏰ 備忘錄提前提醒",
            color: "#ffffff",
            weight: "bold",
            size: "lg",
          },
          {
            type: "text",
            text: `明天（${tomorrow}）有 ${rows.length} 則預約`,
            color: "#fef3c7",
            size: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#d97706",
            action: {
              type: "uri",
              label: "開啟備忘錄",
              uri: getOpenMemosUrl(baseUrl),
            },
          },
        ],
      },
    },
  };
}

function buildMedsReminderMessage(
  periodLabel: string,
  groups: {
    timing: string;
    meds: { name: string; dose: string; baseId: string }[];
    checkToken: string;
  }[],
  baseUrl: string
): LinePushMessage {
  const openAppUrl = getOpenAppUrl(baseUrl);
  const medBlocks = groups.flatMap((group, idx) => {
    const medLines = group.meds.map((med) => {
      const previewUrl = getPillPreviewUrl(med.baseId, baseUrl);
      const symbol = previewUrl ? "💊" : "🥣";
      return `${symbol} ${med.name}（${med.dose}）`;
    });
    const block: Record<string, unknown>[] = [
      {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: `🕒 ${group.timing}`,
            wrap: true,
            size: "md",
            weight: "bold",
            color: "#0f766e",
          },
          {
            type: "text",
            text: medLines.join("\n"),
            wrap: true,
            size: "sm",
            color: "#334155",
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#14b8a6",
            action: {
              type: "postback",
              label: `已服用（${group.timing}）`,
              data: `check:${group.checkToken}`,
              displayText: `已標記 ${group.timing} 服用`,
            },
          },
        ],
      },
    ];
    if (idx < groups.length - 1) {
      block.push({ type: "separator", margin: "md" });
    }
    return block;
  });

  return {
    type: "flex",
    altText: `${periodLabel} 記得吃藥喵～`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#14b8a6",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: `🐾 ${periodLabel} 記得吃藥喵～`,
            color: "#ffffff",
            weight: "bold",
            size: "lg",
          },
          {
            type: "text",
            text: "點一下[已服用]，就能同步打勾喵～",
            color: "#ccfbf1",
            size: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: medBlocks,
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "link",
            action: {
              type: "uri",
              label: "開啟 App 看完整清單",
              uri: openAppUrl,
            },
          },
        ],
      },
    },
  };
}

async function pushWithRetry(
  target: string,
  messages: LinePushMessage[],
  retryCount = 1
): Promise<{ ok: boolean; error?: string; status?: number; responseText?: string; attempts: number }> {
  for (let i = 0; i <= retryCount; i++) {
    const result = await pushMessages(target, messages);
    if (result.ok) return { ...result, attempts: i + 1 };
    if (i < retryCount) {
      await new Promise((r) => setTimeout(r, 700));
    } else {
      return { ...result, attempts: i + 1 };
    }
  }
  return { ok: false, error: "push_failed", attempts: retryCount + 1 };
}

async function logReminder(
  level: "info" | "warn" | "error",
  event: string,
  slot: string | undefined,
  detail: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await kvPushReminderLog({
    ts: new Date().toISOString(),
    level,
    event,
    slot,
    detail,
    meta,
  });
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const qstashSignature = request.headers.get("upstash-signature");
  let authorized = false;

  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    authorized = true;
  }

  if (!authorized && qstashSignature && isQstashVerificationConfigured()) {
    const body = await request.text();
    authorized = await verifyQstashSignature(qstashSignature, body);
  }

  if (!authorized) {
    await logReminder("warn", "unauthorized", undefined, "cron auth mismatch", {
      hasBearer: !!auth,
      hasQstashSignature: !!qstashSignature,
      qstashVerifyEnabled: isQstashVerificationConfigured(),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLineMessagingConfigured()) {
    await logReminder("warn", "skipped", undefined, "line_not_configured");
    return NextResponse.json({ ok: true, skipped: "line_not_configured" });
  }

  const data = await kvGetSharedData();
  const targets = [
    ...(data?.lineUserIds ?? []),
    ...(data?.lineGroupIds ?? []),
  ];
  if (targets.length === 0) {
    await logReminder("warn", "skipped", undefined, "no_target");
    return NextResponse.json({ ok: true, skipped: "no_target" });
  }

  const twHour = getTaiwanHour();
  const slotFromQuery = parseReminderSlot(request.nextUrl.searchParams.get("slot"));
  const notBeforeRaw = request.nextUrl.searchParams.get("notBefore");
  const notBefore = parseHourMinute(notBeforeRaw);
  const notAfterRaw = request.nextUrl.searchParams.get("notAfter");
  const notAfter = parseHourMinute(notAfterRaw);
  const slotRaw = request.nextUrl.searchParams.get("slot");
  if (slotRaw && !slotFromQuery) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_slot",
        allowed: [
          "day",
          "morning",
          "noon",
          "evening",
          "bedtime",
          "morning_tcm",
          "noon_tcm",
          "evening_tcm",
        ],
      },
      { status: 400 }
    );
  }
  if (notBeforeRaw && !notBefore) {
    return NextResponse.json(
      { ok: false, error: "invalid_not_before", expected: "HH:MM" },
      { status: 400 }
    );
  }
  if (notAfterRaw && !notAfter) {
    return NextResponse.json(
      { ok: false, error: "invalid_not_after", expected: "HH:MM" },
      { status: 400 }
    );
  }
  const twDate = formatTaiwanDate(new Date());
  const baseUrl = request.nextUrl.origin;
  const slotByHour: ReminderSlot | null =
    twHour === 8
      ? "day"
      : (Object.entries(MEDS_SLOT_CONFIG).find(
          ([, config]) => config.hour === twHour
        )?.[0] as Exclude<ReminderSlot, "day"> | undefined) ?? null;
  const selectedSlot = slotFromQuery ?? slotByHour;
  const runId = request.nextUrl.searchParams.get("runId") ?? "runtime";
  const shouldReset = request.nextUrl.searchParams.get("reset") === "1";

  if (shouldReset) {
    const resetKeys = selectedSlot
      ? [selectedSlot === "day" ? `day:${twDate}` : `meds:${twDate}:${selectedSlot}`]
      : [
          `day:${twDate}`,
          `meds:${twDate}:morning`,
          `meds:${twDate}:noon`,
          `meds:${twDate}:evening`,
          `meds:${twDate}:bedtime`,
          `meds:${twDate}:morning_tcm`,
          `meds:${twDate}:noon_tcm`,
          `meds:${twDate}:evening_tcm`,
        ];
    await Promise.all(resetKeys.map((key) => kvClearReminderSent(key)));
    await logReminder("info", "reset", selectedSlot ?? "all", "dedupe_reset", {
      resetKeys,
      twDate,
      runId,
    });
    return NextResponse.json({
      ok: true,
      type: "reset",
      slot: selectedSlot ?? "all",
      count: resetKeys.length,
      keys: resetKeys,
    });
  }

  if (notBefore && selectedSlot && isBeforeTaiwanTime(notBefore)) {
    await logReminder("info", "skipped", selectedSlot, "too_early", {
      notBefore: notBeforeRaw ?? "",
      twHour,
      twMinute: getTaiwanMinute(),
    });
    return NextResponse.json({
      ok: true,
      skipped: "too_early",
      slot: selectedSlot,
      notBefore: notBeforeRaw,
      nowTaiwan: `${String(twHour).padStart(2, "0")}:${String(getTaiwanMinute()).padStart(2, "0")}`,
    });
  }

  if (notAfter && selectedSlot && isAfterTaiwanTime(notAfter)) {
    await logReminder("info", "skipped", selectedSlot, "too_late", {
      notAfter: notAfterRaw ?? "",
      twHour,
      twMinute: getTaiwanMinute(),
    });
    return NextResponse.json({
      ok: true,
      skipped: "too_late",
      slot: selectedSlot,
      notAfter: notAfterRaw,
      nowTaiwan: `${String(twHour).padStart(2, "0")}:${String(getTaiwanMinute()).padStart(2, "0")}`,
    });
  }

  // 8am 每日階段提醒
  if (selectedSlot === "day") {
    const dedupeKey = `day:${twDate}`;
    if (await kvWasReminderSent(dedupeKey)) {
      await logReminder("info", "skipped", "day", "already_sent_day", { dedupeKey });
      return NextResponse.json({ ok: true, skipped: "already_sent_day" });
    }

    const config = data?.treatment
      ? migrateLegacyConfig(data.treatment as Parameters<typeof migrateLegacyConfig>[0])
      : null;
    const progress = config ? getCurrentProgress(config) : null;

    const twDateParts = twDate.split("-");
    const m = twDateParts[1];
    const d = twDateParts[2];
    let payload: DayReminderCardPayload = {
      month: m,
      day: d,
      phaseLabel: "尚未設定療程",
      stageLabel: "待設定",
      title: "請先到 App 設定打針日",
      content: "設定完成後，這裡會顯示每日療程與用藥提醒。",
    };

    if (progress?.status === "in_cycle" && progress.todayInfo) {
      const info = progress.todayInfo;
      payload = {
        month: m,
        day: d,
        phaseLabel: `${info.phaseLabel}`,
        stageLabel: `第 ${info.cycle} 次療程 · 第 ${info.day} 天`,
        title: info.title,
        content: info.content,
      };
    } else if (progress?.status === "waiting_next") {
      payload = {
        month: m,
        day: d,
        phaseLabel: "等待下次回診",
        stageLabel: `第 ${progress.cycle} 次療程已結束`,
        title: "本次療程已完成",
        content: "目前為等待下一次回診階段，請持續留意備忘錄與醫師安排。",
      };
    } else if (progress?.status === "completed") {
      payload = {
        month: m,
        day: d,
        phaseLabel: "療程完成",
        stageLabel: "全部療程已完成",
        title: "辛苦了，療程已全部完成",
        content: "請依照醫囑持續追蹤日常照護，必要時安排回診。",
      };
    }

    const flexMessage = buildDayReminderMessage(payload, baseUrl);
    const tomorrowMemos = getTomorrowMemos(data, twDate);
    const messages: LinePushMessage[] =
      tomorrowMemos.length > 0
        ? [flexMessage, buildMemoPreReminderMessage(tomorrowMemos, twDate, baseUrl)]
        : [flexMessage];
    const results = await Promise.all(
      targets.map((t) => pushWithRetry(t, messages, 1))
    );
    const failed = results.filter((r) => !r.ok).length;
    if (failed < targets.length) {
      await kvMarkReminderSent(dedupeKey);
    }
    await logReminder(
      failed === targets.length ? "error" : failed > 0 ? "warn" : "info",
      "send_day",
      "day",
      failed === 0 ? "sent_ok" : "sent_partial_or_failed",
      {
        dedupeKey,
        failed,
        total: targets.length,
        failures: results
          .filter((r) => !r.ok)
          .map((r) => ({ error: r.error, status: r.status, responseText: r.responseText })),
      }
    );
    return NextResponse.json({
      ok: true,
      type: "day",
      slot: "day",
      failed,
      total: targets.length,
    });
  }

  // 用藥提醒 7, 12, 18, 21
  if (!selectedSlot) {
    await logReminder("info", "skipped", undefined, "no_match", { twHour });
    return NextResponse.json({ ok: true, skipped: "no_match", twHour });
  }
  const reminder = MEDS_SLOT_CONFIG[selectedSlot as Exclude<ReminderSlot, "day">];

  const dedupeKey = `meds:${twDate}:${selectedSlot}`;
  if (await kvWasReminderSent(dedupeKey)) {
    await logReminder("info", "skipped", selectedSlot, "already_sent_meds", { dedupeKey });
    return NextResponse.json({ ok: true, skipped: "already_sent_meds" });
  }

  const config = data?.treatment
    ? migrateLegacyConfig(data.treatment as Parameters<typeof migrateLegacyConfig>[0])
    : null;
  const progress = config ? getCurrentProgress(config) : null;
  const currentDay = progress?.day ?? 1;

  const timingGroups = getTimingGroupsForPeriod(
    reminder.periodIndex,
    currentDay,
    selectedSlot as Exclude<ReminderSlot, "day">
  );
  const meds = timingGroups.flatMap((g) => g.meds);
  if (meds.length === 0) {
    await logReminder("info", "skipped", selectedSlot, "no_meds", {
      periodIndex: reminder.periodIndex,
      currentDay,
    });
    return NextResponse.json({ ok: true, skipped: "no_meds" });
  }

  const today = twDate;
  const reminderGroups: {
    timing: string;
    meds: { name: string; dose: string; baseId: string }[];
    checkToken: string;
  }[] = [];

  for (const group of timingGroups) {
    const checkToken = randomBytes(16).toString("hex");
    await kvSetCheckToken(
      checkToken,
      group.meds.map((med) => med.id),
      today
    );
    reminderGroups.push({
      timing: group.timing,
      meds: group.meds.map((med) => ({
        name: med.name,
        dose: med.dose,
        baseId: med.baseId,
      })),
      checkToken,
    });
  }

  const flexMessage = buildMedsReminderMessage(
    reminder.label,
    reminderGroups,
    baseUrl
  );
  const results = await Promise.all(
    targets.map((t) => pushWithRetry(t, [flexMessage], 1))
  );
  const failed = results.filter((r) => !r.ok).length;

  if (failed < targets.length) {
    await kvMarkReminderSent(dedupeKey);
  }
  await logReminder(
    failed === targets.length ? "error" : failed > 0 ? "warn" : "info",
    "send_meds",
    selectedSlot,
    failed === 0 ? "sent_ok" : "sent_partial_or_failed",
    {
      dedupeKey,
      medsCount: meds.length,
      failed,
      total: targets.length,
      failures: results
        .filter((r) => !r.ok)
        .map((r) => ({ error: r.error, status: r.status, responseText: r.responseText })),
    }
  );
  if (failed === targets.length) {
    return NextResponse.json(
      {
        ok: false,
        error: results.find((r) => !r.ok)?.error ?? "push_failed",
        status: results.find((r) => !r.ok)?.status,
        responseText: results.find((r) => !r.ok)?.responseText,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    type: "meds",
    slot: selectedSlot,
    count: meds.length,
    failed,
    total: targets.length,
  });
}
