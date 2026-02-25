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
  };
  await client.set(SHARED_KEY, JSON.stringify(merged));
  return true;
}
