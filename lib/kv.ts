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
const REMINDER_SENT_PREFIX = "momhealth:reminder:sent:";
const REMINDER_LOGS_KEY = "momhealth:reminder:logs";
const REMINDER_LOGS_LIMIT = 300;

export type ReminderLogItem = {
  ts: string;
  level: "info" | "warn" | "error";
  event: string;
  slot?: string;
  detail?: string;
  meta?: Record<string, unknown>;
};

export async function kvSetCheckToken(
  token: string,
  medIds: string | string[],
  date: string
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  const key = `${CHECK_PREFIX}${token}`;
  const normalized = Array.isArray(medIds) ? medIds : [medIds];
  await client.set(key, JSON.stringify({ medIds: normalized, date }), { ex: 86400 }); // 24h
}

export async function kvGetAndDeleteCheckToken(
  token: string
): Promise<{ medIds: string[]; date: string } | null> {
  const client = getRedis();
  if (!client) return null;
  const key = `${CHECK_PREFIX}${token}`;
  const raw = await client.get(key);
  if (!raw) return null;
  await client.del(key);
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed?.medIds) && typeof parsed?.date === "string") {
      return {
        medIds: parsed.medIds.filter((id: unknown): id is string => typeof id === "string"),
        date: parsed.date,
      };
    }
    // Backward compatibility for old token payload.
    if (typeof parsed?.medId === "string" && typeof parsed?.date === "string") {
      return { medIds: [parsed.medId], date: parsed.date };
    }
    return null;
  } catch {
    return null;
  }
}

export async function kvWasReminderSent(reminderKey: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  const key = `${REMINDER_SENT_PREFIX}${reminderKey}`;
  const raw = await client.get(key);
  return !!raw;
}

export async function kvMarkReminderSent(
  reminderKey: string,
  ttlSeconds = 60 * 60 * 48
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  const key = `${REMINDER_SENT_PREFIX}${reminderKey}`;
  await client.set(key, "1", { ex: ttlSeconds });
}

export async function kvClearReminderSent(reminderKey: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  const key = `${REMINDER_SENT_PREFIX}${reminderKey}`;
  await client.del(key);
}

export async function kvPushReminderLog(item: ReminderLogItem): Promise<void> {
  const client = getRedis();
  if (!client) return;
  const raw = await client.get(REMINDER_LOGS_KEY);
  const existing: ReminderLogItem[] = Array.isArray(raw)
    ? (raw as ReminderLogItem[])
    : typeof raw === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as ReminderLogItem[]) : [];
          } catch {
            return [];
          }
        })()
      : [];
  const next = [{ ...item, ts: item.ts || new Date().toISOString() }, ...existing].slice(
    0,
    REMINDER_LOGS_LIMIT
  );
  await client.set(REMINDER_LOGS_KEY, JSON.stringify(next));
}

export async function kvGetReminderLogs(limit = 100): Promise<ReminderLogItem[]> {
  const client = getRedis();
  if (!client) return [];
  const raw = await client.get(REMINDER_LOGS_KEY);
  let logs: ReminderLogItem[] = [];
  if (Array.isArray(raw)) {
    logs = raw as ReminderLogItem[];
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      logs = Array.isArray(parsed) ? (parsed as ReminderLogItem[]) : [];
    } catch {
      logs = [];
    }
  }
  const safeLimit = Math.max(1, Math.min(500, limit));
  return logs.slice(0, safeLimit);
}
