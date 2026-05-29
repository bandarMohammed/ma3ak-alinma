"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore, SavedReport } from "../../store/useStore";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/Header";
import { BottomNav } from "../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { 
  FileText, Calendar, Sparkles, X, ChevronRight, 
  TrendingUp, AlertCircle, Share2, Award, Briefcase, Receipt
} from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  const { t, language, isRtl } = useLanguage();
  const { user, savedReports, fetchSavedReports, loading } = useStore();

  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) {
      router.replace("/login");
    } else {
      fetchSavedReports();
    }
  }, [user, router, fetchSavedReports]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-cream text-brand-navy">
        <div className="w-8 h-8 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin"></div>
      </div>
    );
  }

  const COLORS = ["#7C6FD4", "#D4754B", "#1B2A4A", "#2E7D4F", "#C0392B", "#9B59B6", "#1ABC9C", "#95A5A6"];

  return (
    <div className="min-h-screen md:min-h-0 bg-brand-cream md:bg-transparent pb-24 md:pb-0 max-w-md md:max-w-none mx-auto md:mx-0 relative shadow-2xl md:shadow-none flex flex-col">
      <Header title={t("reportsHistoryTitle")} />

      <main className="px-5 pt-4 md:px-0 md:pt-0 space-y-4 flex-grow animate-slide-up">
        
        <p className="text-[10px] font-bold text-brand-navy/50 px-1 uppercase tracking-wider">
          {isRtl ? "سجلات التحليل المالي المحفوظة" : "Archived AI Financial Audits"}
        </p>

        {savedReports.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-brand-navy/5 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 bg-brand-purple/10 flex items-center justify-center rounded-2xl text-brand-purple mx-auto">
              <FileText className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-xs font-bold text-brand-navy/60 leading-relaxed max-w-xs mx-auto">
              {t("noReportsYet")}
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/chat")}
              className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-[10px] font-black shadow-md hover:bg-brand-navy/95 transition-all"
            >
              {isRtl ? "اطلب تقريراً الآن" : "Generate One Now"}
            </motion.button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReports.map((report) => (
              <motion.div
                key={report.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedReport(report)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-brand-navy/5 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-purple/10 flex items-center justify-center rounded-xl text-brand-purple">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-brand-navy truncate max-w-[170px]">
                      {report.title}
                    </h4>
                    <span className="text-[9px] font-bold text-brand-navy/40 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-brand-purple" />
                      {t("period")}: {report.title.split("-")[1] || t("appName")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[7px] font-bold text-brand-navy/40 uppercase block leading-none">
                      {t("totalSpent")}
                    </span>
                    <span className="text-[11px] font-black text-brand-danger">
                      -{report.total_spent.toLocaleString()} {t("sar")}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-brand-navy/30 ${isRtl ? "rotate-180" : ""}`} />
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </main>

      {/* DETAIL MODAL POPUP */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-md max-h-[85vh] md:max-h-[90vh] overflow-y-auto p-6 relative border border-brand-navy/5 shadow-2xl space-y-4"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-brand-purple">
                  <Award className="w-5 h-5 text-brand-orange animate-bounce-slow" />
                  <h3 className="text-base font-black text-brand-navy">
                    {selectedReport.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-1.5 rounded-full bg-brand-cream/50 text-brand-navy/60 hover:bg-brand-cream hover:text-brand-navy transition-colors focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Saved Date */}
              <span className="text-[9px] font-bold text-brand-navy/40 block bg-brand-cream/20 px-3 py-1.5 rounded-xl border border-brand-navy/5">
                {t("savedOn")}: {new Date(selectedReport.saved_at).toLocaleString()}
              </span>

              {/* Total Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-brand-cream/35 p-3.5 rounded-2xl border border-brand-navy/5">
                  <span className="text-[9px] font-bold text-brand-navy/40 block">
                    {t("totalIncome")}
                  </span>
                  <span className="text-xs font-extrabold text-brand-success">
                    +{selectedReport.total_income.toLocaleString()} {t("sar")}
                  </span>
                </div>

                <div className="bg-brand-cream/35 p-3.5 rounded-2xl border border-brand-navy/5">
                  <span className="text-[9px] font-bold text-brand-navy/40 block">
                    {t("totalSpent")}
                  </span>
                  <span className="text-xs font-extrabold text-brand-danger">
                    -{selectedReport.total_spent.toLocaleString()} {t("sar")}
                  </span>
                </div>
              </div>

              {/* Recharts PieChart Category Breakdown */}
              {mounted && selectedReport.top_categories.length > 0 && (
                <div className="h-44 w-full bg-brand-cream/10 rounded-2xl border border-brand-navy/5 p-2 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={selectedReport.top_categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={3}
                        dataKey="amount"
                        nameKey="category"
                      >
                        {selectedReport.top_categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: "9px", borderRadius: "10px", padding: "5px" }} />
                      <Legend formatter={(value) => <span className="text-[9px] font-bold text-brand-navy/70">{value}</span>} layout="vertical" align="right" verticalAlign="middle" iconSize={8} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Category Breakdown list */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[9px] font-bold text-brand-navy/45 uppercase tracking-wider block">
                  {t("topCategories")}
                </span>
                {selectedReport.top_categories.map((cat, idx) => (
                  <div key={cat.category} className="flex justify-between items-center text-[10px] font-bold text-brand-navy/80">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      {cat.category}
                    </span>
                    <span>
                      {cat.amount.toLocaleString()} {t("sar")} ({cat.percentage}%)
                    </span>
                  </div>
                ))}
              </div>

              {/* Dynamic Saved Insights */}
              <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-brand-orange font-bold text-[10px]">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>{t("insightsTitle")}</span>
                </div>
                <ul className="list-disc list-inside text-[9px] font-bold text-brand-navy/70 space-y-1">
                  {selectedReport.insights.map((insight, idx) => (
                    <li key={idx}>{insight}</li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <button 
                onClick={() => {
                  alert(isRtl ? "تمت المشاركة بنجاح!" : "Shared successfully!");
                }}
                className="w-full py-3 rounded-2xl bg-brand-navy text-white text-xs font-black shadow-md hover:bg-brand-navy/95 transition-all flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>{isRtl ? "تصدير ومشاركة التقرير" : "Export & Share Audit"}</span>
              </button>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab="reports" />
    </div>
  );
}
