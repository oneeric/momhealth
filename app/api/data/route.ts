/**
 * 共享資料 API - 所有使用者讀寫同一份資料
 */
import { NextResponse } from "next/server";
import { kvGetSharedData, kvSetSharedData, isKvConfigured } from "@/lib/kv";

export async function GET() {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "KV_NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  const data = await kvGetSharedData();
  const raw = data ?? {
    treatment: null,
    medRecords: {},
    memos: [],
    lineUserIds: [],
    lineGroupIds: [],
  };
  const userCount = raw.lineUserIds?.length ?? 0;
  const groupCount = raw.lineGroupIds?.length ?? 0;
  const { lineUserIds: _, lineGroupIds: __, ...safe } = raw;
  return NextResponse.json({
    ok: true,
    data: {
      ...safe,
      lineConnected: userCount + groupCount > 0,
      lineTargetCount: userCount + groupCount,
    },
  });
}

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "KV_NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const success = await kvSetSharedData({
      treatment: body.treatment,
      medRecords: body.medRecords,
      memos: body.memos,
      lineUserIds: body.lineUserIds,
      lineGroupIds: body.lineGroupIds,
    });
    if (!success) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    const data = await kvGetSharedData();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
