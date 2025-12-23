"use client";
import { useState, useEffect } from "react";

// 定义核心数据结构
interface Highlight {
  phrase: string;
  cn_meaning: string;
  reusability: string;
}

interface SavedItem {
  id: string; // 唯一标识符
  timestamp: number;
  part: string;
  topic: string;
  band: string;
  aiScript: string;     // AI 原版范文
  highlights: Highlight[]; // 高分词汇
  personalScript: string; // 用户个人修改版
}

export default function Home() {
  // --- 基础状态 ---
  const [part, setPart] = useState<string>("Part 1");
  const [band, setBand] = useState<string>("7.0");
  const [topic, setTopic] = useState<string>("");
  const [idea, setIdea] = useState<string>("");
  
  // --- 内容状态 ---
  const [aiScript, setAiScript] = useState<string>("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [personalScript, setPersonalScript] = useState<string>(""); // 个人修改版内容
  
  // --- 系统状态 ---
  const [loading, setLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]); // 所有存档
  const [currentId, setCurrentId] = useState<string | null>(null); // 当前正在编辑的存档ID

  // 1. 初始化：从浏览器本地存储加载历史记录
  useEffect(() => {
    const saved = localStorage.getItem("ielts_records");
    if (saved) {
      setSavedItems(JSON.parse(saved));
    }
  }, []);

  // 2. 生成 AI 答案
  const handleGenerate = async () => {
    if (!topic || !idea) return alert("请输入题目和想法");
    setLoading(true);
    setAiScript("");
    setHighlights([]);
    setPersonalScript("");
    setCurrentId(null); // 生成新内容时，重置当前ID

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part, band, topic, idea }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.details || "请求失败");
      
      if (data.result) {
        const parsedData = JSON.parse(data.result);
        const script = parsedData.content;
        setAiScript(script);
        setHighlights(parsedData.highlights || []);
        setPersonalScript(script); // 默认将 AI 范文填入个人修改区，方便用户微调
      }
    } catch (error: any) {
      alert("生成出错: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. 保存或更新当前记录
  const handleSave = () => {
    if (!topic || !aiScript) return alert("没有内容可保存");

    const newItem: SavedItem = {
      id: currentId || Date.now().toString(), // 如果是旧记录就用旧ID，否则生成新ID
      timestamp: Date.now(),
      part,
      topic,
      band,
      aiScript,
      highlights,
      personalScript // 保存当前的个人修改版
    };

    let newItems = [];
    if (currentId) {
      // 更新现有记录
      newItems = savedItems.map(item => item.id === currentId ? newItem : item);
    } else {
      // 创建新记录
      newItems = [newItem, ...savedItems];
    }

    setSavedItems(newItems);
    setCurrentId(newItem.id);
    localStorage.setItem("ielts_records", JSON.stringify(newItems)); // 存入本地存储
    alert("✅ 保存成功！");
  };

  // 4. 加载某一条历史记录
  const loadItem = (item: SavedItem) => {
    setCurrentId(item.id);
    setPart(item.part);
    setBand(item.band);
    setTopic(item.topic);
    // 这里不清空 idea，保留用户可能想重新生成的意图，或者你可以选择不加载 idea
    setAiScript(item.aiScript);
    setHighlights(item.highlights);
    setPersonalScript(item.personalScript);
  };

  // 5. 删除记录
  const deleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // 防止触发 loadItem
    if (!confirm("确定删除这条记录吗？")) return;
    const newItems = savedItems.filter(item => item.id !== id);
    setSavedItems(newItems);
    localStorage.setItem("ielts_records", JSON.stringify(newItems));
    if (currentId === id) resetForm();
  };

  // 6. 重置表单（新建）
  const resetForm = () => {
    setCurrentId(null);
    setTopic("");
    setIdea("");
    setAiScript("");
    setHighlights([]);
    setPersonalScript("");
  };

  // 7. 朗读功能 (支持朗读 AI 原版 或 个人修改版)
  const speakText = (textToSpeak: string) => {
    if (!textToSpeak) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.name.includes("Natural") && v.lang.includes("en")) 
                   || voices.find(v => v.lang.includes("en"));
    if (bestVoice) utterance.voice = bestVoice;
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      
      {/* --- 左侧侧边栏 (Sidebar) --- */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <button 
            onClick={resetForm}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
          >
            + 新建练习
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* 按 Part 分组显示 */}
          {["Part 1", "Part 2", "Part 3"].map(p => {
            const itemsInPart = savedItems.filter(i => i.part === p);
            if (itemsInPart.length === 0) return null;
            return (
              <div key={p}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">{p}</h3>
                <div className="space-y-1">
                  {itemsInPart.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => loadItem(item)}
                      className={`group p-3 rounded-md cursor-pointer text-sm border hover:border-blue-200 transition relative
                        ${currentId === item.id ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-transparent text-gray-600 hover:bg-gray-50"}`}
                    >
                      <div className="font-medium truncate pr-4">{item.topic}</div>
                      <div className="text-xs text-gray-400 mt-1">{item.band} 分 | {new Date(item.timestamp).toLocaleDateString()}</div>
                      
                      {/* 删除按钮 (悬停显示) */}
                      <button 
                        onClick={(e) => deleteItem(e, item.id)}
                        className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 font-bold px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {savedItems.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-10">暂无历史记录</div>
          )}
        </div>
      </div>

      {/* --- 右侧主内容区 --- */}
      <div className="flex-1 overflow-y-auto h-full p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
          
          {/* 1. 顶部输入区 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {currentId ? "📝 编辑存档" : "🚀 开始新话题"}
              </h2>
              {/* 如果已经生成了内容，显示保存按钮 */}
              {(aiScript || personalScript) && (
                <button 
                  onClick={handleSave}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition text-sm flex items-center gap-2"
                >
                  💾 保存全部进度
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <select value={part} onChange={(e) => setPart(e.target.value)} className="border p-2 rounded bg-gray-50">
                <option>Part 1</option><option>Part 2</option><option>Part 3</option>
              </select>
              <select value={band} onChange={(e) => setBand(e.target.value)} className="border p-2 rounded bg-gray-50">
                <option>6.0</option><option>6.5</option><option>7.0</option><option>7.5</option><option>8.0</option>
              </select>
            </div>
            
            <input 
              className="w-full border p-2 rounded bg-gray-50 mb-3" 
              placeholder="题目 (Topic)" 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
            />
            <textarea 
              className="w-full border p-2 rounded bg-gray-50 mb-3" 
              rows={2}
              placeholder="你的中文想法 (用于生成基础范文)..." 
              value={idea} 
              onChange={(e) => setIdea(e.target.value)} 
            />
            
            <button 
              onClick={handleGenerate} 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
            >
              {loading ? "AI 正在创作中..." : "✨ 生成 / 重新生成范文"}
            </button>
          </div>

          {/* 2. 双栏显示区：左边AI范文，右边个人修改 */}
          {(aiScript || personalScript) && (
            <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
              
              {/* 左侧：AI 范文区 */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col h-full">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-blue-600 uppercase tracking-wider">AI 参考范文</span>
                  <button onClick={() => speakText(aiScript)} className="text-xs bg-white text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100">
                    🔊 朗读此版
                  </button>
                </div>
                <div className="text-gray-800 leading-relaxed whitespace-pre-line text-sm flex-1">
                  {aiScript}
                </div>
              </div>

              {/* 右侧：个人修改区 (核心新功能) */}
              <div className="bg-white p-6 rounded-xl border-2 border-orange-100 shadow-sm flex flex-col h-full relative">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-orange-600 uppercase tracking-wider">✏️ 我的专属修改版</span>
                  <button onClick={() => speakText(personalScript)} className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100">
                    🔊 朗读我的版本
                  </button>
                </div>
                <textarea
                  className="w-full flex-1 bg-transparent border-none resize-none focus:ring-0 text-gray-800 leading-relaxed whitespace-pre-line text-sm min-h-[300px]"
                  value={personalScript}
                  onChange={(e) => setPersonalScript(e.target.value)}
                  placeholder="你可以直接在这里修改，结合你自己的真实情况..."
                />
                <div className="absolute bottom-2 right-4 text-xs text-gray-400 pointer-events-none">
                  修改后记得点击上方“保存”按钮
                </div>
              </div>

            </div>
          )}

          {/* 3. 高分词汇区 */}
          {highlights.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">✨ 可复用高分搭配</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {highlights.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900">{item.phrase}</span>
                      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border">{item.cn_meaning}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">💡 {item.reusability}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}