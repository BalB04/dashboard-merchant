import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merchant Dashboard",
  description: "Merchant analytics dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
