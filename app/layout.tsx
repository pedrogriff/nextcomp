import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextComp | Algorithmic Compensation Architecture",
  description:
    "Real-time equity modeling, vesting simulator, and compensation intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-navy-canvas text-slate-100 antialiased min-h-screen selection:bg-terminal-cyan/20 selection:text-terminal-cyan`}
      >
        {children}
      </body>
    </html>
  );
}
