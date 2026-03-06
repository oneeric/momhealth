/**
 * Upstash Redis 客戶端 - 單一共享資料
 * 支援：UPSTASH_REDIS_REST_* 或 KV_REST_API_*（Vercel 整合）
 */
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

export function isKvConfigured(): boolean {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return !!(url && token);
}

const SHARED_KEY = "momhealth:shared";

export interface SharedData {
  treatment: unknown;
  medRecords: Record<string, Record<string, boolean>>;
  memos: unknown[];
  lineUserIds?: string[];
  lineGroupIds?: string[];
}

export async function kvGetSharedData(): Promise<SharedData | null> {
  const client = getRedis();
  if (!client) return null;
  const raw = await client.get(SHARED_KEY);
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      treatment: parsed.treatment ?? null,
      medRecords: parsed.medRecords ?? {},
      memos: parsed.memos ?? [],
      lineUserIds: Array.isArray(parsed.lineUserIds) ? parsed.lineUserIds : [],
      lineGroupIds: Array.isArray(parsed.lineGroupIds)
        ? parsed.lineGroupIds
        : [],
    };
  } catch {
    return null;
  }
}

export async function kvSetSharedData(data: Partial<SharedData>): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  const existing = await kvGetSharedData();
  const merged: SharedData = {
    treatment: data.treatment ?? existing?.treatment ?? null,
    medRecords: data.medRecords ?? existing?.medRecords ?? {},
    memos: data.memos ?? existing?.memos ?? [],
    lineUserIds: data.lineUserIds ?? existing?.lineUserIds ?? [],
    lineGroupIds: data.lineGroupIds ?? existing?.lineGroupIds ?? [],
  };
  await client.set(SHARED_KEY, JSON.stringify(merged));
  return true;
}

const CHECK_PREFIX = "momhealth:check:";

export async function kvSetCheckToken(
  token: string,
  medId: string,
  date: string
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  const key = `${CHECK_PREFIX}${token}`;
  await client.set(key, JSON.stringify({ medId, date }), { ex: 86400 }); // 24h
}

export async function kvGetAndDeleteCheckToken(
  token: string
): Promise<{ medId: string; date: string } | null> {
  const client = getRedis();
  if (!client) return null;
  const key = `${CHECK_PREFIX}${token}`;
  const raw = await client.get(key);
  if (!raw) return null;
  await client.del(key);
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { medId: parsed.medId, date: parsed.date };
  } catch {
    return null;
  }
}
