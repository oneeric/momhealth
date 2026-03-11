/**
 * 排程提醒 API（由 GitHub Actions 觸發）
 * 每日 8 點階段提醒 + 用藥時間提醒
 * 台灣時間：8:00, 7:00, 12:00, 18:00, 21:00 (UTC: 0:00, 23:00, 4:00, 10:00, 13:00)
 */
import { NextRequest, NextResponse } from "next/server";
import {
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
import { getMedsForPeriod } from "@/lib/medication-schedule";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

type ReminderSlot = "day" | "morning" | "noon" | "evening" | "bedtime";

const MEDS_SLOT_CONFIG: Record<
  Exclude<ReminderSlot, "day">,
  { hour: number; periodIndex: number; label: string }
> = {
  morning: { hour: 7, periodIndex: 0, label: "早上" },
  noon: { hour: 12, periodIndex: 1, label: "中午" },
  evening: { hour: 18, periodIndex: 2, label: "晚上" },
  bedtime: { hour: 21, periodIndex: 3, label: "睡前" },
};

function parseReminderSlot(raw: string | null): ReminderSlot | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "day" ||
    normalized === "morning" ||
    normalized === "noon" ||
    normalized === "evening" ||
    normalized === "bedtime"
  ) {
    return normalized;
  }
  return null;
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

function buildDayReminderMessage(msg: string, baseUrl: string): LinePushMessage {
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
        contents: [
          {
            type: "text",
            text: "🐾 今日療程提醒",
            color: "#ffffff",
            weight: "bold",
            size: "lg",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: msg,
            wrap: true,
            size: "md",
            color: "#0f172a",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
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
        contents: topRows.map((memo) => ({
          type: "text",
          text: `• ${memo.title || "未命名"}${memo.content ? `\n${memo.content}` : ""}`,
          wrap: true,
          size: "md",
          color: "#1f2937",
        })),
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
  rows: { name: string; dose: string; baseId: string; checkToken: string }[],
  baseUrl: string
): LinePushMessage {
  const openAppUrl = getOpenAppUrl(baseUrl);
  const medBlocks = rows.flatMap((row, idx) => {
    const previewUrl = getPillPreviewUrl(row.baseId, baseUrl);
    const symbol = previewUrl ? "💊" : "🥣";
    const block: Record<string, unknown>[] = [
      {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: `${symbol} ${row.name}`,
            wrap: true,
            size: "md",
            weight: "bold",
            color: "#0f172a",
          },
          {
            type: "text",
            text: `劑量：${row.dose}`,
            wrap: true,
            size: "sm",
            color: "#475569",
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#14b8a6",
            action: {
              type: "postback",
              label: "已服用喵～",
              data: `check:${row.checkToken}`,
              displayText: `已標記 ${row.name} 服用`,
            },
          },
        ],
      },
    ];
    if (idx < rows.length - 1) {
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
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      await logReminder("warn", "unauthorized", undefined, "cron auth mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
  const slotRaw = request.nextUrl.searchParams.get("slot");
  if (slotRaw && !slotFromQuery) {
    return NextResponse.json(
      { ok: false, error: "invalid_slot", allowed: ["day", "morning", "noon", "evening", "bedtime"] },
      { status: 400 }
    );
  }
  if (notBeforeRaw && !notBefore) {
    return NextResponse.json(
      { ok: false, error: "invalid_not_before", expected: "HH:MM" },
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

  // #region agent log
  fetch("http://127.0.0.1:7851/ingest/bc759da1-5ba7-455d-8615-ba18f0b7c29c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "0dbab7",
    },
    body: JSON.stringify({
      sessionId: "0dbab7",
      runId,
      hypothesisId: "H1",
      location: "app/api/cron/reminder/route.ts:selectedSlot",
      message: "cron_entry",
      data: {
        twHour,
        twMinute: getTaiwanMinute(),
        slotRaw,
        slotFromQuery,
        slotByHour,
        selectedSlot,
        notBeforeRaw,
        targetsCount: targets.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (notBefore && selectedSlot && isBeforeTaiwanTime(notBefore)) {
    // #region agent log
    fetch("http://127.0.0.1:7851/ingest/bc759da1-5ba7-455d-8615-ba18f0b7c29c", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0dbab7",
      },
      body: JSON.stringify({
        sessionId: "0dbab7",
        runId,
        hypothesisId: "H2",
        location: "app/api/cron/reminder/route.ts:too_early",
        message: "skip_too_early",
        data: {
          selectedSlot,
          notBeforeRaw,
          twHour,
          twMinute: getTaiwanMinute(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
    let msg = `📅 今天是 ${m} 月 ${d} 日\n\n`;

    if (progress?.status === "in_cycle" && progress.todayInfo) {
      const info = progress.todayInfo;
      msg += `第 ${info.cycle} 次療程 · 第 ${info.day} 天\n`;
      msg += `階段：${info.phaseLabel}\n\n`;
      msg += `${info.title}\n${info.content}`;
    } else if (progress?.status === "waiting_next") {
      msg += `第 ${progress.cycle} 次療程已結束，等待下一次回診`;
    } else if (progress?.status === "completed") {
      msg += `療程已全部完成 🎉`;
    } else {
      msg += `請在 App 設定療程打針日以開始追蹤`;
    }

    const flexMessage = buildDayReminderMessage(msg, baseUrl);
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

  const meds = getMedsForPeriod(reminder.periodIndex, currentDay);
  if (meds.length === 0) {
    await logReminder("info", "skipped", selectedSlot, "no_meds", {
      periodIndex: reminder.periodIndex,
      currentDay,
    });
    return NextResponse.json({ ok: true, skipped: "no_meds" });
  }

  // #region agent log
  fetch("http://127.0.0.1:7851/ingest/bc759da1-5ba7-455d-8615-ba18f0b7c29c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "0dbab7",
    },
    body: JSON.stringify({
      sessionId: "0dbab7",
      runId,
      hypothesisId: "H3",
      location: "app/api/cron/reminder/route.ts:meds_prepare",
      message: "meds_prepare",
      data: {
        selectedSlot,
        dedupeKey,
        medsCount: meds.length,
        currentDay,
        targetCount: targets.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const today = twDate;
  const reminderRows: {
    name: string;
    dose: string;
    baseId: string;
    checkToken: string;
  }[] = [];

  for (const med of meds) {
    const checkToken = randomBytes(16).toString("hex");
    await kvSetCheckToken(checkToken, med.id, today);
    reminderRows.push({
      name: med.name,
      dose: med.dose,
      baseId: med.baseId,
      checkToken,
    });
  }

  const flexMessage = buildMedsReminderMessage(
    reminder.label,
    reminderRows,
    baseUrl
  );
  const results = await Promise.all(
    targets.map((t) => pushWithRetry(t, [flexMessage], 1))
  );
  const failed = results.filter((r) => !r.ok).length;

  // #region agent log
  fetch("http://127.0.0.1:7851/ingest/bc759da1-5ba7-455d-8615-ba18f0b7c29c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "0dbab7",
    },
    body: JSON.stringify({
      sessionId: "0dbab7",
      runId,
      hypothesisId: "H4",
      location: "app/api/cron/reminder/route.ts:meds_results",
      message: "meds_send_results",
      data: {
        selectedSlot,
        failed,
        total: targets.length,
        statuses: results.map((r) => ({
          ok: r.ok,
          status: r.status ?? null,
          error: r.error ?? null,
        })),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7851/ingest/bc759da1-5ba7-455d-8615-ba18f0b7c29c", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0dbab7",
      },
      body: JSON.stringify({
        sessionId: "0dbab7",
        runId,
        hypothesisId: "H5",
        location: "app/api/cron/reminder/route.ts:meds_all_failed",
        message: "meds_all_failed",
        data: {
          selectedSlot,
          dedupeKey,
          firstFailure: results.find((r) => !r.ok)
            ? {
                status: results.find((r) => !r.ok)?.status ?? null,
                error: results.find((r) => !r.ok)?.error ?? null,
                responseText: results.find((r) => !r.ok)?.responseText ?? null,
              }
            : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
