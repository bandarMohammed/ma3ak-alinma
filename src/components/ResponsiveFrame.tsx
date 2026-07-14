"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "../context/LanguageContext";
import { useStore } from "../store/useStore";
import { motion } from "framer-motion";
import { 
  Home, MessageSquare, PieChart, ArrowLeftRight, Settings, 
  Globe, LogOut, User, Sparkles, Bot, ShieldAlert
} from "lucide-react";
import { RiyalSymbol } from "./RiyalSymbol";

export const ResponsiveFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t, toggleLanguage, language, isRtl } = useLanguage();
  const { user, logout, accounts } = useStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin"></div>
      </div>
    );
  }

  // If on login page, render full screen directly (both desktop and mobile)
  const isLoginPage = pathname === "/login" || pathname === "/" || !user;

  if (isLoginPage) {
    return <div className="w-full min-h-screen bg-brand-cream">{children}</div>;
  }

  const account = accounts[0];

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const menuItems = [
    { id: "home", label_ar: "الرئيسية", label_en: "Home Dashboard", icon: Home, route: "/dashboard" },
    { id: "chat", label_ar: "اسأل معك (مساعد الذكاء الاصطناعي)", label_en: "Ask Ma3ak (AI)", icon: MessageSquare, route: "/chat", isAi: true },
    { id: "transactions", label_ar: "سجل العمليات", label_en: "Transactions History", icon: ArrowLeftRight, route: "/transactions" },
    { id: "reports", label_ar: "التقارير المحفوظة", label_en: "Saved Reports", icon: PieChart, route: "/reports" },
    { id: "settings", label_ar: "الملف الشخصي والإعدادات", label_en: "Settings & Profile", icon: Settings, route: "/profile" },
  ];

  return (
    <div className="min-h-screen w-full bg-brand-cream/25 flex transition-all duration-500 ease-in-out">
      
      {/* 
        HYBRID SITE LAYOUT
        - On Mobile (< 768px): hides sidebar, renders active page full screen.
        - On Desktop (>= 768px): wide sidebar on the side (RTL left/right automatic), main workspace expands.
      */}
      <div className={`w-full min-h-screen flex flex-col md:flex-row ${isRtl ? "md:flex-row-reverse" : "md:flex-row"} transition-all duration-500`}>
        
        {/* ============================================================================
            1. CORPORATE SIDEBAR (Desktop >= 768px, Hidden on Mobile)
            ============================================================================ */}
        <aside className="hidden md:flex md:w-80 min-h-screen bg-brand-navy text-white flex-col justify-between p-6 border-brand-navy/10 relative overflow-hidden select-none flex-shrink-0 shadow-2xl">
          
          {/* Background Gradient & Geometric Saudi motifs */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-navy to-brand-navy/95 z-0"></div>
          <div className="absolute inset-0 opacity-5 z-0">
            <svg className="w-full h-full text-brand-cream" fill="none" viewBox="0 0 200 200" stroke="currentColor" strokeWidth={1.5}>
              <path d="M100,0 L100,200 M0,100 L200,100" />
              <rect x="50" y="50" width="100" height="100" transform="rotate(45 100 100)" />
            </svg>
          </div>

          <div className="z-10 space-y-6 flex flex-col h-full justify-between">
            <div>
              {/* Alinma Gold Logo */}
              <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/10">
                <div className="w-10 h-10 bg-white flex items-center justify-center rounded-2xl shadow-md overflow-hidden flex-shrink-0">
                  <svg className="w-6 h-6 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-brand-orange block leading-none">
                    alinma bank
                  </span>
                  <span className="text-[10px] font-bold text-white/50 block mt-0.5">
                    {isRtl ? "مصرف الإنماء" : "Alinma Bank"}
                  </span>
                </div>
              </div>

              {/* Ma3ak AI promotion banner on sidebar */}
              <div className="bg-gradient-to-br from-brand-purple/20 to-white/5 border border-white/10 rounded-2xl p-4 mb-6 shadow-inner">
                <div className="flex items-center gap-2 text-brand-orange mb-1.5">
                  <Bot className="w-4 h-4 text-brand-purple animate-bounce-slow" />
                  <span className="text-[9.5px] font-black uppercase tracking-wider">
                    {isRtl ? "المساعد الذكي مَعَك" : "Ma3ak AI Companion"}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-white/65 leading-relaxed">
                  {isRtl 
                    ? "مستشارك المالي الشخصي المدعوم بـ GPT-4o-mini متصل ومستعد لتحليل ميزانيتك." 
                    : "Your personal financial companion wired to GPT-4o-mini, ready to audit your budget."}
                </p>
              </div>

              {/* Navigation Menu */}
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.route;
                  const label = isRtl ? item.label_ar : item.label_en;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.route)}
                      aria-label={label}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-1 ${
                        isActive 
                          ? "bg-brand-purple text-white shadow-md shadow-brand-purple/20" 
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebarActive"
                          className="absolute inset-0 bg-brand-purple rounded-2xl -z-10"
                        />
                      )}
                      <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-white/40"}`} />
                      <span>{label}</span>
                      {item.isAi && (
                        <span className="ms-auto flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-orange"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* User Profile Card & Sign out at the bottom */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white/80">
                  <User className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h4 className="text-[11px] font-black text-white truncate max-w-[150px]">{user.full_name}</h4>
                  <span className="text-[9px] font-bold text-white/40 block mt-0.5 truncate max-w-[150px]">{user.email}</span>
                </div>
              </div>

              <div className="bg-brand-orange/15 border border-brand-orange/20 rounded-xl p-2.5 flex items-start gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-brand-orange flex-shrink-0 mt-0.5" />
                <p className="text-[8px] font-bold text-white/60 leading-normal">
                  {isRtl 
                    ? "هاكاثون أَمَدْ - أكاديمية طويق" 
                    : "Amad Hackathon - Tuwaiq Academy"}
                </p>
              </div>

              <button
                onClick={handleLogout}
                aria-label={t("logoutButton")}
                className="w-full py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-brand-danger/10 hover:border-brand-danger/20 text-[10px] font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-danger focus-visible:ring-offset-1 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t("logoutButton")}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ============================================================================
            2. DESKTOP MAIN CONTENT CANVAS & WORKSPACE
            ============================================================================ */}
        <div className="flex-grow flex flex-col min-h-screen relative overflow-hidden bg-brand-cream/30">
          
          {/* 
            TOP NAVIGATION ACTION BAR (Desktop >= 768px, Hidden on Mobile)
          */}
          <header className="hidden md:flex w-full bg-white/80 backdrop-blur-md border-b border-brand-navy/5 px-8 py-4.5 items-center justify-between shadow-sm z-30 select-none">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-brand-navy">
                {pathname === "/dashboard" && t("spendingOverview")}
                {pathname === "/chat" && t("chatTitle")}
                {pathname === "/reports" && t("reportsHistoryTitle")}
                {pathname === "/transactions" && t("transactionsTitle")}
                {pathname === "/profile" && t("profileTitle")}
              </span>
              
              <div className="w-1.5 h-1.5 bg-brand-success rounded-full animate-pulse ms-2"></div>
              <span className="text-[9px] font-bold text-brand-navy/40 uppercase tracking-widest">
                {isRtl ? "حساب نشط وآمن" : "Active & Secure Session"}
              </span>
            </div>

            <div className="flex items-center gap-5">
              
              {/* Account summary display */}
              {account && (
                <div className="flex items-center gap-2 text-right">
                  <div className="text-[9px] font-bold text-brand-navy/40 uppercase leading-none">
                    {isRtl ? "رصيدك المتاح" : "Your Balance"}
                  </div>
                  <span className="text-sm font-black text-brand-navy">
                    {account.balance.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}
                  </span>
                </div>
              )}

              <div className="h-5 w-px bg-brand-navy/10"></div>

              {/* Language Selector */}
              <button
                onClick={toggleLanguage}
                aria-label={language === "ar" ? "Switch language to English" : "تغيير اللغة إلى العربية"}
                className="p-2 rounded-xl hover:bg-brand-cream/50 text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/70 transition-all duration-200 flex items-center gap-1.5 text-[10px] font-black"
              >
                <Globe className="w-4 h-4 text-brand-purple" />
                <span>{language === "ar" ? "English" : "عربي"}</span>
              </button>

              <div className="h-5 w-px bg-brand-navy/10"></div>

              {/* Sign out */}
              <button
                onClick={handleLogout}
                aria-label={t("logoutButton")}
                className="p-2 rounded-xl hover:bg-brand-danger/10 text-brand-navy/50 hover:text-brand-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-danger/70 transition-all duration-200 flex items-center justify-center gap-1 text-[10px] font-black"
                title={t("logoutButton")}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* MAIN PAGE COMPONENT CONTAINER */}
          <main className="flex-grow overflow-y-auto w-full md:p-8 relative">
            <div className="w-full h-full max-w-md md:max-w-6xl mx-auto transition-all duration-300">
              {children}
            </div>
          </main>

        </div>

      </div>
    </div>
  );
};
