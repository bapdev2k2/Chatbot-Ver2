import type React from "react";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "BapDev AI - Trợ lý AI thông minh",
  description: "Trợ lý AI thông minh cho mọi nhu cầu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
