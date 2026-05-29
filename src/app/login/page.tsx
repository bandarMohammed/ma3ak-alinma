"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../context/LanguageContext";
import { motion } from "framer-motion";
import { Globe, Lock, Mail, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login, user, loading, error } = useStore();
  const { t, toggleLanguage, language, isRtl } = useLanguage();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError(isRtl ? "الرجاء تعبئة جميع الحقول" : "Please fill in all fields");
      return;
    }

    const success = await login(email, password);
    if (success) {
      router.push("/dashboard");
    }
  };

  const handleDemoLogin = async () => {
    setEmail("demo@alinma.sa");
    setPassword("Demo1234");
    
    // Tiny delay to show auto-fill before logging in
    setTimeout(async () => {
      const success = await login("demo@alinma.sa", "Demo1234");
      if (success) {
        router.push("/dashboard");
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col justify-between relative overflow-hidden p-6">
      
      {/* Decorative Elegant Shapes */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-purple/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl"></div>
      
      {/* TOP HEADER BAR (Language Switcher) */}
      <header className="w-full max-w-md mx-auto flex justify-end z-10">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 backdrop-blur-md border border-brand-navy/10 text-brand-navy hover:bg-white transition-all text-xs font-semibold shadow-sm"
        >
          <Globe className="w-4 h-4 text-brand-purple" />
          <span>{language === "ar" ? "English" : "عربي"}</span>
        </motion.button>
      </header>

      {/* LOGIN CARD */}
      <main className="w-full max-w-md mx-auto my-auto z-10 flex flex-col items-center">
        
        {/* LOGO & TITLE */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-8 text-center"
        >
          <div className="w-20 h-20 bg-brand-navy flex items-center justify-center rounded-3xl shadow-lg relative overflow-hidden mb-4 ai-pulse-glow">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-extrabold text-brand-navy tracking-wide">
            {t("appName")}
          </h2>
          <p className="text-sm font-medium text-brand-navy/60 mt-1 max-w-xs px-2">
            {t("tagline")}
          </p>
        </motion.div>

        {/* CARD FORM */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full bg-white rounded-3xl shadow-xl border border-brand-navy/5 p-8 relative"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-navy via-brand-purple to-brand-orange rounded-t-3xl"></div>
          
          <h3 className="text-xl font-bold text-brand-navy mb-1">
            {t("loginWelcome")}
          </h3>
          <p className="text-xs font-normal text-brand-navy/50 mb-6">
            {t("loginSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* EMAIL FIELD */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-navy/70 block">
                {t("emailLabel")}
              </label>
              <div className="relative">
                <span className={`absolute inset-y-0 ${isRtl ? "right-3" : "left-3"} flex items-center text-brand-navy/35`}>
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className={`w-full ${isRtl ? "pr-10 pl-4" : "pl-10 pr-4"} py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-sm font-medium focus:outline-none focus:border-brand-purple transition-all`}
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-navy/70 block">
                {t("passwordLabel")}
              </label>
              <div className="relative">
                <span className={`absolute inset-y-0 ${isRtl ? "right-3" : "left-3"} flex items-center text-brand-navy/35`}>
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className={`w-full ${isRtl ? "pr-10 pl-10" : "pl-10 pr-10"} py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-sm font-medium focus:outline-none focus:border-brand-purple transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 ${isRtl ? "left-3" : "right-3"} flex items-center text-brand-navy/35 hover:text-brand-purple`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ERROR DISPLAY */}
            {(error || localError) && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-brand-danger/10 text-brand-danger text-xs font-semibold border border-brand-danger/20"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{localError || t("invalidCredentials")}</span>
              </motion.div>
            )}

            {/* SUBMIT BUTTONS */}
            <div className="space-y-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-brand-navy text-white text-sm font-bold shadow-md hover:bg-brand-navy/95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  t("loginButton")
                )}
              </motion.button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-brand-navy/10"></div>
                <span className="flex-shrink mx-4 text-brand-navy/40 text-[10px] font-bold uppercase tracking-wider">
                  {isRtl ? "أو الدخول السريع" : "Or Quick Entry"}
                </span>
                <div className="flex-grow border-t border-brand-navy/10"></div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-lightNavy text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>{t("loginAsDemo")}</span>
              </motion.button>
            </div>

          </form>
        </motion.div>
        
        {/* Tuwaiq & Alinma Footer */}
        <p className="text-[10px] font-semibold text-brand-navy/45 mt-8 text-center max-w-xs">
          {isRtl 
            ? "مشروع هاكاثون أَمَدْ - أكاديمية طويق برعاية مصرف الإنماء" 
            : "Amad Hackathon Project - Tuwaiq Academy sponsored by Alinma Bank"}
        </p>
      </main>

      {/* FOOTER */}
      <footer className="w-full text-center py-2 text-[10px] font-medium text-brand-navy/30 z-10">
        © 2026 Alinma Bank. All rights reserved.
      </footer>
    </div>
  );
}
