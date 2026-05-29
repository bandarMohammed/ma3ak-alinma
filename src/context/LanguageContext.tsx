"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ar } from "../locales/ar";
import { en, TranslationKeys } from "../locales/en";

type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  t: (key: TranslationKeys) => string;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("ar");

  // Load language from localStorage if available
  useEffect(() => {
    const savedLang = localStorage.getItem("preferred_language") as Language;
    if (savedLang === "ar" || savedLang === "en") {
      setLanguageState(savedLang);
      updateDocumentDirection(savedLang);
    } else {
      updateDocumentDirection("ar");
    }
  }, []);

  const updateDocumentDirection = (lang: Language) => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    
    // Set appropriate font variables on the body
    if (lang === "ar") {
      document.body.style.fontFamily = 'var(--font-arabic), "Tajawal", "Segoe UI", "Tahoma", sans-serif';
    } else {
      document.body.style.fontFamily = 'var(--font-english), "Inter", "Segoe UI", sans-serif';
    }
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("preferred_language", lang);
    updateDocumentDirection(lang);
  };

  const toggleLanguage = () => {
    const nextLang = language === "ar" ? "en" : "ar";
    setLanguage(nextLang);
  };

  const t = (key: TranslationKeys): string => {
    const dictionary = language === "ar" ? ar : en;
    return dictionary[key] || en[key] || String(key);
  };

  const isRtl = language === "ar";

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage, toggleLanguage, isRtl }}>
      <div dir={isRtl ? "rtl" : "ltr"} className={isRtl ? "font-arabic" : "font-english"}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
