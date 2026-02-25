"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { type MemoCard } from "@/lib/storage";
import { useSharedData } from "@/lib/use-shared-data";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function MemosPage() {
  const { data, loading, saveMemos } = useSharedData();
  const memos = data?.memos ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleAdd = () => {
    setIsAdding(true);
    setEditTitle("");
    setEditContent("");
  };

  const handleEdit = (memo: MemoCard) => {
    setEditingId(memo.id);
    setEditTitle(memo.title);
    setEditContent(memo.content);
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    if (editingId) {
      const next = memos.map((m) =>
        m.id === editingId
          ? {
              ...m,
              title: editTitle || "未命名",
              content: editContent,
              updatedAt: now,
            }
          : m
      );
      saveMemos(next);
      setEditingId(null);
    } else if (isAdding) {
      const newMemo: MemoCard = {
        id: crypto.randomUUID(),
        title: editTitle || "未命名",
        content: editContent,
        createdAt: now,
        updatedAt: now,
        order: memos.length,
      };
      saveMemos([...memos, newMemo]);
      setIsAdding(false);
    }
    setEditTitle("");
    setEditContent("");
  };

  const handleDelete = (id: string) => {
    if (window.confirm("確定要刪除這則備忘嗎？")) {
      saveMemos(memos.filter((m) => m.id !== id));
      if (editingId === id) setEditingId(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditTitle("");
    setEditContent("");
  };

  const showForm = isAdding || editingId;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">備忘錄</h2>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            新增
          </button>
        </div>

        <p className="text-sm text-health-muted">
          家族成員可共同新增、編輯備忘，方便照護協作。
        </p>

        {/* 編輯表單 */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-card border border-health-border p-4 space-y-4">
            <input
              type="text"
              placeholder="標題"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-4 py-2 border border-health-border rounded-lg"
            />
            <textarea
              placeholder="內容"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-health-border rounded-lg resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-primary-600 text-white rounded-xl font-medium"
              >
                儲存
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2 border border-health-border rounded-xl text-slate-600"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 卡片列表 */}
        <div className="space-y-3">
          {memos.length === 0 && !showForm && (
            <div className="bg-slate-50 rounded-2xl p-8 text-center text-health-muted">
              <p>尚無備忘，點擊「新增」建立第一則</p>
            </div>
          )}
          {memos.map((memo) => (
            <div
              key={memo.id}
              className="bg-white rounded-2xl shadow-card border border-health-border overflow-hidden"
            >
              <div className="p-4">
                <h3 className="font-bold text-slate-800">{memo.title}</h3>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                  {memo.content || "（無內容）"}
                </p>
              </div>
              <div className="flex border-t border-health-border">
                <button
                  onClick={() => handleEdit(memo)}
                  className="flex-1 py-3 flex items-center justify-center gap-2 text-primary-600 font-medium hover:bg-primary-50"
                >
                  <Pencil className="w-4 h-4" />
                  編輯
                </button>
                <button
                  onClick={() => handleDelete(memo.id)}
                  className="flex-1 py-3 flex items-center justify-center gap-2 text-rose-600 font-medium hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
