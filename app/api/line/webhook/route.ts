/**
 * LINE Webhook:
 * - 驗簽
 * - 自動綁定 userId / groupId
 * - 回覆綁定成功訊息
 */
import { NextRequest, NextResponse } from "next/server";
import { kvGetSharedData, kvSetSharedData } from "@/lib/kv";
import { replyTextMessage, verifyLineSignature } from "@/lib/line-messaging";

export const dynamic = "force-dynamic";

type LineEvent = {
  type: string;
  source?: {
    type?: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
};

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
  const data = await kvGetSharedData();
  const userIds = new Set(data?.lineUserIds ?? []);
  const groupIds = new Set(data?.lineGroupIds ?? []);

  for (const event of events) {
    const source = event.source;
    if (source?.type === "user" && source.userId) {
      userIds.add(source.userId);
    }
    if (source?.type === "group" && source.groupId) {
      groupIds.add(source.groupId);
    }
    if (event.replyToken) {
      await replyTextMessage(
        event.replyToken,
        "已綁定提醒。每天 8:00 會收到今日階段提醒，用藥時段也會推播。"
      );
    }
  }

  await kvSetSharedData({
    lineUserIds: Array.from(userIds),
    lineGroupIds: Array.from(groupIds),
  });

  return NextResponse.json({
    ok: true,
    userCount: userIds.size,
    groupCount: groupIds.size,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "LINE webhook endpoint" });
}
