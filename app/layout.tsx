import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 引入 Clerk 提供者
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "雅思口语备考助手",
  description: "AI 驱动的雅思口语练习工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 用 ClerkProvider 包裹 HTML
    <ClerkProvider>
      <html lang="zh-CN">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}