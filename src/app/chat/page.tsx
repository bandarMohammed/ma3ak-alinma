"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore, SavedReport } from "../../store/useStore";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/Header";
import { BottomNav } from "../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, Tooltip
} from "recharts";
import { 
  Bot, Send, Sparkles, Mic, Receipt, Calendar, ArrowRight, Save, Share,
  FileText, TrendingUp, AlertCircle, Sparkle, BarChart
} from "lucide-react";
import { getCategoryIcon } from "../../lib/utils";

export default function ChatPage() {
  const router = useRouter();
  const { t, language, isRtl } = useLanguage();
  const { 
    user, messages, transactions, actionLoading, activeConversationId,
    sendChatMessage, receiveAssistantResponse, startNewConversation,
    setActiveConversation, saveReport, savedReports
  } = useStore();

  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Custom Date Picker State
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-29");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!user) {
      router.replace("/login");
    } else {
      // Auto-start a conversation if none is active
      const initChat = async () => {
        if (!activeConversationId) {
          await startNewConversation(isRtl ? "محادثة استشارية جديدة" : "New Financial Advisory Chat");
        } else {
          setActiveConversation(activeConversationId);
        }
      };
      initChat();
    }
  }, [user, router, activeConversationId, startNewConversation, setActiveConversation, isRtl]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, actionLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !user || !activeConversationId) return;

    setInput("");
    
    // 1. Send the user message (Zustand updates UI)
    await sendChatMessage(text);

    // 2. Fetch the response from the Next API chat route
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages,
            { role: "user", content: text }
          ],
          transactions,
          language
        })
      });

      const data = await response.json();
      
      // 3. Assemble ChatMessage object with structured metadata
      const aiMsg = {
        conversation_id: activeConversationId,
        role: "assistant" as const,
        content: data.type === "text" ? data.content : (isRtl ? "إليك التقرير الذي طلبته:" : "Here is the report you requested:"),
        metadata: {
          type: data.type,
          reportData: data.type === "report" ? {
            period: data.period,
            totalSpent: data.total_spent,
            totalIncome: data.total_income,
            topCategories: data.top_categories,
            largestTransactions: data.largest_transactions,
            insights: data.insights
          } : undefined,
          simulationData: data.type === "simulation" ? {
            decision: data.decision,
            scenarios: data.scenarios,
            recommendation: data.recommendation
          } : undefined
        }
      };

      // 4. Save message to store
      const provider = require("../../lib/data/config").getDataProvider();
      const savedMsg = await provider.addMessage(aiMsg);
      receiveAssistantResponse(savedMsg);

    } catch (error) {
      console.error(error);
      receiveAssistantResponse({
        id: `err-${Date.now()}`,
        conversation_id: activeConversationId,
        role: "assistant",
        content: isRtl 
          ? "معذرة، حدث خطأ أثناء الاتصال بالمساعد الذكي. يرجى المحاولة مرة أخرى."
          : "Sorry, an error occurred while connecting to Ma3ak. Please try again.",
        created_at: new Date().toISOString()
      });
    }
  };

  const handleCustomReport = () => {
    setShowDatePicker(false);
    const rangePrompt = isRtl
      ? `تقرير مخصص للفترة من ${startDate} إلى ${endDate}`
      : `Custom report from ${startDate} to ${endDate}`;
    handleSendMessage(rangePrompt);
  };

  const handleSaveReportToHistory = (reportData: any) => {
    saveReport({
      title: `${isRtl ? "تقرير" : "Report"} - ${reportData.period}`,
      start_date: startDate,
      end_date: endDate,
      total_spent: reportData.totalSpent,
      total_income: reportData.totalIncome,
      top_categories: reportData.topCategories,
      insights: reportData.insights
    });
    alert(isRtl ? "تم حفظ التقرير بنجاح في السجل!" : "Report successfully saved to history!");
  };

  // Recharts color palette
  const COLORS = ["#7C6FD4", "#D4754B", "#1B2A4A", "#2E7D4F", "#C0392B", "#9B59B6", "#1ABC9C", "#95A5A6"];

  return (
    <div className="min-h-screen md:min-h-0 bg-brand-cream md:bg-transparent pb-24 md:pb-0 max-w-md md:max-w-none mx-auto md:mx-0 relative shadow-2xl md:shadow-none flex flex-col h-screen md:h-[calc(100vh-100px)] overflow-hidden">
      <Header title={t("chatTitle")} />

      {/* MESSAGES VIEWPORT */}
      <div className="flex-grow overflow-y-auto px-5 py-4 space-y-4 select-text">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full flex flex-col items-center justify-center text-center px-4 py-8 space-y-8 select-none my-auto"
            >
              {/* Bot Glowing Avatar */}
              <div className="w-16 h-16 bg-brand-purple flex items-center justify-center rounded-3xl text-white shadow-xl shadow-brand-purple/20 ai-pulse-glow relative overflow-hidden flex-shrink-0">
                <Bot className="w-9 h-9" />
              </div>

              {/* Welcoming texts */}
              <div className="space-y-2">
                <h3 className="text-lg md:text-xl font-extrabold text-brand-navy">
                  {isRtl ? "مرحباً بك في المساعد المالي «مَعَك»" : "Welcome to Ma3ak AI Companion"}
                </h3>
                <p className="text-xs font-bold text-brand-navy/60 max-w-md leading-relaxed mx-auto">
                  {isRtl 
                    ? "أنا مستشارك المالي الشخصي المتكامل مع مصرف الإنماء. اضغط على أي من التوصيات التالية للبدء فوراً:" 
                    : "I am your personal Alinma Bank financial advisor. Click any of the recommendations below to begin:"}
                </p>
              </div>

              {/* GRID OF CAPABILITIES / RECOMMENDATIONS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
                
                {/* 1. REPORT CARD */}
                <motion.button
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage(isRtl ? "اعطني تقرير صرفي للأسبوع الماضي" : "Give me a financial report for the last week")}
                  className="bg-white rounded-2xl p-5 border border-brand-navy/5 shadow-sm text-right flex flex-col justify-between h-36 relative overflow-hidden group hover:border-brand-purple/25 transition-all focus:outline-none"
                >
                  <div className="w-9 h-9 bg-brand-purple/10 flex items-center justify-center rounded-xl text-brand-purple mb-3">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-brand-navy group-hover:text-brand-purple transition-colors mb-1">
                      {isRtl ? "إصدار تقرير مالي" : "Generate Spending Report"}
                    </h4>
                    <p className="text-[9.5px] font-bold text-brand-navy/45 leading-normal">
                      {isRtl ? "تحليل الدخل والمصروفات الإجمالية بفترات مخصصة بذكاء." : "Analyze your aggregate cashflow and spending percentages by category."}
                    </p>
                  </div>
                </motion.button>

                {/* 2. HABITS CARD */}
                <motion.button
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage(isRtl ? "كيف عادات الصرف حقتي حالياً؟" : "Am I spending too much? How are my habits?")}
                  className="bg-white rounded-2xl p-5 border border-brand-navy/5 shadow-sm text-right flex flex-col justify-between h-36 relative overflow-hidden group hover:border-brand-purple/25 transition-all focus:outline-none"
                >
                  <div className="w-9 h-9 bg-brand-orange/10 flex items-center justify-center rounded-xl text-brand-orange mb-3">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-brand-navy group-hover:text-brand-purple transition-colors mb-1">
                      {isRtl ? "مراجعة عادات الاستهلاك" : "Audit Spending Habits"}
                    </h4>
                    <p className="text-[9.5px] font-bold text-brand-navy/45 leading-normal">
                      {isRtl ? "اكتشاف مواطن الهدر المالي (تطبيقات التوصيل والاشتراكات) فوراً." : "Pinpoint high spend leaks like Hungerstation or broken saving trends."}
                    </p>
                  </div>
                </motion.button>

                {/* 3. SIMULATION CARD */}
                <motion.button
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage(isRtl ? "أفكر في شراء سيارة بـ ١٢٠,٠٠٠ ريال، شو رأيك؟" : "I want to simulate buying a car for 120,000 SAR")}
                  className="bg-white rounded-2xl p-5 border border-brand-navy/5 shadow-sm text-right flex flex-col justify-between h-36 relative overflow-hidden group hover:border-brand-purple/25 transition-all focus:outline-none"
                >
                  <div className="w-9 h-9 bg-brand-purple/10 flex items-center justify-center rounded-xl text-brand-purple mb-3">
                    <Sparkle className="w-5 h-5 text-brand-orange animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-brand-navy group-hover:text-brand-purple transition-colors mb-1">
                      {isRtl ? "محاكاة قرار مستقبلي" : "Simulate Future Decisions"}
                    </h4>
                    <p className="text-[9.5px] font-bold text-brand-navy/45 leading-normal">
                      {isRtl ? "التنبؤ بالأثر المالي لقسط سيارة أو قرض خلال ١٢ شهراً." : "Forecast the cashflow impact of buying a car or device in installments."}
                    </p>
                  </div>
                </motion.button>

              </div>
            </motion.div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === "user";
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}
                >
                  <div className={`max-w-[90%] md:max-w-[80%] flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    
                    {/* AI Avatar */}
                    {!isUser && (
                      <div className="w-8 h-8 bg-brand-purple flex-shrink-0 flex items-center justify-center rounded-xl text-white shadow-md shadow-brand-purple/20">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    {/* Bubble Container */}
                    <div className="flex flex-col gap-1.5">
                      
                      {/* Plain Text Bubble */}
                      <div className={`p-4 rounded-3xl text-xs font-semibold leading-relaxed shadow-sm ${
                        isUser 
                          ? "bg-brand-navy text-white rounded-te-none" 
                          : "bg-white text-brand-navy rounded-ts-none border border-brand-navy/5"
                      }`}>
                        <p className="whitespace-pre-line">{msg.content}</p>
                      </div>

                      {/* DYNAMIC CARD RENDERS FROM METADATA */}
                      {!isUser && msg.metadata && (
                        <div className="mt-2 space-y-2">
                          
                          {/* =========================================================
                              1. DYNAMIC REPORT CARD
                              ========================================================= */}
                          {msg.metadata.type === "report" && msg.metadata.reportData && (
                            <motion.div 
                              initial={{ scale: 0.98, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="bg-white rounded-3xl p-5 border border-brand-navy/5 shadow-md space-y-4"
                            >
                              {/* Card Banner */}
                              <div className="flex items-center gap-2 text-brand-purple">
                                <FileText className="w-5 h-5" />
                                <h4 className="text-xs font-black uppercase tracking-wider">
                                  {t("reportCardTitle")} ({msg.metadata.reportData.period})
                                </h4>
                              </div>

                              {/* Income / Spent Grid */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-brand-cream/30 p-3 rounded-2xl border border-brand-navy/5">
                                  <span className="text-[9px] font-bold text-brand-navy/40 block">
                                    {t("totalIncome")}
                                  </span>
                                  <span className="text-xs font-extrabold text-brand-success">
                                    +{msg.metadata.reportData.totalIncome.toLocaleString()} {t("sar")}
                                  </span>
                                </div>

                                <div className="bg-brand-cream/30 p-3 rounded-2xl border border-brand-navy/5">
                                  <span className="text-[9px] font-bold text-brand-navy/40 block">
                                    {t("totalSpent")}
                                  </span>
                                  <span className="text-xs font-extrabold text-brand-danger">
                                    -{msg.metadata.reportData.totalSpent.toLocaleString()} {t("sar")}
                                  </span>
                                </div>
                              </div>

                              {/* Recharts PieChart Category Breakdown */}
                              {mounted && msg.metadata.reportData.topCategories.length > 0 && (
                                <div className="h-44 w-full bg-brand-cream/10 rounded-2xl border border-brand-navy/5 p-2 flex items-center justify-center">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={msg.metadata.reportData.topCategories}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={50}
                                        paddingAngle={3}
                                        dataKey="amount"
                                        nameKey="category"
                                      >
                                        {msg.metadata.reportData.topCategories.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                      </Pie>
                                      <Tooltip contentStyle={{ fontSize: "9px", borderRadius: "10px", padding: "5px" }} />
                                      <Legend formatter={(value) => <span className="text-[9px] font-bold text-brand-navy/70">{value}</span>} layout="vertical" align="right" verticalAlign="middle" iconSize={8} iconType="circle" />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              {/* Category Percent List */}
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[9px] font-bold text-brand-navy/45 uppercase tracking-wider block">
                                  {t("topCategories")}
                                </span>
                                {msg.metadata.reportData.topCategories.slice(0, 3).map((cat, idx) => (
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

                              {/* Smart AI Insights */}
                              <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-2xl p-4 space-y-2">
                                <div className="flex items-center gap-1.5 text-brand-orange font-bold text-[10px]">
                                  <Sparkles className="w-4 h-4 animate-pulse" />
                                  <span>{t("insightsTitle")}</span>
                                </div>
                                <ul className="list-disc list-inside text-[9px] font-bold text-brand-navy/70 space-y-1">
                                  {msg.metadata.reportData.insights.map((insight, idx) => (
                                    <li key={idx}>{insight}</li>
                                  ))}
                                </ul>
                              </div>

                              {/* Actions bar */}
                              <div className="flex gap-2 pt-1 border-t border-brand-navy/5">
                                <button 
                                  onClick={() => handleSaveReportToHistory(msg.metadata?.reportData)}
                                  className="flex-1 py-2 rounded-xl border border-brand-navy/10 text-brand-navy text-[10px] font-extrabold flex items-center justify-center gap-1.5 hover:bg-brand-cream/20 transition-all"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  {t("save")}
                                </button>
                                <button className="flex-1 py-2 rounded-xl border border-brand-navy/10 text-brand-navy text-[10px] font-extrabold flex items-center justify-center gap-1.5 hover:bg-brand-cream/20 transition-all">
                                  <Share className="w-3.5 h-3.5" />
                                  {t("share")}
                                </button>
                              </div>
                            </motion.div>
                          )}

                          {/* =========================================================
                              2. DYNAMIC DECISION SIMULATION CARD
                              ========================================================= */}
                          {msg.metadata.type === "simulation" && msg.metadata.simulationData && (
                            <motion.div 
                              initial={{ scale: 0.98, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="bg-white rounded-3xl p-5 border border-brand-navy/5 shadow-md space-y-4"
                            >
                              {/* Card Banner */}
                              <div className="flex items-center gap-2 text-brand-purple">
                                <TrendingUp className="w-5 h-5 animate-pulse" />
                                <h4 className="text-xs font-black uppercase tracking-wider">
                                  {t("simulationCardTitle")}
                                </h4>
                              </div>

                              <p className="text-[10px] font-bold text-brand-navy/60 bg-brand-cream/35 px-3 py-2 rounded-xl border border-brand-navy/5">
                                <strong>{t("proposedDecision")}:</strong> {msg.metadata.simulationData.decision}
                              </p>

                              {/* 3 columns simulation values */}
                              <div className="grid grid-cols-3 gap-2">
                                {msg.metadata.simulationData.scenarios.map((sc, idx) => (
                                  <div 
                                    key={sc.name} 
                                    className={`p-2.5 rounded-2xl border text-center flex flex-col justify-between ${
                                      idx === 1 
                                        ? "bg-brand-purple/5 border-brand-purple/35 glow-purple" 
                                        : "bg-brand-cream/15 border-brand-navy/5"
                                    }`}
                                  >
                                    <span className={`text-[8px] font-black block leading-tight ${idx === 1 ? "text-brand-purple" : "text-brand-navy/50"}`}>
                                      {sc.name}
                                    </span>
                                    
                                    <div className="my-2">
                                      <span className="text-[7px] font-bold text-brand-navy/40 uppercase block leading-none">
                                        {t("monthlyImpact").substring(0, 10)}
                                      </span>
                                      <span className={`text-[10px] font-extrabold block leading-tight ${sc.monthly_impact < 0 ? "text-brand-danger" : "text-brand-success"}`}>
                                        {sc.monthly_impact.toLocaleString()} {t("sar")}
                                      </span>
                                    </div>

                                    <div>
                                      <span className="text-[7px] font-bold text-brand-navy/40 uppercase block leading-none">
                                        {t("balance12m").substring(0, 10)}
                                      </span>
                                      <span className="text-[10px] font-black text-brand-navy block leading-tight">
                                        {sc.balance_in_12m.toLocaleString()} {t("sar")}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Recharts LineChart 12-Month Projection curves */}
                              {mounted && (
                                <div className="h-44 w-full bg-brand-cream/10 rounded-2xl border border-brand-navy/5 p-2">
                                  <span className="text-[8px] font-black text-brand-navy/40 uppercase block tracking-wider mb-2 text-center">
                                    {t("viewSimulationChart")}
                                  </span>
                                  <ResponsiveContainer width="100%" height="90%">
                                    <LineChart 
                                      data={Array.from({ length: 12 }, (_, i) => {
                                        const startBal = transactions[0]?.amount || 12450.75;
                                        const baseSav = 3000;
                                        
                                        // Get amount from decision to compute impact
                                        const isIphone = msg.metadata?.simulationData?.decision.toLowerCase().includes("iphone") || msg.metadata?.simulationData?.decision.toLowerCase().includes("آيفون");
                                        const cost = isIphone ? 450 : 2000;
                                        const fullPrice = isIphone ? 5000 : 120000;

                                        // Scenario A: Do now
                                        const balA = startBal + (i * baseSav) - (i * cost) - (fullPrice * 0.1);
                                        // Scenario B: Wait 6 months
                                        const balB = i < 6 
                                          ? startBal + (i * baseSav)
                                          : startBal + (i * baseSav) - ((i - 6) * cost);
                                        // Scenario C: Adjusted
                                        const balC = startBal - (fullPrice * 0.25) + (i * baseSav) - (i * (cost * 0.6));

                                        return {
                                          month: isRtl ? `ش ${i+1}` : `M${i+1}`,
                                          [isRtl ? "الآن" : "A: Now"]: Math.round(balA),
                                          [isRtl ? "الانتظار" : "B: Wait"]: Math.round(balB),
                                          [isRtl ? "المعدل" : "C: Adjusted"]: Math.round(balC)
                                        };
                                      })}
                                      margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                                    >
                                      <XAxis dataKey="month" stroke="#1B2A4A80" fontSize={8} fontWeight="bold" />
                                      <YAxis stroke="#1B2A4A80" fontSize={8} fontWeight="bold" />
                                      <Tooltip contentStyle={{ fontSize: "8px", borderRadius: "10px" }} />
                                      <Line type="monotone" dataKey={isRtl ? "الآن" : "A: Now"} stroke="#C0392B" strokeWidth={1.8} dot={false} />
                                      <Line type="monotone" dataKey={isRtl ? "الانتظار" : "B: Wait"} stroke="#7C6FD4" strokeWidth={2.2} dot={false} />
                                      <Line type="monotone" dataKey={isRtl ? "المعدل" : "C: Adjusted"} stroke="#D4754B" strokeWidth={1.8} dot={false} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              {/* Detailed Scenarios Verdict list */}
                              <div className="space-y-1.5 pt-1">
                                {msg.metadata.simulationData.scenarios.map((sc, idx) => (
                                  <div key={sc.name} className="text-[9px] font-bold text-brand-navy/80 flex items-start gap-1 bg-brand-cream/20 p-2 rounded-xl border border-brand-navy/5">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${idx === 0 ? "bg-brand-danger" : idx === 1 ? "bg-brand-purple animate-ping" : "bg-brand-orange"}`}></span>
                                    <p>
                                      <strong>{sc.name}:</strong> {sc.verdict}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              {/* Final Smart Recommendation */}
                              <div className="bg-brand-purple/5 border border-brand-purple/20 rounded-2xl p-4 space-y-2 glow-purple">
                                <div className="flex items-center gap-1.5 text-brand-purple font-bold text-[10px]">
                                  <Sparkles className="w-4 h-4 animate-pulse" />
                                  <span>{t("recommendationTitle")}</span>
                                </div>
                                <p className="text-[9.5px] font-bold text-brand-navy/85 whitespace-pre-line leading-relaxed">
                                  {msg.metadata.simulationData.recommendation}
                                </p>
                              </div>
                            </motion.div>
                          )}

                        </div>
                      )}

                    </div>

                  </div>
                </motion.div>
              );
            })
          )}

          {/* AI TYPING THINKING INDICATOR */}
          {actionLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start w-full"
            >
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-brand-purple flex items-center justify-center rounded-xl text-white shadow-md shadow-brand-purple/20">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="bg-white p-4 rounded-3xl rounded-ts-none border border-brand-navy/5 shadow-sm text-xs font-bold text-brand-navy/60 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-brand-purple rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-brand-purple rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-brand-purple rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  <span>{t("typingIndicator")}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* FLOATING ACTION SUGGESTED PROMPT CHIPS */}
      <div className="px-5 py-2 flex gap-2 overflow-x-auto bg-brand-cream/70 md:bg-transparent backdrop-blur-md flex-shrink-0 select-none md:justify-center md:pb-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSendMessage(isRtl ? "اعطني تقرير صرفي للأسبوع الماضي" : "Give me a financial report for the last week")}
          className="px-3.5 py-2 bg-white text-brand-navy/70 border border-brand-navy/5 rounded-full text-[10px] font-extrabold shadow-sm hover:border-brand-purple/20 hover:text-brand-purple flex-shrink-0 flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t("chipReport")}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSendMessage(isRtl ? "كيف عادات الصرف حقتي حالياً؟" : "Am I spending too much? How are my habits?")}
          className="px-3.5 py-2 bg-white text-brand-navy/70 border border-brand-navy/5 rounded-full text-[10px] font-extrabold shadow-sm hover:border-brand-purple/20 hover:text-brand-purple flex-shrink-0 flex items-center gap-1.5"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{t("chipHabits")}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSendMessage(isRtl ? "أفكر في شراء سيارة بـ ١٢٠,٠٠٠ ريال، شو رأيك؟" : "I want to simulate buying a car for 120,000 SAR in installments")}
          className="px-3.5 py-2 bg-white text-brand-navy/70 border border-brand-navy/5 rounded-full text-[10px] font-extrabold shadow-sm hover:border-brand-purple/20 hover:text-brand-purple flex-shrink-0 flex items-center gap-1.5"
        >
          <Sparkle className="w-3.5 h-3.5 text-brand-orange" />
          <span>{t("chipSimulate")}</span>
        </motion.button>
      </div>

      {/* DATE RANGE PICKER MODAL TRIGGER CARD */}
      <AnimatePresence>
        {showDatePicker && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-20 left-4 right-4 md:max-w-md md:left-auto md:right-4 bg-white border border-brand-navy/10 shadow-2xl rounded-3xl p-5 z-40 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-brand-navy flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-brand-purple" />
                <span>{t("customReportRange")}</span>
              </h4>
              <button onClick={() => setShowDatePicker(false)} className="text-[10px] font-extrabold text-brand-navy/40 hover:text-brand-navy">
                {t("cancel")}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-brand-navy/55">{t("startDate")}</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-brand-cream/50 border border-brand-navy/10 text-xs font-bold text-brand-navy"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-brand-navy/55">{t("endDate")}</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-brand-cream/50 border border-brand-navy/10 text-xs font-bold text-brand-navy"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCustomReport}
              className="w-full py-2.5 bg-brand-purple text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 shadow-md hover:bg-brand-purple/95"
            >
              <span>{t("generateReport")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INPUT PANEL */}
      <div className="px-5 py-3.5 bg-white border-t border-brand-navy/5 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          
          {/* Custom Datepicker trigger */}
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`p-2 rounded-xl transition-all focus:outline-none ${
              showDatePicker 
                ? "bg-brand-purple text-white" 
                : "bg-brand-cream/50 text-brand-navy/60 hover:bg-brand-cream"
            }`}
            title={t("customReportRange")}
          >
            <Calendar className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <div className="flex-grow relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage(input)}
              placeholder={t("chatInputPlaceholder")}
              className={`w-full py-3 ${
                isRtl ? "pl-10 pr-4" : "pr-10 pl-4"
              } rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-semibold focus:outline-none focus:border-brand-purple transition-all`}
            />
            {/* Voice Mic Icon (UI placeholder only) */}
            <button 
              className={`absolute inset-y-0 ${
                isRtl ? "left-3" : "right-3"
              } flex items-center text-brand-navy/35 hover:text-brand-purple`}
              title={t("voiceInputTooltip")}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* Send Action */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSendMessage(input)}
            className="w-10 h-10 bg-brand-navy flex items-center justify-center rounded-2xl text-white shadow-md hover:bg-brand-navy/95 transition-all"
          >
            <Send className="w-4 h-4" />
          </motion.button>

        </div>
      </div>

      <BottomNav activeTab="chat" />
    </div>
  );
}
