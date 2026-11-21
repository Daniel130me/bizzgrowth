import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nellovia — Understand what is driving your business growth",
  description:
    "Nellovia is an AI business consultant. It turns scattered marketing, sales and website signals into clear decisions. Understand what is happening in your business, why it is happening, and what you should do next.",
  // Icons come from the files in this folder: icon.svg, favicon.ico and apple-icon.png (scripts/brand-icons.mjs).
};

export const viewport: Viewport = {
  themeColor: "#1DA1F2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
