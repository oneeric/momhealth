/**
 * 排程提醒 API（由 GitHub Actions 觸發）
 * 每日 8 點階段提醒 + 用藥時間提醒
 * 台灣時間：8:00, 7:00, 12:00, 18:00, 21:00 (UTC: 0:00, 23:00, 4:00, 10:00, 13:00)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  kvGetSharedData,
  kvMarkReminderSent,
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
    altText: "今日療程提醒",
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
            text: "今日療程提醒",
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
    altText: `明日預約提醒（${topRows.length} 則）`,
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
            text: "⏰ 前一日預約提醒",
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
    const titleRow: Record<string, unknown> = {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        ...(previewUrl
          ? [
              {
                type: "icon",
                url: previewUrl,
                size: "md",
              },
            ]
          : [
              {
                type: "text",
                text: "🥣",
                size: "md",
                flex: 0,
              },
            ]),
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: row.name,
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
          ],
        },
      ],
    };
    const block: Record<string, unknown>[] = [
      {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          titleRow,
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#14b8a6",
            action: {
              type: "postback",
              label: "已服用",
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
    altText: `${periodLabel} 用藥提醒`,
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
            text: `💊 ${periodLabel} 用藥提醒`,
            color: "#ffffff",
            weight: "bold",
            size: "lg",
          },
          {
            type: "text",
            text: "點擊下方按鈕即可同步打勾",
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
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i <= retryCount; i++) {
    const result = await pushMessages(target, messages);
    if (result.ok) return result;
    if (i < retryCount) {
      await new Promise((r) => setTimeout(r, 700));
    } else {
      return result;
    }
  }
  return { ok: false, error: "push_failed" };
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isLineMessagingConfigured()) {
    return NextResponse.json({ ok: true, skipped: "line_not_configured" });
  }

  const data = await kvGetSharedData();
  const targets = [
    ...(data?.lineUserIds ?? []),
    ...(data?.lineGroupIds ?? []),
  ];
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_target" });
  }

  const twHour = getTaiwanHour();
  const slotFromQuery = parseReminderSlot(request.nextUrl.searchParams.get("slot"));
  const slotRaw = request.nextUrl.searchParams.get("slot");
  if (slotRaw && !slotFromQuery) {
    return NextResponse.json(
      { ok: false, error: "invalid_slot", allowed: ["day", "morning", "noon", "evening", "bedtime"] },
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

  // 8am 每日階段提醒
  if (selectedSlot === "day") {
    const dedupeKey = `day:${twDate}`;
    if (await kvWasReminderSent(dedupeKey)) {
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
    return NextResponse.json({ ok: true, skipped: "no_match", twHour });
  }
  const reminder = MEDS_SLOT_CONFIG[selectedSlot as Exclude<ReminderSlot, "day">];

  const dedupeKey = `meds:${twDate}:${selectedSlot}`;
  if (await kvWasReminderSent(dedupeKey)) {
    return NextResponse.json({ ok: true, skipped: "already_sent_meds" });
  }

  const config = data?.treatment
    ? migrateLegacyConfig(data.treatment as Parameters<typeof migrateLegacyConfig>[0])
    : null;
  const progress = config ? getCurrentProgress(config) : null;
  const currentDay = progress?.day ?? 1;

  const meds = getMedsForPeriod(reminder.periodIndex, currentDay);
  if (meds.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_meds" });
  }

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
  if (failed < targets.length) {
    await kvMarkReminderSent(dedupeKey);
  }
  if (failed === targets.length) {
    return NextResponse.json(
      { ok: false, error: results.find((r) => !r.ok)?.error ?? "push_failed" },
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
