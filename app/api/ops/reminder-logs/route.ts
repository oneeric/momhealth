import { NextRequest, NextResponse } from "next/server";
import { kvGetReminderLogs } from "@/lib/kv";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.OPS_TOKEN;
  if (!expected) return false;
  const headerToken = request.headers.get("x-ops-token");
  const queryToken = request.nextUrl.searchParams.get("token");
  return headerToken === expected || queryToken === expected;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 100;
  const logs = await kvGetReminderLogs(Number.isFinite(limit) ? limit : 100);
  return NextResponse.json({ ok: true, count: logs.length, logs });
}
