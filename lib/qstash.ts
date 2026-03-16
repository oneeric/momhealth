import { Receiver } from "@upstash/qstash";

function getReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

export function isQstashVerificationConfigured(): boolean {
  return !!(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY);
}

export async function verifyQstashSignature(
  signature: string,
  body: string
): Promise<boolean> {
  const receiver = getReceiver();
  if (!receiver) return false;
  try {
    await receiver.verify({ signature, body });
    return true;
  } catch {
    return false;
  }
}
