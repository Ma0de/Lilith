'use client';

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useState } from "react";
import { LoadingAnimation } from "@/components/LoadingAnimation";
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
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    setShowAnimation(false);
  }, []);

  if (showAnimation) {
    return (
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <LoadingAnimation />
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