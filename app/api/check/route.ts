/**
 * 一鍵打勾 - LINE 提醒中的連結點擊後更新用藥紀錄
 */
import { NextRequest, NextResponse } from "next/server";
import { kvGetAndDeleteCheckToken, kvGetSharedData, kvSetSharedData } from "@/lib/kv";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  if (!token) {
    return NextResponse.redirect(new URL("/meds", request.url));
  }

  const payload = await kvGetAndDeleteCheckToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/meds?expired=1", request.url));
  }

  const data = await kvGetSharedData();
  const medRecords = data?.medRecords ?? {};
  const todayRecords = medRecords[payload.date] ?? {};
  const updated = { ...todayRecords, [payload.medId]: true };

  await kvSetSharedData({
    medRecords: { ...medRecords, [payload.date]: updated },
  });

  const baseUrl =
    request.nextUrl.origin ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://momhealth.vercel.app");
  return NextResponse.redirect(new URL("/meds?checked=1", baseUrl));
}
