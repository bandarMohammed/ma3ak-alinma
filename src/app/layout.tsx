import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../context/LanguageContext";
import { ResponsiveFrame } from "../components/ResponsiveFrame";

export const metadata: Metadata = {
  title: "معك | Ma3ak - Alinma Bank Personal Finance Companion",
  description: "مصرف الإنماء - مستشارك المالي الشخصي بالذكاء الاصطناعي | Alinma Bank's AI-Powered Personal Finance Companion - Amad Hackathon Project",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🦊</text></svg>" />
      </head>
      <body className="antialiased select-none">
        <LanguageProvider>
          <ResponsiveFrame>
            {children}
          </ResponsiveFrame>
        </LanguageProvider>
      </body>
    </html>
  );
}
