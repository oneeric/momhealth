"use client";

import { useMemo, useState } from "react";

type ReminderLogItem = {
  ts: string;
  level: "info" | "warn" | "error";
  event: string;
  slot?: string;
  detail?: string;
  meta?: Record<string, unknown>;
};

export default function ReminderLogPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<ReminderLogItem[]>([]);

  const grouped = useMemo(() => logs.slice(0, 200), [logs]);

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const url = `/api/ops/reminder-logs?limit=200&token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        setLogs([]);
        return;
      }
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (e) {
      setError(String(e));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="text-xl font-bold text-slate-800">提醒排程紀錄檢視</h1>
      <p className="mt-2 text-sm text-slate-600">
        輸入 OPS Token 後可查看最近提醒執行紀錄（成功/略過/失敗）。
      </p>

      <div className="mt-4 flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="輸入 OPS_TOKEN"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={loadLogs}
          disabled={!token || loading}
          className="rounded bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "載入中..." : "查詢"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">錯誤：{error}</p> : null}

      <div className="mt-4 space-y-3">
        {grouped.map((item, idx) => (
          <article key={`${item.ts}-${idx}`} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-slate-100 px-2 py-1">{item.level}</span>
              <span className="rounded bg-slate-100 px-2 py-1">{item.event}</span>
              <span className="rounded bg-slate-100 px-2 py-1">{item.slot ?? "-"}</span>
              <span className="text-slate-500">{item.ts}</span>
            </div>
            <p className="mt-2 text-sm text-slate-800">{item.detail ?? "-"}</p>
            {item.meta ? (
              <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                {JSON.stringify(item.meta, null, 2)}
              </pre>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
