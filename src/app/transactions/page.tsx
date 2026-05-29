"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/Header";
import { BottomNav } from "../../components/BottomNav";
import { CATEGORIES } from "../../lib/data/MockDataProvider";
import { getCategoryIcon } from "../../lib/utils";
import { motion } from "framer-motion";
import { Search, Filter, ArrowUpRight, ArrowDownLeft, X } from "lucide-react";

export default function TransactionsPage() {
  const router = useRouter();
  const { t, isRtl } = useLanguage();
  const { user, transactions, fetchTransactions, loading } = useStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "credit" | "debit">("all");

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else {
      // Query transactions list with filters
      fetchTransactions({
        search: search || undefined,
        category: selectedCategory || undefined,
        type: selectedType === "all" ? undefined : selectedType
      });
    }
  }, [user, router, search, selectedCategory, selectedType, fetchTransactions]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-cream text-brand-navy">
        <div className="w-8 h-8 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin"></div>
      </div>
    );
  }

  // Helper to group transactions by date
  const groupTransactionsByDate = () => {
    const groups: Record<string, typeof transactions> = {};
    transactions.forEach(tx => {
      const date = tx.transaction_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const groupedTxs = groupTransactionsByDate();

  return (
    <div className="min-h-screen md:min-h-0 bg-brand-cream md:bg-transparent pb-24 md:pb-0 max-w-md md:max-w-none mx-auto md:mx-0 relative shadow-2xl md:shadow-none flex flex-col">
      <Header title={t("transactionsTitle")} />

      {/* FILTER PANEL */}
      <div className="bg-white px-5 py-4 border-b border-brand-navy/5 md:border md:border-brand-navy/5 space-y-3 z-30 shadow-sm rounded-b-3xl md:rounded-3xl md:mb-6">
        
        {/* Search */}
        <div className="relative">
          <span className={`absolute inset-y-0 ${isRtl ? "right-3" : "left-3"} flex items-center text-brand-navy/35`}>
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className={`w-full ${isRtl ? "pr-9 pl-4" : "pl-9 pr-4"} py-2.5 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-semibold focus:outline-none focus:border-brand-purple transition-all`}
          />
        </div>

        {/* Horizontal Filters row */}
        <div className="flex gap-2 items-center select-none overflow-x-auto pb-1">
          
          {/* Credit/Debit Toggle buttons */}
          <button
            onClick={() => setSelectedType(selectedType === "all" ? "credit" : selectedType === "credit" ? "debit" : "all")}
            className={`px-3 py-1.5 rounded-xl border text-[9px] font-extrabold flex items-center gap-1 transition-all ${
              selectedType !== "all" 
                ? "bg-brand-purple text-white border-brand-purple shadow-sm" 
                : "bg-brand-cream/35 text-brand-navy/60 border-brand-navy/10 hover:bg-brand-cream"
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>
              {selectedType === "all" && t("allTypes")}
              {selectedType === "credit" && t("creditsOnly")}
              {selectedType === "debit" && t("debitsOnly")}
            </span>
          </button>

          {/* Categories tag picker */}
          <div className="flex gap-1.5 items-center">
            {CATEGORIES.map(cat => {
              const catName = isRtl ? cat.name_ar : cat.name_en;
              const isSelected = selectedCategory === cat.name_en;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(isSelected ? "" : cat.name_en)}
                  className={`px-3 py-1.5 rounded-xl border text-[9px] font-extrabold whitespace-nowrap transition-all ${
                    isSelected 
                      ? "bg-brand-navy text-white border-brand-navy shadow-sm" 
                      : "bg-brand-cream/35 text-brand-navy/60 border-brand-navy/10 hover:bg-brand-cream"
                  }`}
                >
                  {catName}
                </button>
              );
            })}
          </div>

        </div>

      </div>

      {/* TRANSACTIONS SCROLL VIEWPORT */}
      <main className="px-5 pt-4 md:px-0 md:pt-0 space-y-4 flex-grow overflow-y-auto max-h-[60vh] md:max-h-[75vh] select-text">
        {groupedTxs.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-brand-navy/5 shadow-sm text-center space-y-3">
            <p className="text-xs font-bold text-brand-navy/50">
              {t("noTransactions")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTxs.map(([date, txList]) => (
              <div key={date} className="space-y-2">
                
                {/* Section Date header */}
                <h4 className="text-[10px] font-black text-brand-navy/40 uppercase tracking-widest px-1">
                  {date}
                </h4>

                {/* List items */}
                <div className="space-y-2">
                  {txList.map(tx => {
                    const Icon = getCategoryIcon(tx.category);
                    const isCredit = tx.type === "credit";
                    
                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-brand-navy/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-cream/50 flex items-center justify-center rounded-xl text-brand-navy/70">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-brand-navy truncate max-w-[170px]">
                              {tx.merchant}
                            </h4>
                            <span className="text-[8.5px] font-bold text-brand-navy/40 block mt-0.5">
                              {isRtl 
                                ? CATEGORIES.find(c => c.name_en === tx.category)?.name_ar || tx.category
                                : tx.category}
                            </span>
                          </div>
                        </div>

                        <span className={`text-xs font-black ${isCredit ? "text-brand-success" : "text-brand-navy"}`}>
                          {isCredit ? "+" : "-"} {tx.amount.toLocaleString()} {t("sar")}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="transactions" />
    </div>
  );
}
