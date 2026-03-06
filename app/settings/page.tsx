"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import { useSharedData } from "@/lib/use-shared-data";
import { Bell, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const { data, loading } = useSharedData();
  const connected = data?.lineConnected ?? false;
  const targetCount = data?.lineTargetCount ?? 0;
  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/line/webhook";
    return `${window.location.origin}/api/line/webhook`;
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-primary-700 font-bold">
          <Bell className="w-5 h-5" />
          LINE 提醒設定
        </div>

        <p className="text-sm text-health-muted">
          已改用 LINE Messaging API。每天 8:00 會收到今日階段提醒，用藥時段會收到藥品清單，點擊連結可一鍵打勾。
        </p>

        {/* 狀態 */}
        <div className="bg-white rounded-2xl shadow-card border border-health-border p-4">
          <p className="text-sm font-medium text-slate-600 mb-2">目前狀態</p>
          <p className={connected ? "text-primary-600 font-bold" : "text-health-muted"}>
            {connected ? `✓ 已連結（${targetCount} 個對象）` : "未連結"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-health-border p-4 space-y-4">
          <h3 className="font-bold text-slate-800">綁定步驟</h3>
          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
            <li>到 LINE Developers 的 Messaging API 設定 Webhook URL：</li>
            <li className="font-mono text-xs bg-slate-50 p-2 rounded-lg break-all">
              {webhookUrl}
            </li>
            <li>開啟 Use webhook，按 Verify 驗證成功</li>
            <li>將官方帳號加入好友，傳任意訊息（例如：綁定）</li>
            <li>回到此頁重新整理，狀態會顯示已連結</li>
          </ol>
          <a
            href="https://developers.line.biz/console/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary-600 underline text-sm"
          >
            開啟 LINE Developers
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {!connected && (
          <div className="p-3 rounded-xl text-sm bg-amber-50 text-amber-900">
            尚未收到綁定事件。請確認你有傳訊息給 Bot，且 Webhook 開關為啟用。
          </div>
        )}
      </div>
    </AppShell>
  );
}
