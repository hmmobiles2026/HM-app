import type { Metadata, Viewport } from "next";
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
  title: "HM Stocks — Mobile Parts Management",
  description: "Stock management system for HM mobile phone parts shop",
  applicationName: "HM Stocks",
  // Lets iOS run it full screen from the home screen instead of inside Safari.
  appleWebApp: {
    capable: true,
    title: "HM Stocks",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

// themeColor belongs here, not in metadata — it has been deprecated there since
// Next.js 14. It tints the Android status bar when the app is installed.
export const viewport: Viewport = {
  themeColor: "#2563eb",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
