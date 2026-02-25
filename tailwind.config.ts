import type { Config } from "tailwindcss";

/**
 * 健康照護主題 - Health Care Theme
 * 主色：Teal（療癒、信任、平靜，適合醫療/健康介面）
 * 輔色：Emerald（完成/正向）、Amber（提醒）、Rose（緊急警示）
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-amber-300",
    "text-amber-900",
    "bg-sky-300",
    "text-sky-900",
    "bg-indigo-300",
    "text-indigo-900",
    "bg-violet-300",
    "text-violet-900",
  ],
  theme: {
    extend: {
      colors: {
        // 主色：Teal - 醫療照護、療癒感
        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        // 輔色：柔和背景
        health: {
          surface: "#f8fafc",      // 頁面背景
          card: "#ffffff",         // 卡片背景
          muted: "#94a3b8",        // 次要文字
          border: "#e2e8f0",      // 邊框
        },
        // 階段色（療程用）
        phase: {
          injection: "#0d9488",   // D1 打針 - teal
          oral: "#d97706",        // D2-7 口服 - amber
          rest: "#0891b2",        // D8-14 休養 - cyan
          recovery: "#059669",    // D11-14 恢復 - emerald
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
