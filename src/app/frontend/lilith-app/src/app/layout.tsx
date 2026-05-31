'use client';

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useState } from "react";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { AnimationText } from "@/components/AnimationText";
import { Button } from "@/components/Button";
import { getWebSocketClient } from "@/lib/websocket";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    const wsClient = getWebSocketClient();
    let timeoutId: NodeJS.Timeout | null = null;
    let isResolved = false;

    const handleSuccess = () => {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      setIsLoading(false);
      setFatalError(null);
      wsClient.onOpen = null;
      wsClient.onError = null;
    };

    const handleFailure = () => {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      setIsLoading(false);
      setFatalError(
        "无法连接到服务端。请尝试重启应用或刷新网页，也可以尝试联系开发人员"
      );
      wsClient.onOpen = null;
      wsClient.onError = null;
    };

    // 设置 700ms 超时
    timeoutId = setTimeout(() => {
      if (!isResolved && !wsClient.isConnected()) {
        handleFailure();
      }
    }, 700);

    wsClient.onOpen = handleSuccess;
    wsClient.onError = handleFailure;

    // 检查当前连接状态
    if (wsClient.isConnected()) {
      handleSuccess();
    } else {
      // 开始连接
      wsClient.connect();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      wsClient.onOpen = null;
      wsClient.onError = null;
    };
  }, []);

  // 显示加载动画（加载中或超时前）
  if (isLoading) {
    return (
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <LoadingAnimation />
        </body>
      </html>
    );
  }

  // 显示致命错误
  if (fatalError) {
    return (
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
          <div className="flex flex-col flex-1 items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
              {/* 错误图标 */}
              <div className="mb-8 flex justify-center">
                <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>

              {/* 错误代码 */}
              <div className="mb-4">
                <span className="text-xs font-mono tracking-wider text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full">
                  ERROR #NET_WS_CONN_FAIL
                </span>
              </div>

              {/* 错误标题 */}
              <AnimationText
                text="无法连接到 WebSocket 服务器"
                className="text-3xl font-bold text-black dark:text-white mb-4"
                delay={0}
                duration={500}
              />

              {/* 错误描述 */}
              <AnimationText
                text={fatalError}
                className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8 block"
                delay={100}
                duration={500}
              />

              {/* 操作按钮组 */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => window.location.reload()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  刷新页面
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setFatalError(null);
                    setIsLoading(true);
                    const wsClient = getWebSocketClient();
                    wsClient.disconnect();

                    let timeoutId: NodeJS.Timeout | null = null;
                    let isResolved = false;

                    const handleSuccess = () => {
                      if (isResolved) return;
                      isResolved = true;
                      if (timeoutId) clearTimeout(timeoutId);
                      setIsLoading(false);
                      setFatalError(null);
                      wsClient.onOpen = null;
                      wsClient.onError = null;
                    };

                    const handleFailure = () => {
                      if (isResolved) return;
                      isResolved = true;
                      if (timeoutId) clearTimeout(timeoutId);
                      setIsLoading(false);
                      setFatalError(
                        "无法连接到服务端。请尝试重启应用或刷新网页，也可以尝试联系开发人员"
                      );
                      wsClient.onOpen = null;
                      wsClient.onError = null;
                    };

                    timeoutId = setTimeout(() => {
                      if (!isResolved && !wsClient.isConnected()) {
                        handleFailure();
                      }
                    }, 700);

                    wsClient.onOpen = handleSuccess;
                    wsClient.onError = handleFailure;

                    setTimeout(() => {
                      wsClient.connect();
                    }, 100);
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重试连接
                </Button>
              </div>

              {/* 提示文字 */}
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-8">
                如果问题持续存在，请尝试联系开发者获取帮助
              </p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}