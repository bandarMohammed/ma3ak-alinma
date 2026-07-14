"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../context/LanguageContext";
import { Home, MessageSquare, PieChart, ArrowLeftRight, Settings } from "lucide-react";
import { motion } from "framer-motion";

interface BottomNavProps {
  activeTab: "home" | "chat" | "reports" | "transactions" | "settings";
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const router = useRouter();
  const { t } = useLanguage();

  const navItems = [
    { id: "home", label: t("greeting").replace(",", ""), icon: Home, route: "/dashboard" },
    { id: "transactions", label: t("recentTransactions").substring(0, 10), icon: ArrowLeftRight, route: "/transactions" },
    { id: "chat", label: t("actionChat"), icon: MessageSquare, route: "/chat", isAi: true },
    { id: "reports", label: t("reportsHistoryTitle").substring(0, 12), icon: PieChart, route: "/reports" },
    { id: "settings", label: t("profileTitle").substring(0, 10), icon: Settings, route: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-brand-navy/5 shadow-2xl max-w-md mx-auto rounded-t-3xl pb-safe md:hidden">
      <div className="flex items-center justify-around py-3 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isAi) {
            return (
              <div key={item.id} className="relative -mt-8 flex flex-col items-center">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push(item.route)}
                  aria-label={item.label}
                  className="w-14 h-14 bg-brand-purple flex items-center justify-center rounded-full text-white shadow-lg shadow-brand-purple/40 border-4 border-white ai-pulse-glow relative focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2 transition-all duration-200"
                >
                  <Icon className="w-6 h-6 animate-pulse" />
                </motion.button>
                <span className="text-[10px] font-bold text-brand-purple mt-1.5 uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.route)}
              aria-label={item.label}
              className="flex flex-col items-center justify-center w-16 py-1 text-brand-navy/60 hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-1 rounded-xl transition-all duration-200 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -top-3 w-8 h-1 bg-brand-navy rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={`w-5 h-5 transition-transform ${isActive ? "text-brand-navy scale-110" : "text-brand-navy/40"}`} />
              <span className={`text-[9px] font-bold mt-1.5 truncate max-w-[65px] ${isActive ? "text-brand-navy font-extrabold" : "text-brand-navy/40 font-semibold"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
