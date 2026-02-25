import React, { useState, useEffect, useRef } from 'react';
import { 
  Sun, 
  CloudSun, 
  Moon, 
  MoonStar, 
  AlertCircle, 
  CheckCircle2, 
  Circle,
  Pill,
  Info,
  Calendar,
  Clock,
  ShieldAlert,
  Camera
} from 'lucide-react';

// --- 資料庫 (加入 baseId 用來對應自訂照片) ---
const scheduleData = [
  {
    timeOfDay: '早上 (Morning)',
    icon: <Sun className="w-6 h-6 text-orange-500" />,
    bgColor: 'bg-orange-50',
    headerColor: 'text-orange-700',
    slots: [
      {
        timing: '早餐前 (空腹)',
        meds: [
          { id: 'panzolec_m', baseId: 'panzolec', name: 'Panzolec (瘍康)', dose: '1 粒', purpose: '保護胃部 (請整粒吞服)', pillCss: 'w-6 h-4 rounded-full bg-yellow-100 border border-yellow-300' },
          { id: 'emetrol_m', baseId: 'emetrol', name: 'EmetroL (癒吐寧)', dose: '1 粒', purpose: '預防噁心嘔吐', pillCss: 'w-5 h-5 rounded-full bg-white border border-gray-300' }
        ]
      },
      {
        timing: '早餐中 (與食物一起吃)',
        meds: [
          { id: 'creon_m', baseId: 'creon', name: 'Creon (卡利消)', dose: '1 粒', purpose: '幫助消化', pillCss: 'w-7 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-100 border border-red-200' }
        ]
      },
      {
        timing: '早餐後',
        meds: [
          { id: 'ts1_m', baseId: 'ts1', name: 'TS-1 (愛斯萬)', dose: '2 粒', purpose: '化學治療藥物', isAlert: true, alertText: '吃滿6天即停藥', pillCss: 'w-7 h-3 rounded-full bg-white border border-gray-400' },
          { id: 'folina_m', baseId: 'folina', name: 'Folina (芙琳亞)', dose: '2 粒', purpose: '化療輔助藥物', isAlert: true, alertText: '吃滿6天即停藥', pillCss: 'w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center relative', hasLine: true },
          { id: 'traceton_m', baseId: 'traceton', name: 'Traceton (服安痛)', dose: '1 粒', purpose: '止痛藥 (可能引起嗜睡)', pillCss: 'w-8 h-3 rounded-full bg-yellow-300 border border-yellow-400' }
        ]
      }
    ]
  },
  {
    timeOfDay: '中午 (Noon)',
    icon: <CloudSun className="w-6 h-6 text-blue-500" />,
    bgColor: 'bg-blue-50',
    headerColor: 'text-blue-700',
    slots: [
      {
        timing: '午餐前 (空腹)',
        meds: [
          { id: 'emetrol_n', baseId: 'emetrol', name: 'EmetroL (癒吐寧)', dose: '1 粒', purpose: '預防噁心嘔吐', pillCss: 'w-5 h-5 rounded-full bg-white border border-gray-300' }
        ]
      },
      {
        timing: '午餐中 (與食物一起吃)',
        meds: [
          { id: 'creon_n', baseId: 'creon', name: 'Creon (卡利消)', dose: '1 粒', purpose: '幫助消化', pillCss: 'w-7 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-100 border border-red-200' }
        ]
      }
    ]
  },
  {
    timeOfDay: '晚上 (Evening)',
    icon: <Moon className="w-6 h-6 text-indigo-500" />,
    bgColor: 'bg-indigo-50',
    headerColor: 'text-indigo-700',
    slots: [
      {
        timing: '晚餐前 (空腹)',
        meds: [
          { id: 'emetrol_e', baseId: 'emetrol', name: 'EmetroL (癒吐寧)', dose: '1 粒', purpose: '預防噁心嘔吐', pillCss: 'w-5 h-5 rounded-full bg-white border border-gray-300' }
        ]
      },
      {
        timing: '晚餐中 (與食物一起吃)',
        meds: [
          { id: 'creon_e', baseId: 'creon', name: 'Creon (卡利消)', dose: '1 粒', purpose: '幫助消化', pillCss: 'w-7 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-100 border border-red-200' }
        ]
      },
      {
        timing: '晚餐後',
        meds: [
          { id: 'ts1_e', baseId: 'ts1', name: 'TS-1 (愛斯萬)', dose: '2 粒', purpose: '化學治療藥物', isAlert: true, alertText: '吃滿6天即停藥', pillCss: 'w-7 h-3 rounded-full bg-white border border-gray-400' },
          { id: 'folina_e', baseId: 'folina', name: 'Folina (芙琳亞)', dose: '2 粒', purpose: '化療輔助藥物', isAlert: true, alertText: '吃滿6天即停藥', pillCss: 'w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center relative', hasLine: true },
          { id: 'traceton_e', baseId: 'traceton', name: 'Traceton (服安痛)', dose: '1 粒', purpose: '止痛藥 (可能引起嗜睡)', pillCss: 'w-8 h-3 rounded-full bg-yellow-300 border border-yellow-400' }
        ]
      }
    ]
  },
  {
    timeOfDay: '睡前 (Bedtime)',
    icon: <MoonStar className="w-6 h-6 text-purple-600" />,
    bgColor: 'bg-purple-50',
    headerColor: 'text-purple-700',
    slots: [
      {
        timing: '準備就寢前',
        meds: [
          { id: 'traceton_b', baseId: 'traceton', name: 'Traceton (服安痛)', dose: '1 粒', purpose: '止痛藥 (幫助睡眠不痛)', pillCss: 'w-8 h-3 rounded-full bg-yellow-300 border border-yellow-400' }
        ]
      }
    ]
  }
];

const prnMeds = [
  {
    condition: '拉肚子 (一天超過 3 次時)',
    icon: <AlertCircle className="w-5 h-5 text-red-500" />,
    meds: [
      { baseId: 'loperam', name: 'Loperam (肚倍朗)', dose: '每次 1 粒', timing: '早、晚餐後服用', pillCss: 'w-7 h-3 rounded-full bg-gradient-to-r from-gray-400 to-green-600 border border-gray-300' }
    ]
  },
  {
    condition: '出現紅疹 / 過敏時',
    icon: <ShieldAlert className="w-5 h-5 text-red-500" />,
    meds: [
      { baseId: 'allegra', name: 'Allegra (艾來)', dose: '每次 1 粒', timing: '早、晚餐後服用', pillCss: 'w-6 h-4 rounded-full bg-orange-200 border border-orange-300' },
      { baseId: 'xyzal', name: 'XyzaL (驅異樂)', dose: '每次 1 粒', timing: '晚上使用', pillCss: 'w-8 h-3 rounded-full bg-white border border-gray-300' }
    ]
  }
];

const pillGuide = [
  { baseId: 'ts1', name: 'TS-1 (愛斯萬) 20mg', type: '化療主藥', desc: '全白色硬膠囊，印有 TC442。', pillCss: 'w-10 h-4 rounded-full bg-white border border-gray-400' },
  { baseId: 'folina', name: 'Folina (芙琳亞) 15mg', type: '化療輔助', desc: '白色圓扁形藥錠，中間有刻痕。', pillCss: 'w-6 h-6 rounded-full bg-white border border-gray-400 flex items-center justify-center', hasLine: true },
  { baseId: 'creon', name: 'Creon (卡利消) 300mg', type: '助消化', desc: '紅色+透明硬膠囊，內有微粒。', pillCss: 'w-10 h-4 rounded-full bg-gradient-to-r from-red-500 to-red-50 border border-red-200' },
  { baseId: 'panzolec', name: 'Panzolec (瘍康) 40mg', type: '護胃/防潰瘍', desc: '淡黃色橢圓形，印有 SCP。不可咬碎。', pillCss: 'w-8 h-5 rounded-full bg-yellow-100 border border-yellow-300' },
  { baseId: 'emetrol', name: 'EmetroL (癒吐寧) 10mg', type: '預防嘔吐', desc: '白色圓扁形，印有 031。', pillCss: 'w-6 h-6 rounded-full bg-white border border-gray-300' },
  { baseId: 'traceton', name: 'Traceton (服安痛)', type: '止痛藥', desc: '黃色長圓柱形，印有 YSP186。', pillCss: 'w-10 h-4 rounded-full bg-yellow-300 border border-yellow-400' },
  { baseId: 'loperam', name: 'Loperam (肚倍朗) 2mg', type: '止瀉備用', desc: '灰色+綠色硬膠囊。', pillCss: 'w-10 h-4 rounded-full bg-gradient-to-r from-gray-400 to-green-600 border border-gray-300' },
  { baseId: 'allegra', name: 'Allegra (艾來) 60mg', type: '過敏備用', desc: '淡橙色橢圓形，印有 06。', pillCss: 'w-8 h-5 rounded-full bg-orange-200 border border-orange-300' },
  { baseId: 'xyzal', name: 'XyzaL (驅異樂) 5mg', type: '過敏備用', desc: '白色長圓柱形，印有 Y。', pillCss: 'w-10 h-4 rounded-full bg-white border border-gray-300' }
];

// --- 主程式 ---
export default function App() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [checkedMeds, setCheckedMeds] = useState({});
  const [customImages, setCustomImages] = useState({});

  // 載入 localStorage 資料
  useEffect(() => {
    const savedChecks = localStorage.getItem('medChecklist');
    if (savedChecks) setCheckedMeds(JSON.parse(savedChecks));

    const savedImages = localStorage.getItem('pillImages');
    if (savedImages) setCustomImages(JSON.parse(savedImages));
  }, []);

  const toggleCheck = (id) => {
    const newState = { ...checkedMeds, [id]: !checkedMeds[id] };
    setCheckedMeds(newState);
    localStorage.setItem('medChecklist', JSON.stringify(newState));
  };

  const resetDaily = () => {
    if(window.confirm('確定要清除今天的吃藥紀錄嗎？')) {
      setCheckedMeds({});
      localStorage.removeItem('medChecklist');
    }
  };

  // 處理圖片上傳並壓縮，避免 localStorage 爆滿
  const handleImageUpload = (baseId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // 轉存為壓縮過的 JPEG Base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const newImages = { ...customImages, [baseId]: dataUrl };
        setCustomImages(newImages);
        localStorage.setItem('pillImages', JSON.stringify(newImages));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- 輔助圖形元件：會自動判斷要顯示真實照片還是模擬圖形 ---
  const PillDisplay = ({ baseId, css, hasLine }) => {
    if (customImages[baseId]) {
      return (
        <img 
          src={customImages[baseId]} 
          alt="pill" 
          className="w-12 h-12 object-cover rounded-full shadow-sm border border-gray-200 bg-white" 
        />
      );
    }
    return (
      <div className={`shadow-sm ${css} relative`}>
        {hasLine && <div className="w-full h-px bg-gray-300 absolute top-1/2 transform -translate-y-1/2"></div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-20 text-gray-800">
      {/* 頂部標題 */}
      <header className="bg-teal-600 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">沈女士的專屬服藥指南</h1>
          <p className="text-teal-100 text-sm mt-1">臺中榮民總醫院 - 一般外科處方</p>
        </div>
      </header>

      {/* 內容區塊 */}
      <main className="p-4 max-w-md mx-auto">
        
        {/* Tab 1: 每日課表 */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <span className="text-sm text-gray-600 flex items-center">
                <Calendar className="w-4 h-4 mr-2" /> 每日例行清單
              </span>
              <button 
                onClick={resetDaily}
                className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200"
              >
                重置今日打勾
              </button>
            </div>

            {/* 特別提醒 */}
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-xl shadow-sm flex items-start">
              <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-rose-800">
                <span className="font-bold">重要提醒：</span><br/>
                化療主藥 (TS-1) 與 輔助藥 (Folina) 處方天數為 <strong>6天</strong>，吃滿即須停藥，請特別留意。
              </p>
            </div>

            {scheduleData.map((period, index) => (
              <div key={index} className={`rounded-2xl shadow-sm border border-gray-200 overflow-hidden bg-white`}>
                <div className={`${period.bgColor} ${period.headerColor} p-3 font-bold flex items-center`}>
                  {period.icon}
                  <span className="ml-2 text-lg">{period.timeOfDay}</span>
                </div>
                <div className="p-2 space-y-4">
                  {period.slots.map((slot, sIndex) => (
                    <div key={sIndex} className="px-2">
                      <div className="flex items-center text-sm font-semibold text-gray-500 mb-2 border-b pb-1">
                        <Clock className="w-4 h-4 mr-1" /> {slot.timing}
                      </div>
                      <div className="space-y-3">
                        {slot.meds.map((med) => (
                          <div 
                            key={med.id} 
                            onClick={() => toggleCheck(med.id)}
                            className={`flex items-center p-3 rounded-xl border transition-all active:scale-95 cursor-pointer
                              ${checkedMeds[med.id] ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-100 hover:bg-gray-50 shadow-sm'}`}
                          >
                            <div className="mr-3">
                              {checkedMeds[med.id] ? (
                                <CheckCircle2 className="w-7 h-7 text-teal-500" />
                              ) : (
                                <Circle className="w-7 h-7 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <h4 className={`font-bold ${checkedMeds[med.id] ? 'text-teal-700 line-through opacity-70' : 'text-gray-800'}`}>
                                  {med.name}
                                </h4>
                                <span className="font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded text-sm">
                                  {med.dose}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{med.purpose}</p>
                              {med.isAlert && (
                                <p className="text-xs text-rose-600 font-bold mt-1 bg-rose-50 inline-block px-1 rounded">
                                  ⚠️ {med.alertText}
                                </p>
                              )}
                            </div>
                            <div className="ml-3 flex-shrink-0 flex items-center justify-center min-w-[3rem]">
                              <PillDisplay baseId={med.baseId} css={med.pillCss} hasLine={med.hasLine} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: 備用藥物 */}
        {activeTab === 'prn' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">有症狀才吃的備用藥</h2>
            
            {prnMeds.map((condition, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                <div className="bg-red-50 text-red-700 p-3 font-bold flex items-center border-b border-red-100">
                  {condition.icon}
                  <span className="ml-2">{condition.condition}</span>
                </div>
                <div className="p-4 space-y-3">
                  {condition.meds.map((med, mIdx) => (
                    <div key={mIdx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                      <div>
                        <h4 className="font-bold text-gray-800">{med.name}</h4>
                        <p className="text-sm text-teal-600 font-medium mt-1">{med.dose}</p>
                        <p className="text-xs text-gray-500 mt-1">時機: {med.timing}</p>
                      </div>
                      <div className="min-w-[3rem] flex justify-center">
                        <PillDisplay baseId={med.baseId} css={med.pillCss} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed mt-6">
              <Info className="w-5 h-5 inline mr-1 mb-1" />
              備用藥品平常不需要吃。若症狀緩解即可停用。若症狀持續嚴重，請提前回診。
            </div>
          </div>
        )}

        {/* Tab 3: 藥品圖鑑 */}
        {activeTab === 'guide' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-800 mb-2 px-1">圖文對照指南</h2>
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-3 rounded-xl text-xs mb-4 flex items-start">
              <Camera className="w-5 h-5 mr-2 flex-shrink-0" />
              <p>點擊下方的「拍照/上傳」，即可用您的手機拍攝真實的藥丸照片，替換掉預設的圖案喔！</p>
            </div>
            
            {pillGuide.map((med, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
                
                {/* 圖片顯示與上傳按鈕區域 */}
                <div className="mr-4 flex flex-col items-center">
                  <div className="w-16 h-16 flex items-center justify-center bg-gray-50 rounded-lg relative overflow-hidden mb-2">
                     <PillDisplay baseId={med.baseId} css={med.pillCss} hasLine={med.hasLine} />
                  </div>
                  
                  {/* 隱藏的 File Input，利用 Label 觸發 */}
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded text-[10px] font-bold flex items-center shadow-sm">
                    <Camera className="w-3 h-3 mr-1" /> {customImages[med.baseId] ? '更換照片' : '拍照/上傳'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" // 提示手機優先開啟後置鏡頭
                      className="hidden" 
                      onChange={(e) => handleImageUpload(med.baseId, e)}
                    />
                  </label>
                </div>

                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-sm">{med.name}</h4>
                  <span className="inline-block px-2 py-0.5 mt-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                    {med.type}
                  </span>
                  <p className="text-xs text-gray-500 mt-2">{med.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* 底部導覽列 */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center pb-safe">
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 py-3 flex flex-col items-center justify-center text-xs font-medium transition-colors
            ${activeTab === 'schedule' ? 'text-teal-600' : 'text-gray-400'}`}
        >
          <Calendar className="w-6 h-6 mb-1" />
          每日課表
        </button>
        <button 
          onClick={() => setActiveTab('prn')}
          className={`flex-1 py-3 flex flex-col items-center justify-center text-xs font-medium transition-colors
            ${activeTab === 'prn' ? 'text-teal-600' : 'text-gray-400'}`}
        >
          <AlertCircle className="w-6 h-6 mb-1" />
          備用藥品
        </button>
        <button 
          onClick={() => setActiveTab('guide')}
          className={`flex-1 py-3 flex flex-col items-center justify-center text-xs font-medium transition-colors
            ${activeTab === 'guide' ? 'text-teal-600' : 'text-gray-400'}`}
        >
          <Pill className="w-6 h-6 mb-1" />
          藥品圖鑑
        </button>
      </nav>
      
      {/* 處理 iPhone 底部安全區 */}
      <style dangerouslySetInnerHTML={{__html: `
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
    </div>
  );
}