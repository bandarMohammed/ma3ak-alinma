"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/Header";
import { BottomNav } from "../../components/BottomNav";
import { motion } from "framer-motion";
import { 
  User, Mail, ShieldAlert, Globe, RotateCcw, LogOut, CheckCircle2 
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { t, language, setLanguage, isRtl } = useLanguage();
  const { user, accounts, resetData, logout, loading } = useStore();

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-cream text-brand-navy">
        <div className="w-8 h-8 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin"></div>
      </div>
    );
  }

  const account = accounts[0];

  const handleResetData = async () => {
    const confirmReset = window.confirm(
      isRtl 
        ? "هل أنت متأكد من إعادة تعيين جميع البيانات وحذف المحادثات؟" 
        : "Are you sure you want to reset all data and clear chat logs?"
    );
    if (confirmReset) {
      await resetData();
      alert(isRtl ? "تمت إعادة تهيئة البيانات بنجاح!" : "Database successfully re-seeded!");
      router.replace("/dashboard");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen md:min-h-0 bg-brand-cream md:bg-transparent pb-24 md:pb-0 max-w-md md:max-w-none mx-auto md:mx-0 relative shadow-2xl md:shadow-none flex flex-col">
      <Header title={t("profileTitle")} />

      <main className="px-5 pt-4 md:px-0 md:pt-0 space-y-5 flex-grow animate-slide-up select-none">
        
        {/* Responsive Grid on PC */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: Profile info & Hackathon details */}
          <div className="space-y-5">
            {/* PROFILE IDENT CARD */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-brand-navy/5 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-brand-navy flex items-center justify-center rounded-2xl text-white shadow-md relative overflow-hidden">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-brand-navy">{user.full_name}</h3>
                <span className="text-[9px] font-bold text-brand-navy/40 uppercase tracking-widest">{user.email}</span>
              </div>

              <div className="w-full border-t border-brand-navy/5 pt-3 mt-1 flex justify-between items-center text-[10px] font-bold text-brand-navy/50">
                <span>{isRtl ? "رقم الحساب:" : "Acc Num:"}</span>
                <span className="text-brand-navy font-extrabold">{account?.account_number || "N/A"}</span>
              </div>
            </div>

            {/* Hackathon Specs Footer */}
            <div className="bg-brand-navy text-white rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-purple/20 rounded-full blur-xl"></div>
              <div className="flex items-center gap-2 text-brand-orange">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-[9.5px] font-black uppercase tracking-wider">
                  {isRtl ? "معلومات النسخة التجريبية" : "Demo Prototype Specs"}
                </span>
              </div>
              <p className="text-[9px] font-bold text-white/70 leading-relaxed">
                {isRtl 
                  ? "تعمل هذه النسخة التجريبية بالكامل محلياً وبدون إنترنت لضمان سرعة وموثوقية العرض أثناء التقييم في هاكاثون أَمَدْ." 
                  : "This prototype runs fully locally offline, ensuring absolute stability and speed for judging panels at the Amad Hackathon."}
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Settings Options & Sign out */}
          <div className="space-y-5">
            {/* SETTINGS OPTION ROWS */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-brand-navy/40 uppercase tracking-widest px-1">
                {t("accountInfo")}
              </h4>
              
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-brand-navy/5 space-y-4">
                
                {/* Preferred Language toggle row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-purple/10 flex items-center justify-center rounded-xl text-brand-purple">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-brand-navy block leading-none">
                        {t("preferredLang")}
                      </span>
                      <span className="text-[9px] font-bold text-brand-navy/40">
                        {language === "ar" ? "العربية (RTL)" : "English (LTR)"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 p-1 rounded-xl bg-brand-cream/50 border border-brand-navy/5">
                    <button
                      onClick={() => setLanguage("ar")}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${
                        language === "ar" 
                          ? "bg-brand-navy text-white shadow-sm" 
                          : "text-brand-navy/50 hover:text-brand-navy"
                      }`}
                    >
                      عربي
                    </button>
                    <button
                      onClick={() => setLanguage("en")}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${
                        language === "en" 
                          ? "bg-brand-navy text-white shadow-sm" 
                          : "text-brand-navy/50 hover:text-brand-navy"
                      }`}
                    >
                      EN
                    </button>
                  </div>
                </div>

                {/* Seeding Reset Command Row */}
                <div className="flex justify-between items-center pt-1 border-t border-brand-navy/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-orange/10 flex items-center justify-center rounded-xl text-brand-orange">
                      <RotateCcw className="w-4 h-4 animate-spin-slow" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-brand-navy block leading-none">
                        {isRtl ? "إعادة تعيين البيانات" : "Re-Seed Database"}
                      </span>
                      <span className="text-[9px] font-bold text-brand-navy/40">
                        {isRtl ? "استعادة الوضع الافتراضي لبيانات العمليات" : "Restore default 6-month transactions"}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleResetData}
                    className="px-3.5 py-2 rounded-xl bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange text-[9px] font-black transition-all focus:outline-none"
                  >
                    {isRtl ? "تهيئة" : "Reset"}
                  </motion.button>
                </div>

              </div>
            </div>

            {/* LOGOUT ACTION BUTTON */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleLogout}
              className="w-full py-4 rounded-3xl bg-white border border-brand-danger/20 hover:bg-brand-danger/5 text-brand-danger text-xs font-black shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>{t("logoutButton")}</span>
            </motion.button>
          </div>

        </div>

      </main>

      <BottomNav activeTab="settings" />
    </div>
  );
}
