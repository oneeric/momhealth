"use client";

import { Calendar, Heart, Pill, StickyNote } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: Calendar, label: "行事曆" },
  { href: "/care", icon: Heart, label: "照護須知" },
  { href: "/meds", icon: Pill, label: "用藥" },
  { href: "/memos", icon: StickyNote, label: "備忘錄" },
];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Header */}
      <header className="bg-primary-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Heart className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">化療護理小幫手</h1>
          <p className="text-primary-100 text-xs">SLOG 療程專用</p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-w-0 p-4 max-w-md mx-auto w-full overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-health-border flex justify-around items-center pb-safe pt-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 py-2 flex flex-col items-center justify-center text-xs font-medium transition-colors touch-target ${
                isActive ? "text-primary-600" : "text-health-muted"
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
