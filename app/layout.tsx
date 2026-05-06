import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GlobalLoadingProvider } from "@/components/global-loading-provider";
import { PageTopLoader } from "@/components/page-top-loader";

import "./globals.css";

const themeInitScript = `
(() => {
  const storageKey = "dashboard-theme";
  const root = document.documentElement;
  try {
    const stored = window.localStorage.getItem(storageKey);
    const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "dark" || stored === "light" ? stored : (systemDark ? "dark" : "light");
    root.dataset.theme = theme;
  } catch {
    root.dataset.theme = "light";
  }
})();
`;

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Merchant Dashboard",
  description: "Merchant analytics dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GlobalLoadingProvider>
          <PageTopLoader />
          {children}
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
