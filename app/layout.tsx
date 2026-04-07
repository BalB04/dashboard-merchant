import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
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

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
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
      <body className={`${plusJakartaSans.variable} ${ibmPlexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
