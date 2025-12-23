"use client";
import { useState, useEffect } from "react";
// 引入 Clerk 和 Supabase
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase"; // 引入刚才创建的连接工具

// 定义数据接口
interface Highlight {
  phrase: string;
  cn_meaning: string;
  reusability: string;
}

interface SavedItem {
  id: string;
  user_id: string; // 新增：区分用户
  created_at: string;
  part: string;
  topic: string;
  band: string;
  ai_script: string;       // 注意：数据库里我们用了下划线命名
  highlights: Highlight[];
  personal_script: string; // 注意：数据库里我们用了下划线命名
}

export default function Home() {
  const { user } = useUser(); // 获取当前登录用户信息

  // --- 基础状态 ---
  const [part, setPart] = useState<string>("Part 1");
  const [band, setBand] = useState<string>("7.0");
  const [topic, setTopic] = useState<string>("");
  const [idea, setIdea] = useState<string>("");
  
  // --- 内容状态 ---
  const [aiScript, setAiScript] = useState<string>("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [personalScript, setPersonalScript] = useState<string>(""); 
  
  // --- 系统状态 ---
  const [loading, setLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]); 
  const [currentId, setCurrentId] = useState<string | null>(null);

  // 1. 初始化：从 Supabase 云端加载历史记录
  useEffect(() => {
    // 只有用户登录了才加载
    if (user) {
      fetchRecords();
    }
  }, [user]);

  // 从云端拉取数据的函数
  const fetchRecords = async () => {
    if (!user) return;
    
    // 查询：找所有 user_id 等于当前用户的记录，按时间倒序
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("加载失败:", error);
    } else {
      setSavedItems(data || []);
    }
  };

  // 2. 生成 AI 答案 (保持不变)
  const handleGenerate = async () => {
    if (!topic || !idea) return alert("请输入题目和想法");
    setLoading(true);
    // 先不清空内容，防止用户误触生成丢失编辑
    // setAiScript(""); 
    // setHighlights([]);
    // setPersonalScript("");
    
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
        // 如果是新建，才覆盖个人修改版；如果是编辑旧的，不要覆盖用户已经写的
        if (!currentId) {
          setPersonalScript(script);
        }
      }
    } catch (error: any) {
      alert("生成出错: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. 保存或更新 (上传到云端)
  const handleSave = async () => {
    if (!topic || !aiScript || !user) return alert("没有内容可保存或未登录");

    const recordId = currentId || Date.now().toString();

    const newData = {
      id: recordId,
      user_id: user.id, // 关键：标记这是谁的数据
      part,
      topic,
      band,
      ai_script: aiScript,
      personal_script: personalScript,
      highlights: highlights,
      // created_at 会由数据库自动生成/更新
    };

    // Upsert: 如果ID存在就更新，不存在就插入
    const { error } = await supabase
      .from('records')
      .upsert(newData);

    if (error) {
      alert("保存失败: " + error.message);
    } else {
      alert("✅ 云端同步成功！");
      setCurrentId(recordId);
      fetchRecords(); // 重新拉取最新列表
    }
  };

  // 4. 加载某一条记录
  const loadItem = (item: SavedItem) => {
    setCurrentId(item.id);
    setPart(item.part);
    setBand(item.band);
    setTopic(item.topic);
    setAiScript(item.ai_script); // 数据库字段转驼峰
    setHighlights(item.highlights);
    setPersonalScript(item.personal_script); // 数据库字段转驼峰
  };

  // 5. 删除记录 (云端删除)
  const deleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("确定删除这条云端记录吗？")) return;

    const { error } = await supabase
      .from('records')
      .delete()
      .eq('id', id);

    if (error) {
      alert("删除失败");
    } else {
      fetchRecords(); // 刷新列表
      if (currentId === id) resetForm();
    }
  };

  const resetForm = () => {
    setCurrentId(null);
    setTopic("");
    setIdea("");
    setAiScript("");
    setHighlights([]);
    setPersonalScript("");
  };

  // 朗读功能 (保持不变)
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
    <div className="h-screen flex flex-col font-sans text-gray-900 bg-gray-100">
      
      {/* 未登录界面 */}
      <SignedOut>
        <div className="flex flex-col items-center justify-center h-full space-y-6">
          <h1 className="text-4xl font-bold text-blue-600">雅思口语备考助手 AI</h1>
          <p className="text-gray-600">你需要登录才能使用云同步功能</p>
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition cursor-pointer font-bold">
            <SignInButton mode="modal" />
          </div>
        </div>
      </SignedOut>

      {/* 已登录界面 */}
      <SignedIn>
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700 text-lg">IELTS Prep Pro</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">云同步已开启</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>

        <div className="flex flex-1 overflow-hidden">
             
            {/* 左侧侧边栏 */}
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
                            <div className="text-xs text-gray-400 mt-1">
                                {item.band} 分 | {new Date(item.created_at).toLocaleDateString()}
                            </div>
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
                    <div className="text-center text-gray-400 text-sm mt-10">云端暂无记录</div>
                )}
                </div>
            </div>

            {/* 右侧主内容区 */}
            <div className="flex-1 overflow-y-auto h-full p-8">
                <div className="max-w-4xl mx-auto space-y-8 pb-20">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {currentId ? "📝 编辑存档 (已同步云端)" : "🚀 开始新话题"}
                    </h2>
                    {(aiScript || personalScript) && (
                        <button 
                        onClick={handleSave}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition text-sm flex items-center gap-2"
                        >
                        ☁️ 保存到云端
                        </button>
                    )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                    <select value={part} onChange={(e) => setPart(e.target.value)} className="border p-2 rounded bg-gray-50">
                        <option>Part 1</option><option>Part 2</option><option>Part 3</option>
                    </select>
                    <select value={band} onChange={(e) => setBand(e.target.value)} className="border p-2 rounded bg-gray-50">
                        <option>6.0</option><option>7.0</option><option>8.0</option>
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
                    placeholder="你的中文想法..." 
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

                {(aiScript || personalScript) && (
                    <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
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
                        placeholder="你可以直接在这里修改..."
                        />
                        <div className="absolute bottom-2 right-4 text-xs text-gray-400 pointer-events-none">
                        修改后记得点击上方“保存”按钮
                        </div>
                    </div>

                    </div>
                )}

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
      </SignedIn>
    </div>
  );
}