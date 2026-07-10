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
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { 
  Bot, Send, Sparkles, Mic, Receipt, Calendar, ArrowRight, Save, Share,
  FileText, TrendingUp, AlertCircle, Sparkle, BarChart, Gauge, Activity,
  CheckCircle2, AlertTriangle, Coins
} from "lucide-react";
import { getCategoryIcon } from "../../lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function ChatPage() {
  const router = useRouter();
  const { t, language, isRtl } = useLanguage();
  const {
    user, messages, transactions, accounts, actionLoading, activeConversationId,
    sendChatMessage, receiveAssistantResponse, startNewConversation,
    setActiveConversation, saveReport, savedReports
  } = useStore();

  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Custom Date Picker State
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-29");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
          language,
          balance: accounts?.[0]?.balance // real account balance → code uses it as savings
        })
      });

      const data = await response.json();
      
      // 3. Assemble ChatMessage object with structured metadata
      const aiMsg = {
        conversation_id: activeConversationId,
        role: "assistant" as const,
        content: data.type === "text"
          ? data.content
          : data.type === "simulation"
            ? (isRtl ? "إليك تحليل المحاكاة المالية لقرارك:" : "Here is the financial simulation for your decision:")
            : (isRtl ? "إليك التقرير الذي طلبته:" : "Here is the report you requested:"),
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
          simulationData: data.type === "simulation" ? data : undefined,
          // Round-trips the in-progress conversational simulation state so the
          // stateless API can resume slot-filling on the next user message.
          pendingSim: data.pendingSim ?? undefined
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
    setToastMessage(isRtl ? "تم حفظ التقرير بنجاح ✓" : "Report successfully saved ✓");
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSharePDF = async (msgId: string, reportData: any) => {
    if (!reportData) return;
    try {
      const chartEl = document.getElementById(`chart-container-${msgId}`);
      let chartImgData = "";
      if (chartEl) {
        const chartCanvas = await html2canvas(chartEl, {
          scale: 2,
          useCORS: true
        });
        chartImgData = chartCanvas.toDataURL("image/png");
      }

      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "-9999px";
      tempDiv.style.width = "595px";
      tempDiv.style.backgroundColor = "#FFFFFF";
      tempDiv.style.color = "#1B2A4A";
      tempDiv.style.fontFamily = "sans-serif";
      tempDiv.style.padding = "40px";
      tempDiv.style.boxSizing = "border-box";
      
      const isRtl = language === "ar";
      tempDiv.style.direction = isRtl ? "rtl" : "ltr";

      const headerTitle = isRtl ? "معك | مصرف الإنماء" : "Ma3ak | Alinma Bank";
      const reportTitle = isRtl ? "تقرير الأداء المالي" : "Financial Performance Report";
      const periodLabel = isRtl ? "الفترة" : "Period";
      const incomeLabel = isRtl ? "إجمالي الدخل" : "Total Income";
      const spentLabel = isRtl ? "إجمالي المصروفات" : "Total Expenses";
      const chartTitle = isRtl ? "توزيع المصروفات حسب الفئات" : "Expense Distribution by Category";
      const insightsTitleText = isRtl ? "التوصيات والتحليلات الذكية" : "Smart Recommendations & Insights";
      const footerText = isRtl ? "Generated by Ma3ak — مصرف الإنماء" : "Generated by Ma3ak — Alinma Bank";
      const sarText = isRtl ? "ريال" : "SAR";

      const clientName = user?.full_name || (isRtl ? "أحمد العنزي" : "Ahmed Al-Enazi");

      tempDiv.innerHTML = `
        <div style="border: 2px solid #1B2A4A; padding: 30px; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05); font-family: 'Inter', 'Roboto', sans-serif;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7C6FD4; padding-bottom: 15px; margin-bottom: 20px;">
            <span style="font-size: 22px; font-weight: 900; color: #1B2A4A;">${headerTitle}</span>
            <span style="font-size: 14px; font-weight: bold; color: #7C6FD4;">${reportTitle}</span>
          </div>

          <!-- Client Name & Period -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background-color: #FDF9F3; padding: 10px 15px; border-radius: 10px; border: 1px solid rgba(212,117,75,0.2); font-size: 12px; font-weight: bold;">
            <span style="color: #1B2A4A;">
              ${isRtl ? "العميل" : "Client"}: <span style="color: #7C6FD4;">${clientName}</span>
            </span>
            <span style="color: #D4754B;">
              ${periodLabel}: ${reportData.period}
            </span>
          </div>

          <!-- Income & Expense Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div style="background-color: #EBF7EE; border: 1px solid #D1F0D9; padding: 15px; border-radius: 15px; text-align: center;">
              <span style="font-size: 11px; font-weight: bold; color: #2E7D4F; display: block; margin-bottom: 5px;">${incomeLabel}</span>
              <span style="font-size: 16px; font-weight: 900; color: #2E7D4F;">+${reportData.totalIncome.toLocaleString()} ${sarText}</span>
            </div>
            <div style="background-color: #FCECEB; border: 1px solid #F9D6D4; padding: 15px; border-radius: 15px; text-align: center;">
              <span style="font-size: 11px; font-weight: bold; color: #C0392B; display: block; margin-bottom: 5px;">${spentLabel}</span>
              <span style="font-size: 16px; font-weight: 900; color: #C0392B;">-${reportData.totalSpent.toLocaleString()} ${sarText}</span>
            </div>
          </div>

          <!-- Chart -->
          ${chartImgData ? `
          <div style="text-align: center; margin-bottom: 25px;">
            <span style="font-size: 12px; font-weight: bold; color: #1B2A4A; display: block; text-align: ${isRtl ? "right" : "left"}; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">${chartTitle}</span>
            <img src="${chartImgData}" style="width: 100%; max-width: 350px; height: auto; margin: 0 auto; display: block;" />
          </div>
          ` : ""}

          <!-- Insights -->
          <div style="background-color: #FDF7F5; border: 1px solid #FADED3; padding: 20px; border-radius: 15px; margin-bottom: 25px;">
            <div style="font-size: 13px; font-weight: 900; color: #D4754B; margin-bottom: 10px; display: flex; align-items: center; gap: 5px;">
              <span>✨ ${insightsTitleText}</span>
            </div>
            <ul style="margin: 0; padding-${isRtl ? "right" : "left"}: 20px; font-size: 11px; font-weight: bold; color: #1B2A4A; line-height: 1.8;">
              ${reportData.insights.filter((ins: string) => !ins.includes("قرار تمويلي رسمي") && !ins.includes("financing decision")).map((insight: string) => `<li style="margin-bottom: 8px;">${insight}</li>`).join("")}
            </ul>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #eee; padding-top: 15px; text-align: center; font-size: 10px; font-weight: bold; color: #999;">
            ${footerText}
          </div>
        </div>
      `;
      document.body.appendChild(tempDiv);

      const pdfCanvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true
      });
      document.body.removeChild(tempDiv);

      const imgData = pdfCanvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (pdfCanvas.height * imgWidth) / pdfCanvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`Ma3ak_Report_${reportData.period.replace(/\s+/g, "_")}.pdf`);
      
      setToastMessage(isRtl ? "تم تحميل التقرير كـ PDF ✓" : "PDF downloaded successfully ✓");
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(isRtl ? "عذراً، فشل تصدير التقرير كـ PDF" : "Sorry, PDF export failed");
    }
  };

  // Recharts color palette
  const COLORS = ["#7C6FD4", "#D4754B", "#1B2A4A", "#2E7D4F", "#C0392B", "#9B59B6", "#1ABC9C", "#95A5A6"];

  return (
    <div className="min-h-screen md:min-h-0 bg-brand-cream md:bg-transparent pb-24 md:pb-0 max-w-md md:max-w-none mx-auto md:mx-0 relative shadow-2xl md:shadow-none flex flex-col h-screen md:h-[calc(100vh-100px)] overflow-hidden">
      
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: "-50%" }}
            animate={{ opacity: 1, y: 20, x: "-50%" }}
            exit={{ opacity: 0, y: -50, x: "-50%" }}
            className="fixed top-0 left-1/2 transform -translate-x-1/2 z-50 bg-[#2E7D4F] text-white px-6 py-3 rounded-full text-xs font-black shadow-lg flex items-center gap-2"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
                                <div id={`chart-container-${msg.id}`} className="h-44 w-full bg-brand-cream/10 rounded-2xl border border-brand-navy/5 p-2 flex items-center justify-center">
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
                                      <Legend formatter={(value) => <span className="text-[12px] font-black text-brand-navy/80">{value}</span>} layout="vertical" align="right" verticalAlign="middle" iconSize={10} iconType="circle" />
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
                                  {isRtl ? "حفظ التقرير" : "Save Report"}
                                </button>
                                <button 
                                  onClick={() => handleSharePDF(msg.id, msg.metadata?.reportData)}
                                  className="flex-1 py-2 rounded-xl border border-brand-navy/10 text-brand-navy text-[10px] font-extrabold flex items-center justify-center gap-1.5 hover:bg-brand-cream/20 transition-all"
                                >
                                  <Share className="w-3.5 h-3.5" />
                                  {isRtl ? "مشاركة PDF" : "Share as PDF"}
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
                              className="bg-[#FFFDF9]/60 backdrop-blur-md rounded-[32px] p-6 border border-brand-navy/5 shadow-[0_20px_50px_rgba(27,42,74,0.06)] space-y-6 w-full max-w-lg mx-auto"
                            >
                              {/* 1. SCORE HEADER & RISK METER */}
                              {(() => {
                                const sim = msg.metadata.simulationData;
                                const scoreObj = sim?.score || { score: 70, color: "blue", label: "Needs Review", reasons: [] };
                                const riskVal = sim?.riskLevel || "Medium Risk";
                                const projectionVal = sim?.projectionMonths || 12;
                                const insightsVal = sim?.insights || [];
                                const tableVal = sim?.tableData || [];
                                const sensitivityVal = sim?.sensitivity || [];
                                const warningsVal = sim?.warnings || [];
                                const summaryVal = sim?.summary || sim?.recommendation || "";
                                
                                const isGreen = scoreObj.color === "green";
                                const isBlue = scoreObj.color === "blue";
                                const isYellow = scoreObj.color === "yellow";
                                const isRed = scoreObj.color === "red";
                                
                                const ringColor = isGreen ? "#2E7D4F" : isBlue ? "#7C6FD4" : isYellow ? "#D4754B" : "#C0392B";
                                const riskBg = riskVal === "Low Risk" ? "bg-[#EBF7EE] text-[#2E7D4F] border border-[#2E7D4F]/20" : riskVal === "Medium Risk" ? "bg-[#FDF9F3] text-[#D4754B] border border-[#D4754B]/20" : "bg-[#FCECEB] text-[#C0392B] border border-[#C0392B]/20";
                                
                                // Bloomberg-style Custom Tooltip
                                const CustomTooltip = ({ active, payload }: any) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-white/95 backdrop-blur-md p-3 border border-brand-navy/10 rounded-2xl shadow-xl text-[9px] font-black text-brand-navy space-y-1.5 text-right">
                                        <p className="border-b border-brand-navy/5 pb-1 text-center font-bold text-brand-navy/60">{payload[0].payload.monthName || `شهر ${payload[0].payload.month}`}</p>
                                        {payload.map((entry: any) => (
                                          <div key={entry.name} className="flex items-center justify-between gap-4">
                                            <span className="font-extrabold">{entry.value.toLocaleString()} {isRtl ? "ريال" : "SAR"}</span>
                                            <span className="flex items-center gap-1.5">
                                              {entry.name}
                                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.stroke }} />
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                };

                                return (
                                  <>
                                    {/* Premium Banking Gradient Card Header */}
                                    <div className="bg-gradient-to-br from-[#1B2A4A] to-[#121E36] text-white p-5 rounded-[24px] shadow-md border border-[#1B2A4A]/25 flex items-center justify-between gap-4">
                                      <div className="space-y-1 text-right flex-grow">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-brand-orange block">
                                          {isRtl ? "درجة ملاءمة القرار المالي" : "Financial Decision Suitability"}
                                        </span>
                                        <h3 className="text-[13px] font-black text-white leading-tight">
                                          {sim?.decision}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-2 justify-end">
                                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-extrabold ${riskBg}`}>
                                            {isRtl 
                                              ? (riskVal === "Low Risk" ? "مخاطر منخفضة" : riskVal === "Medium Risk" ? "مخاطر متوسطة" : "مخاطر مرتفعة") 
                                              : riskVal
                                            }
                                          </span>
                                          <span className="text-[9.5px] font-black text-white/70">
                                            {scoreObj.label}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Glowing Circular Gauge */}
                                      <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-full h-full transform -rotate-90">
                                          <circle cx="32" cy="32" r="28" className="stroke-white/10 fill-transparent" strokeWidth="4.5" />
                                          <circle 
                                            cx="32" 
                                            cy="32" 
                                            r="28" 
                                            style={{
                                              stroke: ringColor,
                                              strokeDasharray: 176,
                                              strokeDashoffset: 176 - (176 * scoreObj.score) / 100,
                                              filter: `drop-shadow(0px 0px 5px ${ringColor}60)`
                                            }}
                                            className="fill-transparent transition-all duration-1000" 
                                            strokeWidth="4.5" 
                                            strokeLinecap="round" 
                                          />
                                        </svg>
                                        <div className="absolute flex flex-col items-center justify-center">
                                          <span className="text-[15px] font-black text-white leading-none">{scoreObj.score}</span>
                                          <span className="text-[7px] text-white/50 font-black mt-0.5">/100</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 2. "WHY?" DIAGNOSTICS */}
                                    {scoreObj.reasons && scoreObj.reasons.length > 0 && (
                                      <div className="bg-[#FFFDF9] border border-brand-navy/5 border-r-4 border-r-brand-purple rounded-2xl p-4 space-y-2.5 text-right shadow-sm">
                                        <div className="flex items-center justify-end gap-1.5 text-brand-navy/70 font-black text-[10px]">
                                          <span>{isRtl ? "تشخيص المؤشرات المالية" : "Financial Metrics Diagnosis"}</span>
                                          <Gauge className="w-4 h-4 text-brand-purple" />
                                        </div>
                                        <ul className="space-y-2 text-[9.5px] font-bold text-brand-navy/75">
                                          {scoreObj.reasons.map((reason: string, idx: number) => (
                                            <li key={idx} className="flex items-start justify-end gap-2">
                                              <span className="text-right flex-grow">{reason}</span>
                                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-success flex-shrink-0 mt-0.5" />
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* 3. SCENARIOS GRID */}
                                    {sim?.scenarios && sim.scenarios.length > 0 && (
                                      <div className="space-y-2">
                                        <h5 className="text-[10px] font-black text-brand-navy/40 uppercase tracking-wider text-right">
                                          {isRtl ? "خيارات التخطيط المقارنة" : "Comparative Planning Scenarios"}
                                        </h5>
                                        <div className="grid grid-cols-3 gap-2">
                                          {sim.scenarios.map((sc: any, idx: number) => {
                                            let cardStyle = "bg-white border-brand-navy/5 hover:border-brand-navy/15 hover:shadow-md";
                                            let labelStyle = "text-brand-navy/55";
                                            if (sc.name.includes("Proceed") || sc.name.includes("فوراً")) {
                                              cardStyle = "bg-gradient-to-br from-white to-red-50/20 border-red-200/50 hover:border-red-300/60";
                                              labelStyle = "text-brand-danger";
                                            } else if (sc.name.includes("Down Payment") || sc.name.includes("الدفعة") || sc.name.includes("تقليص")) {
                                              cardStyle = "bg-gradient-to-br from-white to-orange-50/20 border-orange-200/50 hover:border-orange-300/60";
                                              labelStyle = "text-brand-orange";
                                            } else if (sc.name.includes("Delay") || sc.name.includes("تأجيل")) {
                                              cardStyle = "bg-gradient-to-br from-white to-indigo-50/20 border-indigo-200/50 hover:border-indigo-300/60 glow-purple";
                                              labelStyle = "text-brand-purple";
                                            }

                                            return (
                                              <div key={sc.name} className={`p-3 rounded-2xl border text-center flex flex-col justify-between transition-all duration-300 ${cardStyle}`}>
                                                <span className={`text-[8.5px] font-black block leading-tight ${labelStyle}`}>
                                                  {sc.name}
                                                </span>
                                                
                                                <div className="my-2.5">
                                                  <span className="text-[7px] font-bold text-brand-navy/40 uppercase block leading-none">
                                                    {isRtl ? "الأثر الشهري" : "Monthly Impact"}
                                                  </span>
                                                  <span className={`text-[10px] font-extrabold block leading-tight mt-0.5 ${sc.monthly_impact < 0 ? "text-brand-danger" : "text-brand-success"}`}>
                                                    {sc.monthly_impact.toLocaleString()} {isRtl ? "ريال" : "SAR"}
                                                  </span>
                                                </div>

                                                <div>
                                                  <span className="text-[7px] font-bold text-brand-navy/40 uppercase block leading-none">
                                                    {isRtl ? `الرصيد بعد ${projectionVal}ش` : `Bal in ${projectionVal}m`}
                                                  </span>
                                                  <span className="text-[10.5px] font-black text-brand-navy block leading-tight mt-0.5">
                                                    {Math.round(sc.balance_in_period ?? sc.balance_in_12m ?? 0).toLocaleString()} {isRtl ? "ريال" : "SAR"}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* 4. LINE CHART PROJECTION */}
                                    {mounted && sim?.timeline && sim.timeline.length > 0 && (
                                      <div className="h-44 w-full bg-white rounded-2xl border border-brand-navy/5 p-3 shadow-sm">
                                        <span className="text-[8px] font-black text-brand-navy/40 uppercase block tracking-wider mb-2 text-center">
                                          {isRtl ? `مسار حركة الرصيد المتوقعة خلال ${projectionVal} شهراً` : `${projectionVal}-Month Projected Balance Trend`}
                                        </span>
                                        <ResponsiveContainer width="100%" height="90%">
                                          <LineChart 
                                            data={sim.timeline}
                                            margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                                          >
                                            <CartesianGrid stroke="#1B2A4A0A" strokeDasharray="3 3" />
                                            <XAxis dataKey="month" stroke="#1B2A4A60" fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                                            <YAxis stroke="#1B2A4A60" fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line type="monotone" dataKey="balanceNow" name={isRtl ? "البدء فوراً" : "Proceed Today"} stroke="#C0392B" strokeWidth={1.8} dot={false} activeDot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="balanceWait" name={isRtl ? "تأجيل الشراء" : "Delay Purchase"} stroke="#7C6FD4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="balanceAdjusted" name={isRtl ? "زيادة الدفعة" : "Increase Down Payment"} stroke="#D4754B" strokeWidth={1.8} dot={false} activeDot={{ r: 4 }} />
                                          </LineChart>
                                        </ResponsiveContainer>
                                      </div>
                                    )}

                                    {/* 5. SMART INSIGHTS LIST */}
                                    {insightsVal.length > 0 && (
                                      <div className="bg-[#FFFDF9] border border-brand-orange/20 border-r-4 border-r-brand-orange rounded-2xl p-4 space-y-2 text-right shadow-sm">
                                        <div className="flex items-center justify-end gap-1.5 text-brand-orange font-black text-[10px]">
                                          <span>{isRtl ? "التحليلات الاستباقية للتدفق المالي" : "Calculative Flow Insights"}</span>
                                          <Sparkles className="w-4 h-4 animate-pulse" />
                                        </div>
                                        <ul className="list-none text-[9.5px] font-bold text-brand-navy/70 space-y-2">
                                          {insightsVal.map((insight: any, idx: number) => (
                                            <li key={idx} className="leading-relaxed text-right flex items-center justify-end gap-1.5">
                                              <span>{insight.text}</span>
                                              <span className="w-1 h-1 rounded-full bg-brand-orange flex-shrink-0" />
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* 6. COMPARISON TABLE */}
                                    {tableVal.length > 0 && (
                                      <div className="border border-brand-navy/5 rounded-2xl overflow-hidden shadow-sm bg-white">
                                        <table className="w-full text-right border-collapse text-[9px] font-bold text-brand-navy/85">
                                          <thead>
                                            <tr className="bg-brand-navy/5 text-brand-navy text-[8.5px] uppercase tracking-wider">
                                              <th className="p-2 border-b border-brand-navy/5 text-right">{isRtl ? "المؤشر المالي" : "Financial Metric"}</th>
                                              <th className="p-2 border-b border-brand-navy/5 text-center">{isRtl ? "البدء فوراً" : "Now"}</th>
                                              <th className="p-2 border-b border-brand-navy/5 text-center">{isRtl ? "زيادة الدفعة" : "Adjusted"}</th>
                                              <th className="p-2 border-b border-brand-navy/5 text-center">{isRtl ? "تأجيل" : "Delay"}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-brand-navy/5">
                                            {tableVal.map((row: any, idx: number) => (
                                              <tr key={idx} className="hover:bg-brand-cream/10">
                                                <td className="p-2 text-right">{row.metric}</td>
                                                <td className="p-2 text-center text-brand-danger">{row.scenarioNow}</td>
                                                <td className="p-2 text-center text-brand-orange">{row.scenarioAdjusted}</td>
                                                <td className="p-2 text-center text-brand-purple">{row.scenarioWait}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}

                                    {/* 7. SENSITIVITY ANALYSIS */}
                                    {sensitivityVal.length > 0 && (
                                      <div className="space-y-2 text-right">
                                        <h5 className="text-[10px] font-black text-brand-navy/40 uppercase tracking-wider">
                                          {isRtl ? "اختبارات حساسية الميزانية (What-If)" : "Budget Sensitivity & Stress Tests (What-If)"}
                                        </h5>
                                        <div className="grid grid-cols-3 gap-2">
                                          {sensitivityVal.map((sens: any, idx: number) => (
                                            <div key={idx} className="bg-white border border-brand-navy/5 p-3 rounded-2xl flex flex-col justify-between min-h-24 hover:shadow-sm transition-shadow">
                                              <span className="text-[7.5px] font-black text-brand-navy/50 block leading-tight text-right">
                                                {sens.metric}
                                              </span>
                                              <div className="my-1.5 text-right">
                                                <span className="text-[10px] font-black text-brand-navy block">
                                                  {sens.value}
                                                </span>
                                              </div>
                                              <span className={`px-1.5 py-0.5 rounded-full text-[7.5px] font-black inline-block text-center ${sens.isCritical ? "bg-brand-danger/10 text-brand-danger animate-pulse" : "bg-brand-success/10 text-brand-success"}`}>
                                                {sens.impactText}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 8. WARNINGS ALERT */}
                                    {warningsVal.length > 0 && (
                                      <div className="bg-[#FCECEB] border-r-4 border-r-[#C0392B] border border-brand-navy/5 text-[#C0392B] rounded-2xl p-4 space-y-2 text-right shadow-sm">
                                        <div className="flex items-center justify-end gap-1.5 font-bold text-[10px]">
                                          <span>{isRtl ? "مخاطر وتنبيهات هامّة" : "Critical Risk Alerts"}</span>
                                          <AlertTriangle className="w-4 h-4 animate-bounce" />
                                        </div>
                                        <ul className="list-none text-[9px] font-bold space-y-1.5 leading-relaxed">
                                          {warningsVal.map((warn: string, idx: number) => (
                                            <li key={idx} className="text-right flex items-center justify-end gap-1.5">
                                              <span>{warn}</span>
                                              <span className="w-1 h-1 rounded-full bg-[#C0392B] flex-shrink-0" />
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* 9. FINAL SUMMARY */}
                                    {summaryVal && (
                                      <div className="bg-gradient-to-br from-[#7C6FD4]/5 to-[#7C6FD4]/10 border border-[#7C6FD4]/20 rounded-3xl p-5 shadow-sm text-right space-y-1.5">
                                        <div className="flex items-center justify-end gap-1.5 text-brand-purple font-bold text-[10px]">
                                          <span>{isRtl ? "التشخيص والاستنتاج المالي" : "Executive Banking Summary"}</span>
                                          <Activity className="w-4 h-4 animate-pulse" />
                                        </div>
                                        <p className="text-[10px] font-black text-brand-navy/85 whitespace-pre-line leading-relaxed">
                                          {summaryVal}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
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
