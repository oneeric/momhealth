/**
 * LINE Webhook:
 * - 驗簽
 * - 關鍵字綁定/解除綁定 userId / groupId
 * - 關鍵字指令（狀態、幫助、開啟 App、今日）
 * - postback 打勾回寫
 */
import { NextRequest, NextResponse } from "next/server";
import {
  kvGetAndDeleteCheckToken,
  kvGetSharedData,
  kvSetCheckToken,
  kvSetSharedData,
} from "@/lib/kv";
import {
  replyMessages,
  replyTextMessage,
  type LinePushMessage,
  verifyLineSignature,
} from "@/lib/line-messaging";
import { getCurrentProgress, migrateLegacyConfig } from "@/lib/treatment";
import { scheduleData, type MedItem } from "@/lib/medication-data";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

type LineEvent = {
  type: string;
  message?: {
    type?: string;
    text?: string;
  };
  postback?: {
    data?: string;
  };
  source?: {
    type?: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
};

const BIND_KEYWORDS = ["綁定", "加入提醒", "綁定提醒", "/bind"];
const UNBIND_KEYWORDS = ["解除綁定", "取消綁定", "/unbind"];
const STATUS_KEYWORDS = ["狀態", "綁定狀態", "/status"];
const HELP_KEYWORDS = ["幫助", "help", "/help", "功能"];
const OPEN_APP_KEYWORDS = ["開啟app", "打開app", "/app", "momhealth"];
const TODAY_KEYWORDS = ["今日", "今天", "/today"];
const MEMO_KEYWORDS = ["備忘錄", "備註", "/memos", "memo"];
const TEST_MEDS_KEYWORDS = ["測試用藥", "用藥測試", "/testmeds"];

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function isInKeywords(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((k) => normalized === normalizeText(k));
}

function getOpenAppUrl(origin: string): string {
  const liffId = process.env.LINE_LIFF_ID;
  if (liffId) return `line://app/${liffId}`;
  return `${origin}/`;
}

function getOpenMemosUrl(origin: string): string {
  const liffId = process.env.LINE_LIFF_ID;
  if (liffId) {
    // Use LIFF deep link state to open the memos page in-app.
    return `line://app/${liffId}?liff.state=%2Fmemos`;
  }
  return `${origin}/memos`;
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

function getTaiwanHour(): number {
  const now = new Date();
  return (now.getUTCHours() + 8) % 24;
}

function filterMedsByDay(meds: MedItem[], currentDay: number): MedItem[] {
  if (currentDay >= 1 && currentDay <= 7) return meds;
  return meds.filter((m) => m.baseId === "tcm");
}

function getTodayMedIds(currentDay: number): string[] {
  const ids: string[] = [];
  scheduleData.forEach((period) => {
    period.slots.forEach((slot) => {
      filterMedsByDay(slot.meds, currentDay).forEach((m) => ids.push(m.id));
    });
  });
  return ids;
}

type MedTestGroup = {
  timing: string;
  meds: { id: string; name: string; dose: string }[];
  checkToken: string;
};

function selectTestPeriodLabel(text: string): { periodIndex: number; label: string } {
  const normalized = normalizeText(text);
  if (normalized.includes("早")) return { periodIndex: 0, label: "早上" };
  if (normalized.includes("中")) return { periodIndex: 1, label: "中午" };
  if (normalized.includes("晚")) return { periodIndex: 2, label: "晚上" };
  if (normalized.includes("睡")) return { periodIndex: 3, label: "睡前" };

  const hour = getTaiwanHour();
  if (hour < 10) return { periodIndex: 0, label: "早上" };
  if (hour < 15) return { periodIndex: 1, label: "中午" };
  if (hour < 20) return { periodIndex: 2, label: "晚上" };
  return { periodIndex: 3, label: "睡前" };
}

function getMedsGroupsForPeriod(
  periodIndex: number,
  currentDay: number
): { timing: string; meds: { id: string; name: string; dose: string }[] }[] {
  const period = scheduleData[periodIndex];
  if (!period) return [];
  const out: { timing: string; meds: { id: string; name: string; dose: string }[] }[] = [];
  period.slots.forEach((slot) => {
    const meds = filterMedsByDay(slot.meds, currentDay).map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
    }));
    if (meds.length > 0) {
      out.push({ timing: slot.timing, meds });
    }
  });
  return out;
}

function buildTodayFlexMessage(
  data: Awaited<ReturnType<typeof kvGetSharedData>>,
  origin: string
): LinePushMessage {
  const config = data?.treatment
    ? migrateLegacyConfig(data.treatment as Parameters<typeof migrateLegacyConfig>[0])
    : null;
  const progress = config ? getCurrentProgress(config) : null;
  const now = new Date();
  const todayKey = formatTaiwanDate(now);
  const m = now.getMonth() + 1;
  const d = now.getDate();

  let phaseLabel = "尚未設定療程";
  let stageLabel = "待設定";
  let title = "請先到 App 設定打針日";
  let content = "設定完成後，這裡會顯示每日療程與用藥提醒。";

  if (progress?.status === "in_cycle" && progress.todayInfo) {
    phaseLabel = progress.todayInfo.phaseLabel;
    stageLabel = `第 ${progress.todayInfo.cycle} 次療程 · 第 ${progress.todayInfo.day} 天`;
    title = progress.todayInfo.title;
    content = progress.todayInfo.content;
  } else if (progress?.status === "waiting_next") {
    phaseLabel = "等待下次回診";
    stageLabel = `第 ${progress.cycle} 次療程已結束`;
    title = "本次療程已完成";
    content = "目前為等待下一次回診階段，請持續留意備忘錄與醫師安排。";
  } else if (progress?.status === "completed") {
    phaseLabel = "療程完成";
    stageLabel = "全部療程已完成";
    title = "辛苦了，療程已全部完成";
    content = "請依照醫囑持續追蹤日常照護，必要時安排回診。";
  }

  const currentDay = progress?.day ?? 1;
  const todayMedIds = getTodayMedIds(currentDay);
  const todayRecords = data?.medRecords?.[todayKey] ?? {};
  const checkedCount = todayMedIds.filter((id) => !!todayRecords[id]).length;
  const totalCount = todayMedIds.length;
  const completionRate =
    totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const scheduledMemos = getScheduledMemos(data)
    .filter((m) => (m.scheduledDate ?? "") >= todayKey)
    .slice(0, 3);

  return {
    type: "flex",
    altText: `今天 ${m}/${d} 療程提醒喵～`,
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
            text: `${m} 月 ${d} 日`,
            color: "#ffffff",
            weight: "bold",
            size: "3xl",
          },
          {
            type: "text",
            text: phaseLabel,
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
                text: stageLabel,
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
            text: title,
            weight: "bold",
            size: "xl",
            color: "#0f172a",
            wrap: true,
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
            text: content,
            size: "md",
            color: "#334155",
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            backgroundColor: "#f0fdfa",
            cornerRadius: "8px",
            paddingAll: "10px",
            margin: "md",
            contents: [
              {
                type: "text",
                text: "服藥進度",
                size: "sm",
                color: "#0f766e",
                weight: "bold",
              },
              {
                type: "text",
                text: `${completionRate}% (${checkedCount}/${totalCount})`,
                size: "xl",
                color: "#0f172a",
                weight: "bold",
              },
              {
                type: "text",
                text:
                  totalCount > 0
                    ? checkedCount >= totalCount
                      ? "今日用藥已全部完成喵～辛苦了！"
                      : `尚有 ${totalCount - checkedCount} 項待完成`
                    : "今日無需服藥項目",
                size: "sm",
                color: "#475569",
                wrap: true,
              },
            ],
          },
          ...(scheduledMemos.length > 0
            ? [
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "xs",
                  backgroundColor: "#f8fafc",
                  cornerRadius: "8px",
                  paddingAll: "10px",
                  margin: "md",
                  contents: [
                    {
                      type: "text",
                      text: "近期預約",
                      size: "sm",
                      color: "#0f766e",
                      weight: "bold",
                    },
                    ...scheduledMemos.map((memo) => ({
                      type: "text",
                      text: `• ${memo.scheduledDate} ${memo.title || "未命名"}`,
                      size: "sm",
                      color: "#334155",
                      wrap: true,
                    })),
                  ],
                },
              ]
            : []),
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
              uri: getOpenAppUrl(origin),
            },
          },
        ],
      },
    },
  };
}

type MemoItem = {
  id?: string;
  title?: string;
  content?: string;
  scheduledDate?: string;
  updatedAt?: string;
};

function getScheduledMemos(
  data: Awaited<ReturnType<typeof kvGetSharedData>>
): MemoItem[] {
  const memos = (Array.isArray(data?.memos) ? data?.memos : []) as MemoItem[];
  return memos
    .filter((m) => !!m.scheduledDate)
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""));
}

function formatMemoDateLabel(raw?: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "未設定日期";
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day} (${weekdays[date.getDay()]})`;
}

function getMemoSortKey(raw?: string): string {
  const value = (raw ?? "").trim();
  return value || "9999-99-99";
}

function buildMemoCarouselMessage(
  data: Awaited<ReturnType<typeof kvGetSharedData>>,
  origin: string
): LinePushMessage {
  const memos = (Array.isArray(data?.memos) ? data?.memos : []) as MemoItem[];
  const sorted = [...memos].sort((a, b) => {
    const byDate = getMemoSortKey(a.scheduledDate).localeCompare(getMemoSortKey(b.scheduledDate));
    if (byDate !== 0) return byDate;
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  });
  const items = sorted.slice(0, 10);
  const openUrl = getOpenMemosUrl(origin);

  if (items.length === 0) {
    return {
      type: "flex",
      altText: "目前沒有備忘錄",
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
              text: "🗒 備忘錄",
              color: "#ffffff",
              weight: "bold",
              size: "lg",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "目前沒有備忘錄內容",
              weight: "bold",
              size: "md",
              color: "#0f172a",
            },
            {
              type: "text",
              text: "可在 App 新增預約或追蹤提醒項目。",
              wrap: true,
              size: "sm",
              color: "#334155",
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
                label: "開啟備忘錄",
                uri: openUrl,
              },
            },
          ],
        },
      },
    };
  }

  const bubbles = items.map((memo, idx) => {
    const title = memo.title?.trim() || "未命名";
    const content = memo.content?.trim() || "（無內容）";
    const preview = content.length > 120 ? `${content.slice(0, 120)}...` : content;
    const updatedAt = memo.updatedAt
      ? new Date(memo.updatedAt).toLocaleString("zh-TW", {
          hour12: false,
        })
      : "";
    const scheduledDate = memo.scheduledDate ?? "";
    const dateLabel = formatMemoDateLabel(scheduledDate);

    return {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#14b8a6",
        paddingAll: "10px",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: `📅 ${dateLabel}`,
            color: "#ffffff",
            weight: "bold",
            size: "2xl",
            wrap: true,
          },
          {
            type: "text",
            text: `備忘 ${idx + 1}`,
            color: "#ccfbf1",
            weight: "bold",
            size: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "標題",
            size: "xs",
            color: "#0f766e",
            weight: "bold",
          },
          {
            type: "text",
            text: title,
            wrap: true,
            weight: "bold",
            size: "lg",
            color: "#0f172a",
          },
          {
            type: "separator",
            color: "#d1d5db",
            margin: "sm",
          },
          {
            type: "text",
            text: "內容摘要",
            size: "xs",
            color: "#0f766e",
            weight: "bold",
            margin: "sm",
          },
          {
            type: "text",
            text: preview,
            wrap: true,
            size: "sm",
            color: "#334155",
          },
          {
            type: "text",
            text: `預約日：${scheduledDate || "未設定"}`,
            size: "sm",
            color: "#0f766e",
            wrap: true,
            margin: "md",
          },
          ...(updatedAt
            ? [
                {
                  type: "text",
                  text: `更新：${updatedAt}`,
                  size: "xs",
                  color: "#64748b",
                  wrap: true,
                },
              ]
            : []),
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
              label: "開啟備忘錄",
              uri: openUrl,
            },
          },
        ],
      },
    };
  });

  return {
    type: "flex",
    altText: `備忘錄（${items.length} 則）`,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
}

function buildMedsTestFlexMessage(
  periodLabel: string,
  groups: MedTestGroup[],
  origin: string
): LinePushMessage {
  const contents = groups.flatMap((group, idx) => {
    const medLines = group.meds.map((med) => `• ${med.name}（${med.dose}）`).join("\n");
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
            text: medLines,
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
    if (idx < groups.length - 1) block.push({ type: "separator", margin: "md" });
    return block;
  });

  return {
    type: "flex",
    altText: `測試：${periodLabel} 用藥提醒`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0f766e",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: `🧪 測試：${periodLabel} 用藥提醒`,
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
          {
            type: "text",
            text: "此訊息為手動測試，不影響定時排程。",
            color: "#99f6e4",
            size: "xs",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "link",
            action: {
              type: "uri",
              label: "開啟 App 看完整清單",
              uri: getOpenAppUrl(origin),
            },
          },
        ],
      },
    },
  };
}

async function markMedicationCheckedByToken(token: string): Promise<boolean> {
  const payload = await kvGetAndDeleteCheckToken(token);
  if (!payload) return false;
  const data = await kvGetSharedData();
  const medRecords = data?.medRecords ?? {};
  const dateRecords = medRecords[payload.date] ?? {};
  const updated = { ...dateRecords };
  for (const medId of payload.medIds) {
    updated[medId] = true;
  }
  await kvSetSharedData({
    medRecords: {
      ...medRecords,
      [payload.date]: updated,
    },
  });
  return true;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");
  if (!signature || !verifyLineSignature(body, signature)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: { events?: LineEvent[] } = {};
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const events = payload.events ?? [];
  const origin = request.nextUrl.origin;

  for (const event of events) {
    const data = await kvGetSharedData();
    const userIds = new Set(data?.lineUserIds ?? []);
    const groupIds = new Set(data?.lineGroupIds ?? []);
    const source = event.source;

    if (event.type === "postback" && event.postback?.data?.startsWith("check:")) {
      const token = event.postback.data.replace("check:", "");
      const ok = await markMedicationCheckedByToken(token);
      if (event.replyToken) {
        await replyTextMessage(
          event.replyToken,
          ok ? "已記錄這筆服藥，App 也同步更新了。" : "這筆打勾連結已失效或已處理。"
        );
      }
      continue;
    }

    // 非文字訊息不處理，避免群組聊天噪音
    if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) {
      continue;
    }

    const text = event.message.text?.trim() ?? "";
    if (!text) continue;

    if (isInKeywords(text, BIND_KEYWORDS)) {
      let changed = false;
      if (source?.type === "user" && source.userId && !userIds.has(source.userId)) {
        userIds.add(source.userId);
        changed = true;
      }
      if (source?.type === "group" && source.groupId && !groupIds.has(source.groupId)) {
        groupIds.add(source.groupId);
        changed = true;
      }
      if (changed) {
        await kvSetSharedData({
          lineUserIds: Array.from(userIds),
          lineGroupIds: Array.from(groupIds),
        });
      }
      await replyTextMessage(
        event.replyToken,
        changed
          ? "已綁定提醒喵～每天 8:00 會收到今日階段提醒，用藥時段也會推播喵～"
          : "目前已經綁定，不需要重複綁定。"
      );
      continue;
    }

    if (isInKeywords(text, UNBIND_KEYWORDS)) {
      let changed = false;
      if (source?.type === "user" && source.userId && userIds.has(source.userId)) {
        userIds.delete(source.userId);
        changed = true;
      }
      if (source?.type === "group" && source.groupId && groupIds.has(source.groupId)) {
        groupIds.delete(source.groupId);
        changed = true;
      }
      if (changed) {
        await kvSetSharedData({
          lineUserIds: Array.from(userIds),
          lineGroupIds: Array.from(groupIds),
        });
      }
      await replyTextMessage(
        event.replyToken,
        changed ? "已解除綁定提醒。" : "目前沒有綁定紀錄。"
      );
      continue;
    }

    if (isInKeywords(text, STATUS_KEYWORDS)) {
      await replyTextMessage(
        event.replyToken,
        `目前綁定對象共 ${userIds.size + groupIds.size} 個（個人 ${userIds.size}，群組 ${groupIds.size}）。`
      );
      continue;
    }

    if (isInKeywords(text, TODAY_KEYWORDS)) {
      const todayFlex = buildTodayFlexMessage(data, origin);
      await replyMessages(event.replyToken, [todayFlex]);
      continue;
    }

    if (isInKeywords(text, MEMO_KEYWORDS)) {
      const memoFlex = buildMemoCarouselMessage(data, origin);
      await replyMessages(event.replyToken, [memoFlex]);
      continue;
    }

    if (
      isInKeywords(text, TEST_MEDS_KEYWORDS) ||
      normalizeText(text).startsWith("測試用藥")
    ) {
      const config = data?.treatment
        ? migrateLegacyConfig(data.treatment as Parameters<typeof migrateLegacyConfig>[0])
        : null;
      const progress = config ? getCurrentProgress(config) : null;
      const currentDay = progress?.day ?? 1;
      const selected = selectTestPeriodLabel(text);
      const groups = getMedsGroupsForPeriod(selected.periodIndex, currentDay);
      const meds = groups.flatMap((group) => group.meds);
      if (meds.length === 0) {
        await replyTextMessage(
          event.replyToken,
          `測試完成：目前 ${selected.label} 時段沒有用藥項目。`
        );
        continue;
      }
      const today = formatTaiwanDate(new Date());
      const testGroups: MedTestGroup[] = [];
      for (const group of groups) {
        const token = randomBytes(16).toString("hex");
        await kvSetCheckToken(
          token,
          group.meds.map((med) => med.id),
          today
        );
        testGroups.push({
          timing: group.timing,
          meds: group.meds,
          checkToken: token,
        });
      }
      const flex = buildMedsTestFlexMessage(selected.label, testGroups, origin);
      await replyMessages(event.replyToken, [flex]);
      continue;
    }

    if (isInKeywords(text, OPEN_APP_KEYWORDS)) {
      await replyTextMessage(
        event.replyToken,
        `請點此開啟 App：${getOpenAppUrl(origin)}`
      );
      continue;
    }

    if (isInKeywords(text, HELP_KEYWORDS)) {
      await replyTextMessage(
        event.replyToken,
        "可用指令：\n- 綁定\n- 解除綁定\n- 狀態\n- 今日\n- 備忘錄\n- 測試用藥（可加：早上/中午/晚上/睡前）\n- 開啟App"
      );
      continue;
    }
  }
  const finalData = await kvGetSharedData();
  return NextResponse.json({
    ok: true,
    userCount: finalData?.lineUserIds?.length ?? 0,
    groupCount: finalData?.lineGroupIds?.length ?? 0,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "LINE webhook endpoint" });
}
