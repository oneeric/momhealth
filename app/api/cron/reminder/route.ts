/**
 * 排程提醒 API（由 GitHub Actions 觸發）
 * 每日 8 點階段提醒 + 用藥時間提醒
 * 台灣時間：8:00, 7:00, 12:00, 18:00, 21:00 (UTC: 0:00, 23:00, 4:00, 10:00, 13:00)
 */
import { NextRequest, NextResponse } from "next/server";
import { kvGetSharedData, kvSetCheckToken } from "@/lib/kv";
import {
  isLineMessagingConfigured,
  pushMessages,
  type LinePushMessage,
} from "@/lib/line-messaging";
import { getCurrentProgress, migrateLegacyConfig } from "@/lib/treatment";
import {
  REMINDER_TIMES,
  getMedsForPeriod,
} from "@/lib/medication-schedule";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function getTaiwanHour(): number {
  const now = new Date();
  return (now.getUTCHours() + 8) % 24;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function buildDayReminderMessage(msg: string): LinePushMessage {
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
            size: "md",
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
            size: "sm",
            color: "#0f172a",
          },
        ],
      },
    },
  };
}

function buildMedsReminderMessage(
  periodLabel: string,
  rows: { name: string; dose: string; baseId: string; checkUrl: string }[],
  baseUrl: string
): LinePushMessage {
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
              size: "sm",
              weight: "bold",
              color: "#0f172a",
            },
            {
              type: "text",
              text: `劑量：${row.dose}`,
              wrap: true,
              size: "xs",
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
              type: "uri",
              label: "打勾",
              uri: row.checkUrl,
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
            size: "md",
          },
          {
            type: "text",
            text: "點擊下方按鈕即可同步打勾",
            color: "#ccfbf1",
            size: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: medBlocks,
      },
    },
  };
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
  const baseUrl = request.nextUrl.origin;

  // 8am 每日階段提醒
  if (twHour === 8) {
    const config = data?.treatment
      ? migrateLegacyConfig(data.treatment as Parameters<typeof migrateLegacyConfig>[0])
      : null;
    const progress = config ? getCurrentProgress(config) : null;

    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
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

    const flexMessage = buildDayReminderMessage(msg);
    const results = await Promise.all(
      targets.map((t) => pushMessages(t, [flexMessage]))
    );
    const failed = results.filter((r) => !r.ok).length;
    return NextResponse.json({ ok: true, type: "day", failed, total: targets.length });
  }

  // 用藥提醒 7, 12, 18, 21
  const reminder = REMINDER_TIMES.find((r) => r.hour === twHour);
  if (!reminder) {
    return NextResponse.json({ ok: true, skipped: "no_match" });
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

  const today = formatDate(new Date());
  const reminderRows: {
    name: string;
    dose: string;
    baseId: string;
    checkUrl: string;
  }[] = [];

  for (const med of meds) {
    const checkToken = randomBytes(16).toString("hex");
    await kvSetCheckToken(checkToken, med.id, today);
    const checkUrl = `${baseUrl}/api/check?t=${checkToken}`;
    reminderRows.push({
      name: med.name,
      dose: med.dose,
      baseId: med.baseId,
      checkUrl,
    });
  }

  const flexMessage = buildMedsReminderMessage(
    reminder.label,
    reminderRows,
    baseUrl
  );
  const results = await Promise.all(
    targets.map((t) => pushMessages(t, [flexMessage]))
  );
  const failed = results.filter((r) => !r.ok).length;
  if (failed === targets.length) {
    return NextResponse.json(
      { ok: false, error: results.find((r) => !r.ok)?.error ?? "push_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    type: "meds",
    count: meds.length,
    failed,
    total: targets.length,
  });
}
