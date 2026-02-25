import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "化療護理小幫手",
  description: "SLOG 化療療程專用照護輔助應用",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-health-surface text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}
