import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: "API Key missing" }, { status: 500 });
  }

  try {
    const { topic, idea, band, part } = await request.json();

    const genAI = new GoogleGenerativeAI(apiKey);
    // 使用 flash 模型，速度快且支持 JSON 输出
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      // 强制让 AI 输出 JSON 格式，这非常关键
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert IELTS examiner. 
      
      Task 1: Create a Band ${band} response for IELTS Speaking ${part}.
      Topic: ${topic}
      Candidate's Idea: ${idea}
      Requirement: Speak naturally, use idiomatic collocations suitable for Band ${band}.

      Task 2: Identify 3-5 "Magic Phrases" (high-scoring collocations or idioms) from the response you just wrote.
      - These phrases must be generic enough to be REUSED in other topics.
      - Provide their Chinese meaning.
      
      Output Format: Return a raw JSON object (no markdown) with this exact structure:
      {
        "content": "The full English spoken response text here...",
        "highlights": [
          { 
            "phrase": "the English phrase", 
            "cn_meaning": "Chinese meaning", 
            "reusability": "Brief tip on where else to use this (in Chinese)" 
          }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 直接返回 JSON 字符串，前端去解析
    return NextResponse.json({ result: text });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      error: "生成失败", 
      details: error.message 
    }, { status: 500 });
  }
}