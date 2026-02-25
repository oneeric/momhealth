/**
 * 用藥課表資料（參考用藥指南.ts）
 * applicableDays: 1-7 表示僅 Day 1~7 顯示（口服藥週）
 */

export interface MedItem {
  id: string;
  baseId: string;
  name: string;
  dose: string;
  purpose: string;
  isAlert?: boolean;
  alertText?: string;
  pillCss: string;
  hasLine?: boolean;
  applicableDays?: number[]; // 空 = 每天，[1,2,3,4,5,6,7] = 僅口服藥週
}

export interface TimeSlot {
  timing: string;
  meds: MedItem[];
}

export interface SchedulePeriod {
  timeOfDay: string;
  bgColor: string;
  headerColor: string;
  slots: TimeSlot[];
}

export const scheduleData: SchedulePeriod[] = [
  {
    timeOfDay: "早上 (Morning)",
    bgColor: "bg-amber-300",
    headerColor: "text-amber-900",
    slots: [
      {
        timing: "早餐前 (空腹)",
        meds: [
          {
            id: "panzolec_m",
            baseId: "panzolec",
            name: "Panzolec (瘍康)",
            dose: "1 粒",
            purpose: "保護胃部 (請整粒吞服)",
            pillCss: "w-6 h-4 rounded-full bg-yellow-100 border border-yellow-300",
          },
          {
            id: "emetrol_m",
            baseId: "emetrol",
            name: "EmetroL (癒吐寧)",
            dose: "1 粒",
            purpose: "預防噁心嘔吐",
            pillCss: "w-5 h-5 rounded-full bg-white border border-gray-300",
          },
        ],
      },
      {
        timing: "早餐中 (與食物一起吃)",
        meds: [
          {
            id: "creon_m",
            baseId: "creon",
            name: "Creon (卡利消)",
            dose: "1 粒",
            purpose: "幫助消化",
            pillCss:
              "w-7 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-100 border border-red-200",
          },
        ],
      },
      {
        timing: "早餐後",
        meds: [
          {
            id: "ts1_m",
            baseId: "ts1",
            name: "TS-1 (愛斯萬)",
            dose: "2 粒",
            purpose: "化學治療藥物",
            isAlert: true,
            alertText: "吃滿6天即停藥",
            pillCss: "w-7 h-3 rounded-full bg-white border border-gray-400",
            applicableDays: [1, 2, 3, 4, 5, 6, 7],
          },
          {
            id: "folina_m",
            baseId: "folina",
            name: "Folina (芙琳亞)",
            dose: "2 粒",
            purpose: "化療輔助藥物",
            isAlert: true,
            alertText: "吃滿6天即停藥",
            pillCss:
              "w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center relative",
            hasLine: true,
            applicableDays: [1, 2, 3, 4, 5, 6, 7],
          },
          {
            id: "traceton_m",
            baseId: "traceton",
            name: "Traceton (服安痛)",
            dose: "1 粒",
            purpose: "止痛藥 (可能引起嗜睡)",
            pillCss: "w-8 h-3 rounded-full bg-yellow-300 border border-yellow-400",
          },
        ],
      },
      {
        timing: "早餐後一小時",
        meds: [
          {
            id: "tcm_m",
            baseId: "tcm",
            name: "中藥",
            dose: "1 包",
            purpose: "飯後一小時服用（輔助調理）",
            pillCss: "w-8 h-4 rounded-full bg-amber-200 border border-amber-400",
          },
        ],
      },
    ],
  },
  {
    timeOfDay: "中午 (Noon)",
    bgColor: "bg-sky-300",
    headerColor: "text-sky-900",
    slots: [
      {
        timing: "午餐前 (空腹)",
        meds: [
          {
            id: "emetrol_n",
            baseId: "emetrol",
            name: "EmetroL (癒吐寧)",
            dose: "1 粒",
            purpose: "預防噁心嘔吐",
            pillCss: "w-5 h-5 rounded-full bg-white border border-gray-300",
          },
        ],
      },
      {
        timing: "午餐中 (與食物一起吃)",
        meds: [
          {
            id: "creon_n",
            baseId: "creon",
            name: "Creon (卡利消)",
            dose: "1 粒",
            purpose: "幫助消化",
            pillCss:
              "w-7 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-100 border border-red-200",
          },
        ],
      },
      {
        timing: "午餐後一小時",
        meds: [
          {
            id: "tcm_n",
            baseId: "tcm",
            name: "中藥",
            dose: "1 包",
            purpose: "飯後一小時服用（輔助調理）",
            pillCss: "w-8 h-4 rounded-full bg-amber-200 border border-amber-400",
          },
        ],
      },
    ],
  },
  {
    timeOfDay: "晚上 (Evening)",
    bgColor: "bg-indigo-300",
    headerColor: "text-indigo-900",
    slots: [
      {
        timing: "晚餐前 (空腹)",
        meds: [
          {
            id: "emetrol_e",
            baseId: "emetrol",
            name: "EmetroL (癒吐寧)",
            dose: "1 粒",
            purpose: "預防噁心嘔吐",
            pillCss: "w-5 h-5 rounded-full bg-white border border-gray-300",
          },
        ],
      },
      {
        timing: "晚餐中 (與食物一起吃)",
        meds: [
          {
            id: "creon_e",
            baseId: "creon",
            name: "Creon (卡利消)",
            dose: "1 粒",
            purpose: "幫助消化",
            pillCss:
              "w-7 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-100 border border-red-200",
          },
        ],
      },
      {
        timing: "晚餐後",
        meds: [
          {
            id: "ts1_e",
            baseId: "ts1",
            name: "TS-1 (愛斯萬)",
            dose: "2 粒",
            purpose: "化學治療藥物",
            isAlert: true,
            alertText: "吃滿6天即停藥",
            pillCss: "w-7 h-3 rounded-full bg-white border border-gray-400",
            applicableDays: [1, 2, 3, 4, 5, 6, 7],
          },
          {
            id: "folina_e",
            baseId: "folina",
            name: "Folina (芙琳亞)",
            dose: "2 粒",
            purpose: "化療輔助藥物",
            isAlert: true,
            alertText: "吃滿6天即停藥",
            pillCss:
              "w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center relative",
            hasLine: true,
            applicableDays: [1, 2, 3, 4, 5, 6, 7],
          },
          {
            id: "traceton_e",
            baseId: "traceton",
            name: "Traceton (服安痛)",
            dose: "1 粒",
            purpose: "止痛藥 (可能引起嗜睡)",
            pillCss: "w-8 h-3 rounded-full bg-yellow-300 border border-yellow-400",
          },
        ],
      },
      {
        timing: "晚餐後一小時",
        meds: [
          {
            id: "tcm_e",
            baseId: "tcm",
            name: "中藥",
            dose: "1 包",
            purpose: "飯後一小時服用（輔助調理）",
            pillCss: "w-8 h-4 rounded-full bg-amber-200 border border-amber-400",
          },
        ],
      },
    ],
  },
  {
    timeOfDay: "睡前 (Bedtime)",
    bgColor: "bg-violet-300",
    headerColor: "text-violet-900",
    slots: [
      {
        timing: "準備就寢前",
        meds: [
          {
            id: "traceton_b",
            baseId: "traceton",
            name: "Traceton (服安痛)",
            dose: "1 粒",
            purpose: "止痛藥 (幫助睡眠不痛)",
            pillCss: "w-8 h-3 rounded-full bg-yellow-300 border border-yellow-400",
          },
        ],
      },
    ],
  },
];

export const prnMeds = [
  {
    condition: "拉肚子 (一天超過 3 次時)",
    meds: [
      {
        baseId: "loperam",
        name: "Loperam (肚倍朗)",
        dose: "每次 1 粒",
        timing: "早、晚餐後服用",
        pillCss:
          "w-7 h-3 rounded-full bg-gradient-to-r from-gray-400 to-green-600 border border-gray-300",
      },
    ],
  },
  {
    condition: "出現紅疹 / 過敏時",
    meds: [
      {
        baseId: "allegra",
        name: "Allegra (艾來)",
        dose: "每次 1 粒",
        timing: "早、晚餐後服用",
        pillCss: "w-6 h-4 rounded-full bg-orange-200 border border-orange-300",
      },
      {
        baseId: "xyzal",
        name: "XyzaL (驅異樂)",
        dose: "每次 1 粒",
        timing: "晚上使用",
        pillCss: "w-8 h-3 rounded-full bg-white border border-gray-300",
      },
    ],
  },
];

export const pillGuide = [
  {
    baseId: "ts1",
    name: "TS-1 (愛斯萬) 20mg",
    type: "化療主藥",
    desc: "全白色硬膠囊，印有 TC442。",
    pillCss: "w-10 h-4 rounded-full bg-white border border-gray-400",
  },
  {
    baseId: "folina",
    name: "Folina (芙琳亞) 15mg",
    type: "化療輔助",
    desc: "白色圓扁形藥錠，中間有刻痕。",
    pillCss:
      "w-6 h-6 rounded-full bg-white border border-gray-400 flex items-center justify-center",
    hasLine: true,
  },
  {
    baseId: "creon",
    name: "Creon (卡利消) 300mg",
    type: "助消化",
    desc: "紅色+透明硬膠囊，內有微粒。",
    pillCss:
      "w-10 h-4 rounded-full bg-gradient-to-r from-red-500 to-red-50 border border-red-200",
  },
  {
    baseId: "panzolec",
    name: "Panzolec (瘍康) 40mg",
    type: "護胃/防潰瘍",
    desc: "淡黃色橢圓形，印有 SCP。不可咬碎。",
    pillCss: "w-8 h-5 rounded-full bg-yellow-100 border border-yellow-300",
  },
  {
    baseId: "emetrol",
    name: "EmetroL (癒吐寧) 10mg",
    type: "預防嘔吐",
    desc: "白色圓扁形，印有 031。",
    pillCss: "w-6 h-6 rounded-full bg-white border border-gray-300",
  },
  {
    baseId: "traceton",
    name: "Traceton (服安痛)",
    type: "止痛藥",
    desc: "黃色長圓柱形，印有 YSP186。",
    pillCss: "w-10 h-4 rounded-full bg-yellow-300 border border-yellow-400",
  },
  {
    baseId: "loperam",
    name: "Loperam (肚倍朗) 2mg",
    type: "止瀉備用",
    desc: "灰色+綠色硬膠囊。",
    pillCss:
      "w-10 h-4 rounded-full bg-gradient-to-r from-gray-400 to-green-600 border border-gray-300",
  },
  {
    baseId: "allegra",
    name: "Allegra (艾來) 60mg",
    type: "過敏備用",
    desc: "淡橙色橢圓形，印有 06。",
    pillCss: "w-8 h-5 rounded-full bg-orange-200 border border-orange-300",
  },
  {
    baseId: "xyzal",
    name: "XyzaL (驅異樂) 5mg",
    type: "過敏備用",
    desc: "白色長圓柱形，印有 Y。",
    pillCss: "w-10 h-4 rounded-full bg-white border border-gray-300",
  },
  {
    baseId: "tcm",
    name: "中藥",
    type: "輔助調理",
    desc: "飯後一小時服用，依醫師處方。",
    pillCss: "w-8 h-4 rounded-full bg-amber-200 border border-amber-400",
  },
];
