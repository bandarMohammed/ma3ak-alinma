"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../store/useStore";
import { useLanguage } from "../context/LanguageContext";

export default function Home() {
  const { checkSession, user, loading } = useStore();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    const initSession = async () => {
      const activeUser = await checkSession();
      if (activeUser) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    };
    initSession();
  }, [checkSession, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-cream text-brand-navy">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        {/* Stylized Alinma Open-Door Logo */}
        <div className="w-20 h-20 bg-brand-navy flex items-center justify-center rounded-2xl shadow-lg relative overflow-hidden">
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {/* Simple Elegant Alinma door silhouette */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-wide mt-2 text-brand-navy">
          {t("appName")}
        </h1>
        <p className="text-sm font-medium text-brand-navy/60 text-center max-w-xs">
          {t("tagline")}
        </p>
        
        {/* Soft elegant loading ring */}
        <div className="w-8 h-8 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin mt-4"></div>
      </div>
    </div>
  );
}
