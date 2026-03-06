/**
 * LINE Messaging API helpers
 */
import { createHmac } from "crypto";

function getLineAccessToken(): string | null {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? null;
}

function getLineChannelSecret(): string | null {
  return process.env.LINE_CHANNEL_SECRET ?? null;
}

export function isLineMessagingConfigured(): boolean {
  return !!(getLineAccessToken() && getLineChannelSecret());
}

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = getLineChannelSecret();
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(body).digest("base64");
  return digest === signature;
}

export async function pushTextMessage(
  to: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = getLineAccessToken();
  if (!token) return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN missing" };

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: detail || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function replyTextMessage(
  replyToken: string,
  text: string
): Promise<void> {
  const token = getLineAccessToken();
  if (!token) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}
