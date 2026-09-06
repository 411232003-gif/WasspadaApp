import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { AlertProvider } from "@/lib/alert-context";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { LiveAlertSync } from "@/components/live-alert-sync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WasspadaApp | Kelurahan Disaster Monitor",
  description:
    "Aplikasi monitoring bencana kelurahan berbasis data BMKG dengan visualisasi 3D, peta interaktif, dan peringatan waspada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col theme-transition">
        <ThemeProvider>
          <Header />
          <div className="relative flex flex-1">
            <Sidebar />
            <main className="flex-1 md:pl-64 pb-20 md:pb-0">
              <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <AlertProvider>
                  {children}
                  <LiveAlertSync />
                </AlertProvider>
              </div>
            </main>
          </div>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
