"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import {
  ChevronDown,
  ChevronRight,
  Utensils,
  Shield,
  Thermometer,
  Leaf,
  AlertTriangle,
  Apple,
  Activity,
} from "lucide-react";

interface CareSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: string[];
}

const CARE_SECTIONS: CareSection[] = [
  {
    id: "diet",
    icon: <Utensils className="w-5 h-5" />,
    title: "飲食與營養",
    content: [
      "【絕對熟食】\n嚴禁生食（生魚片、半熟蛋、生菜沙拉、未削皮水果）。水果請挑選可剝皮或削皮的，如蘋果、香蕉、橘子。",
      "【高蛋白飲食】\n多吃魚湯、蒸蛋、滴雞精、肉類。若吃不下，可購買癌症專用營養配方代替一餐。",
      "【少量多餐】\n分成一天 5～6 次小口進食，吃得下最重要。",
      "【避免冰冷（草酸鉑）】\n千萬不要喝冰水、摸冰塊，洗手用溫水，尤其是剛打完針的前幾天。",
    ],
  },
  {
    id: "carb-oil",
    icon: <Apple className="w-5 h-5" />,
    title: "飲食控醣與挑選好油須知",
    content: [
      "【控管碳水化合物】\n減少攝取會刺激胰島素分泌的糖分與澱粉，建議每日碳水化合物攝取量控制在 130 公克以下（約佔總熱量 20% 以下），以降低細胞突變機率。",
      "【絕對避開壞油】\n切勿食用人造奶油（反式脂肪），並避開所有的「植物種子油」，如花生油、葡萄籽油、南瓜籽油、玉米油等。",
      "【多攝取優質好油】\n建議選擇橄欖油（果肉萃取）、酪梨油、椰子油；若無汙染疑慮，傳統的豬油、牛油等動物性油脂也是健康的選擇。",
      "【微甜水果補充維生素 C】\n為了防癌應多補充維生素 C，但要避免吃太甜的水果吃下過多糖分。推薦食用「不甜或微甜」的水果，如檸檬，或是維生素 C 含量高達檸檬 5 倍的「芭樂」。",
    ],
  },
  {
    id: "sideeffects",
    icon: <Shield className="w-5 h-5" />,
    title: "副作用防護",
    content: [
      "【預防嘴破／腹瀉】\n按時服用速養療，使用軟毛牙刷，進食後用溫鹽水或不含酒精漱口水漱口。",
      "【預防手腳麻】\n打針時戴冰敷手套／腳套，平時穿薄襪保暖，避免踩冰冷地板。",
      "【紀錄排便】\n紀錄每天排便次數。嚴重腹瀉（一天超過 3～5 次水瀉）須提早回診。",
    ],
  },
  {
    id: "infection",
    icon: <Thermometer className="w-5 h-5" />,
    title: "感染預防",
    content: [
      "【早晚量體溫】\n買好的耳溫槍，每天記錄。",
      "【勤洗手、戴口罩】\n家人從外回家立刻洗手換衣再接觸。家人感冒時務必戴口罩並保持距離。",
    ],
  },
  {
    id: "exercise",
    icon: <Activity className="w-5 h-5" />,
    title: "運動防癌須知",
    content: [
      "【落實中強度運動】\n運動能讓身體分泌抑制癌細胞的激素，對預防乳癌、大腸癌等 13 種癌症有效。每次運動必須「連續不中斷」達 30 分鐘，每週累積達 150 分鐘。",
      "【快走速度要達標】\n透過走路就能達到中強度運動的防癌效果，但速度必須達標：請確保自己能「在 30 分鐘內走完 3000 公尺」或「在 30 分鐘內走滿 5000 步」。",
    ],
  },
  {
    id: "tcm",
    icon: <Leaf className="w-5 h-5" />,
    title: "中醫配合",
    content: [
      "【掛號】\n榮總傳統醫學部掛號，帶著西藥清單與抽血報告。",
      "【服用時機】\n三餐飯後 1 小時服用。",
      "【條件】\n肝腎功能正常的前提下，醫師同意才配合中醫。",
      "【叮嚀】\n中醫是輔助減輕副作用與恢復體力，絕對不能吃親友推薦的偏方或來路不明草藥。",
    ],
  },
  {
    id: "emergency",
    icon: <AlertTriangle className="w-5 h-5" />,
    title: "急診警訊（立刻掛急診）",
    content: [
      "發燒超過 38°C 且伴隨畏寒、發抖（可能是白血球低下引發敗血症）。",
      "一天連續嚴重嘔吐或水瀉超過 5 次以上，完全無法進食喝水。",
      "突然劇烈腹痛、呼吸困難，或意識模糊、嗜睡叫不醒。",
    ],
  },
];

export default function CarePage() {
  const [openId, setOpenId] = useState<string | null>("diet");

  return (
    <AppShell>
      <div className="w-full space-y-4">
        <h2 className="text-xl font-bold text-slate-800">照護須知</h2>
        <p className="text-base text-health-muted">
          居家照護原則，家屬必看。
        </p>

        <div className="w-full space-y-3">
          {CARE_SECTIONS.map((section) => {
            const isOpen = openId === section.id;
            return (
              <div
                key={section.id}
                className="w-full bg-white rounded-2xl shadow-card border border-health-border overflow-hidden"
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : section.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors min-w-0"
                >
                  <div className="flex-shrink-0 text-primary-600">
                    {section.icon}
                  </div>
                  <span className="flex-1 font-bold text-slate-800 min-w-0">
                    {section.title}
                  </span>
                  <div className="flex-shrink-0">
                    {isOpen ? (
                      <ChevronDown className="w-5 h-5 text-health-muted" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-health-muted" />
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 space-y-4 border-t border-health-border pt-4">
                    {section.content.map((para, i) => (
                      <div key={i} className="space-y-1">
                        {para.split("\n").map((line, j) => (
                          <p
                            key={j}
                            className={`text-base text-slate-700 leading-relaxed ${
                              line.startsWith("【") ? "font-semibold text-slate-800" : "pl-2"
                            }`}
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
