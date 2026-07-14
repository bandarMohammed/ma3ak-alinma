"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../context/LanguageContext";
import { useStore } from "../store/useStore";
import { Globe, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, showBack = false }) => {
  const router = useRouter();
  const { t, toggleLanguage, language, isRtl } = useLanguage();
  const { logout, user } = useStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-35 bg-white/70 backdrop-blur-xl border-b border-brand-navy/5 shadow-sm px-6 py-4 flex items-center justify-between max-w-md mx-auto rounded-b-3xl md:hidden">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={() => router.back()}
            aria-label={t("back")}
            className="p-2 rounded-xl bg-brand-cream/60 hover:bg-brand-cream text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/70 focus-visible:ring-offset-1 transition-all duration-200 font-bold text-sm"
          >
            {isRtl ? "←" : "←"} {t("back")}
          </button>
        ) : (
          /* Small Alinma Door Branding Logo */
          <div className="w-9 h-9 bg-brand-navy flex items-center justify-center rounded-xl shadow-md relative overflow-hidden">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}

        {!showBack && (
          <div>
            <h1 className="text-base font-extrabold text-brand-navy tracking-tight leading-none">
              {title || t("appName")}
            </h1>
            {!title && (
              <span className="text-[9px] font-bold text-brand-purple/75 uppercase block mt-1 tracking-wider">
                {t("tagline").substring(0, 30)}...
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language Toggler */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleLanguage}
          aria-label={language === "ar" ? "Switch language to English" : "تغيير اللغة إلى العربية"}
          className="p-2.5 rounded-full hover:bg-brand-cream/60 text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/70 transition-all duration-200 flex items-center justify-center"
          title={language === "ar" ? "English" : "عربي"}
        >
          <Globe className="w-5 h-5 text-brand-purple" />
        </motion.button>

        {/* User / Sign Out Trigger */}
        {user && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            aria-label={t("logoutButton")}
            className="p-2.5 rounded-full hover:bg-brand-danger/10 text-brand-navy/60 hover:text-brand-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-danger/70 transition-all duration-200 flex items-center justify-center"
            title={t("logoutButton")}
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </header>
  );
};
