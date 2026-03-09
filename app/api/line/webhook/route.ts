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
  kvSetSharedData,
} from "@/lib/kv";
import { replyTextMessage, verifyLineSignature } from "@/lib/line-messaging";
import { getCurrentProgress, migrateLegacyConfig } from "@/lib/treatment";

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

function buildTodaySummary(data: Awaited<ReturnType<typeof kvGetSharedData>>): string {
  const config = data?.treatment
    ? migrateLegacyConfig(data.treatment as Parameters<typeof migrateLegacyConfig>[0])
    : null;
  const progress = config ? getCurrentProgress(config) : null;
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  let msg = `📅 今天 ${m}/${d}\n`;

  if (progress?.status === "in_cycle" && progress.todayInfo) {
    msg += `第 ${progress.todayInfo.cycle} 次療程 · 第 ${progress.todayInfo.day} 天\n`;
    msg += `階段：${progress.todayInfo.phaseLabel}\n`;
    msg += `${progress.todayInfo.title}`;
    return msg;
  }
  if (progress?.status === "waiting_next") {
    return `${msg}目前為等待下次回診階段。`;
  }
  if (progress?.status === "completed") {
    return `${msg}療程已全部完成。`;
  }
  return `${msg}尚未設定療程，請先到 App 設定打針日。`;
}

async function markMedicationCheckedByToken(token: string): Promise<boolean> {
  const payload = await kvGetAndDeleteCheckToken(token);
  if (!payload) return false;
  const data = await kvGetSharedData();
  const medRecords = data?.medRecords ?? {};
  const dateRecords = medRecords[payload.date] ?? {};
  const updated = { ...dateRecords, [payload.medId]: true };
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
          ? "已綁定提醒。每天 8:00 會收到今日階段提醒，用藥時段也會推播。"
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
      await replyTextMessage(event.replyToken, buildTodaySummary(data));
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
        "可用指令：\n- 綁定\n- 解除綁定\n- 狀態\n- 今日\n- 開啟App"
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
