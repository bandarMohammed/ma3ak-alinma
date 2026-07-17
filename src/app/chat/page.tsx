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
  CheckCircle2, AlertTriangle, Coins, X
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { computeCommitments, deriveToday } from "../../lib/finance/calculations";
import { RiyalSymbol } from "../../components/RiyalSymbol";

export default function ChatPage() {
  const router = useRouter();
  const { t, language, isRtl } = useLanguage();
  const {
    user, messages, transactions, accounts, actionLoading, activeConversationId,
    sendChatMessage, receiveAssistantResponse, startNewConversation,
    setActiveConversation, saveReport, savedReports, createTransaction
  } = useStore();

  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Custom Date Picker State
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-29");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Commitment UI Filter State
  const [commitmentTab, setCommitmentTab] = useState<"all" | "upcoming" | "awaiting" | "completed">("all");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Custom Commitments State
  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [newCommitmentMerchant, setNewCommitmentMerchant] = useState("");
  const [newCommitmentAmount, setNewCommitmentAmount] = useState("");
  const [newCommitmentDay, setNewCommitmentDay] = useState("15");
  const [newCommitmentCategory, setNewCommitmentCategory] = useState("Bills & Utilities");
  const [newCommitmentEmoji, setNewCommitmentEmoji] = useState("📋");
  const [newCommitmentDuration, setNewCommitmentDuration] = useState("ongoing");
  const [newCommitmentCustomDuration, setNewCommitmentCustomDuration] = useState("1");

  // Edit Commitment State
  const [showEditCommitment, setShowEditCommitment] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<any>(null);
  const [editCommitmentCategory, setEditCommitmentCategory] = useState("Bills & Utilities");
  const [editCommitmentEmoji, setEditCommitmentEmoji] = useState("📋");
  const [editCommitmentExpectedAmount, setEditCommitmentExpectedAmount] = useState("");
  const [editCommitmentDueDate, setEditCommitmentDueDate] = useState("15");

  // Commitment Detail & Payment Confirmation States
  const [selectedCommitmentDetails, setSelectedCommitmentDetails] = useState<any>(null);
  const [paymentConfirmation, setPaymentConfirmation] = useState<{ merchant: string; amount: number } | null>(null);

  const refreshCommitmentsLocalData = () => {
    const custom = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_custom_commitments") || "[]") : [];
    const deleted = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_deleted_commitments") || "[]") : [];
    const latestTxs = useStore.getState().transactions;
    const updatedData = computeCommitments(latestTxs, language, custom, deleted);
    
    const updatedMessages = messages.map(msg => {
      if (msg.metadata?.type === "commitments") {
        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            commitmentsData: updatedData
          }
        };
      }
      return msg;
    });
    
    useStore.setState({ messages: updatedMessages });
  };

  const handlePayCommitment = async (merchant: string, amount: number) => {
    try {
      await createTransaction({
        amount,
        type: "debit",
        category: "Bills & Utilities",
        merchant,
        description: isRtl ? `سداد التزام - ${merchant}` : `Commitment Payment - ${merchant}`,
        transaction_date: transactions.length > 0 ? deriveToday(transactions) : new Date().toISOString().split("T")[0]
      });
      setToastMessage(isRtl ? "تم سداد الالتزام بنجاح ✓" : "Commitment paid successfully ✓");
      setTimeout(() => setToastMessage(null), 3000);

      
      // Refresh transactions state in the store so the newly logged transaction is in store
      await useStore.getState().fetchTransactions();
      
      // Recompute and update the UI card locally
      refreshCommitmentsLocalData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCommitmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newCommitmentAmount);
    const day = parseInt(newCommitmentDay);
    if (!newCommitmentMerchant || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 31) return;

    const stored = JSON.parse(localStorage.getItem("ma3ak_custom_commitments") || "[]");
    
    // Parse duration
    let durVal: string | number = "ongoing";
    if (newCommitmentDuration !== "ongoing") {
      durVal = newCommitmentDuration === "custom" ? parseInt(newCommitmentCustomDuration) : parseInt(newCommitmentDuration);
      if (isNaN(durVal) || durVal <= 0) durVal = 1;
    }

    const newItem = {
      merchant: newCommitmentMerchant,
      category: newCommitmentCategory,
      emoji: newCommitmentEmoji || "📋",
      expectedAmount: amt,
      dueDate: day,
      duration: durVal,
      startMonth: new Date().toISOString().substring(0, 7)
    };
    stored.push(newItem);
    localStorage.setItem("ma3ak_custom_commitments", JSON.stringify(stored));

    // Reset fields & modal
    setNewCommitmentMerchant("");
    setNewCommitmentAmount("");
    setNewCommitmentDay("15");
    setNewCommitmentCategory("Bills & Utilities");
    setNewCommitmentEmoji("📋");
    setNewCommitmentDuration("ongoing");
    setNewCommitmentCustomDuration("1");
    setShowAddCommitment(false);

    setToastMessage(isRtl ? "تم إضافة الالتزام بنجاح ✓" : "Commitment added successfully ✓");
    setTimeout(() => setToastMessage(null), 3000);

    // Recompute and update the UI card locally
    refreshCommitmentsLocalData();
  };

  const handleStartEditCommitment = (c: any) => {
    setEditingCommitment(c);
    setEditCommitmentCategory(c.category);
    setEditCommitmentEmoji(c.emoji || "📋");
    setEditCommitmentExpectedAmount(c.expectedAmount.toString());
    setEditCommitmentDueDate(c.dueDate.toString());
    setShowEditCommitment(true);
  };

  const handleEditCommitmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommitment) return;
    const amt = parseFloat(editCommitmentExpectedAmount);
    const day = parseInt(editCommitmentDueDate);
    if (isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 31) return;

    const stored = JSON.parse(localStorage.getItem("ma3ak_custom_commitments") || "[]");
    const existingIdx = stored.findIndex((item: any) => item.merchant.toLowerCase() === editingCommitment.merchant.toLowerCase());
    
    const newItem = {
      merchant: editingCommitment.merchant,
      category: editCommitmentCategory,
      emoji: editCommitmentEmoji,
      expectedAmount: amt,
      dueDate: day,
      duration: editingCommitment.duration || "ongoing",
      startMonth: editingCommitment.startMonth || new Date().toISOString().substring(0, 7)
    };

    if (existingIdx !== -1) {
      stored[existingIdx] = newItem;
    } else {
      stored.push(newItem);
    }

    // Also remove from deleted commitments just in case they are editing a deleted one
    const deleted = JSON.parse(localStorage.getItem("ma3ak_deleted_commitments") || "[]");
    const filteredDeleted = deleted.filter((d: string) => d.toLowerCase() !== editingCommitment.merchant.toLowerCase());
    localStorage.setItem("ma3ak_deleted_commitments", JSON.stringify(filteredDeleted));
    
    localStorage.setItem("ma3ak_custom_commitments", JSON.stringify(stored));
    setShowEditCommitment(false);
    setToastMessage(isRtl ? "تم تعديل الالتزام بنجاح ✓" : "Commitment updated successfully ✓");
    setTimeout(() => setToastMessage(null), 3000);

    // Recompute and update the UI card locally
    refreshCommitmentsLocalData();
  };

  const handleDeleteCommitment = (merchant: string) => {
    // 1. Remove from custom commitments
    const stored = JSON.parse(localStorage.getItem("ma3ak_custom_commitments") || "[]");
    const filtered = stored.filter((item: any) => item.merchant.toLowerCase() !== merchant.toLowerCase());
    localStorage.setItem("ma3ak_custom_commitments", JSON.stringify(filtered));

    // 2. Add to deleted commitments list
    const deleted = JSON.parse(localStorage.getItem("ma3ak_deleted_commitments") || "[]");
    if (!deleted.some((d: string) => d.toLowerCase() === merchant.toLowerCase())) {
      deleted.push(merchant);
      localStorage.setItem("ma3ak_deleted_commitments", JSON.stringify(deleted));
    }

    setToastMessage(isRtl ? "تم حذف الالتزام بنجاح ✓" : "Commitment deleted successfully ✓");
    setTimeout(() => setToastMessage(null), 3000);

    // Recompute and update the UI card locally
    refreshCommitmentsLocalData();
  };

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
          balance: accounts?.[0]?.balance,
          customCommitments: typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_custom_commitments") || "[]") : [],
          deletedCommitments: typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_deleted_commitments") || "[]") : []
        })
      });

      const data = await response.json();
      
      // Conversational commands logic for custom commitments adding/deleting
      if (data.addCommitment) {
        const currentCustom = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_custom_commitments") || "[]") : [];
        const filteredCustom = currentCustom.filter((c: any) => c.merchant.toLowerCase() !== data.addCommitment.merchant.toLowerCase());
        filteredCustom.push(data.addCommitment);
        localStorage.setItem("ma3ak_custom_commitments", JSON.stringify(filteredCustom));
        
        // Remove from deleted if it was previously deleted
        const currentDeleted = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_deleted_commitments") || "[]") : [];
        const filteredDeleted = currentDeleted.filter((d: string) => d.toLowerCase() !== data.addCommitment.merchant.toLowerCase());
        localStorage.setItem("ma3ak_deleted_commitments", JSON.stringify(filteredDeleted));
        
        refreshCommitmentsLocalData();
      }

      if (data.deleteCommitment) {
        // Delete from custom
        const currentCustom = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_custom_commitments") || "[]") : [];
        const filteredCustom = currentCustom.filter((c: any) => c.merchant.toLowerCase() !== data.deleteCommitment.toLowerCase());
        localStorage.setItem("ma3ak_custom_commitments", JSON.stringify(filteredCustom));

        // Add to deleted
        const currentDeleted = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ma3ak_deleted_commitments") || "[]") : [];
        if (!currentDeleted.some((d: string) => d.toLowerCase() === data.deleteCommitment.toLowerCase())) {
          currentDeleted.push(data.deleteCommitment);
          localStorage.setItem("ma3ak_deleted_commitments", JSON.stringify(currentDeleted));
        }

        refreshCommitmentsLocalData();
      }

      // 3. Assemble ChatMessage object with structured metadata
      const aiMsg = {
        conversation_id: activeConversationId,
        role: "assistant" as const,
        content: data.type === "text"
          ? data.content
          : data.type === "simulation"
            ? (isRtl ? "إليك تحليل المحاكاة المالية لقرارك:" : "Here is the financial simulation for your decision:")
            : data.type === "commitments"
              ? (isRtl ? "إليك الالتزام المالي المطلوب:" : "Here is the requested financial commitment details:")
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
          commitmentsData: data.type === "commitments" ? data : undefined,
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
      const isRtl = language === "ar";
      const clientName = user?.full_name || (isRtl ? "أحمد العنزي" : "Ahmed Al-Enazi");
      const periodName = reportData.period;
      const footerText = isRtl ? "حقوق هاكاثون أمد | معك" : "Copyright Hackathon Amad | Ma3ak";
      
      const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        try {
          const parts = dateStr.split("-");
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
          }
        } catch (e) {}
        return dateStr;
      };

      const startFormatted = formatDate(reportData.startDate || reportData.start_date);
      const endFormatted = formatDate(reportData.endDate || reportData.end_date);

      const catNameArMap: Record<string, string> = {
        "Bills & Utilities": "الفواتير والخدمات",
        "Entertainment": "الترفيه والتسلية",
        "Food & Restaurants": "المطاعم والأغذية",
        "Shopping": "التسوق",
        "Transportation": "النقل والمواصلات",
        "Healthcare": "الصحة والعافية",
        "Transfers": "التحويلات"
      };

      const getCategoryIconSvgPath = (category: string) => {
        switch (category) {
          case "Bills & Utilities":
            return `<rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>`;
          case "Food & Restaurants":
            return `<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`;
          case "Shopping":
            return `<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>`;
          case "Transportation":
            return `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>`;
          case "Entertainment":
            return `<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>`;
          case "Healthcare":
            return `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`;
          case "Transfers":
            return `<path d="M17 3L21 7L17 11M21 7H9M7 21L3 17L7 13M3 17H15"/>`;
          default:
            return `<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>`;
        }
      };

      const riyalSvgPath = `
        <path d="M 38 8 L 46 6.8 L 46 65 L 38 78 L 15 82 L 15 74 L 38 70 Z" />
        <path d="M 54 15 L 62 13.8 L 62 68 L 54 68 Z" />
        <path d="M 18 50 L 81 35 L 81 43 L 18 58 Z" />
        <path d="M 62 57 L 81 53 L 81 61 L 62 65 Z" />
        <path d="M 54 78 L 81 74 L 81 82 L 54 86 Z" />
      `;
      const riyalSvg = `<svg viewBox="0 0 100 100" style="width: 1em; height: 1em; display: inline-block; vertical-align: -0.15em; fill: currentColor;">${riyalSvgPath}</svg>`;

      const netSavings = reportData.totalIncome - reportData.totalSpent;
      const savingsRate = reportData.totalIncome > 0 ? (netSavings / reportData.totalIncome) * 100 : 0;
      
      const start = new Date(reportData.startDate || reportData.start_date);
      const end = new Date(reportData.endDate || reportData.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 7;
      const avgDailySpend = reportData.totalSpent / diffDays;

      const highestCategory = reportData.topCategories.length > 0 ? reportData.topCategories[0] : null;
      const highestCategoryNameAr = highestCategory ? (catNameArMap[highestCategory.category] || highestCategory.category) : (isRtl ? "لا يوجد" : "None");
      const highestCategoryPct = highestCategory ? highestCategory.percentage : 0;

      let donutCircles = "";
      if (reportData.totalSpent === 0 || reportData.topCategories.length === 0) {
        donutCircles = `<circle cx="50" cy="50" r="35" fill="transparent" stroke="#E2E8F0" stroke-width="12" />`;
      } else {
        let currentOffset = 0;
        donutCircles = reportData.topCategories.map((cat: any, idx: number) => {
          const percentage = cat.percentage;
          const length = (percentage / 100) * 219.91;
          const offset = currentOffset;
          currentOffset += length;
          const color = COLORS[idx % COLORS.length];
          return `<circle cx="50" cy="50" r="35" fill="transparent" stroke="${color}" stroke-width="12" stroke-dasharray="${length} 219.91" stroke-dashoffset="-${offset}" transform="rotate(-90 50 50)" />`;
        }).join("");
      }

      const donutSvg = `
        <svg viewBox="0 0 100 100" style="width: 140px; height: 140px;">
          <circle cx="50" cy="50" r="35" fill="transparent" stroke="#F1F3F5" stroke-width="12" />
          ${donutCircles}
          <text x="50" y="42" text-anchor="middle" font-size="5" font-weight="bold" fill="rgba(27,42,74,0.45)" font-family="'Segoe UI', 'Tahoma', 'Arial', sans-serif">إجمالي المصروفات</text>
          <text x="50" y="55" text-anchor="middle" font-size="9" font-weight="900" fill="#1B2A4A" font-family="Inter, sans-serif">${reportData.totalSpent.toLocaleString()}</text>
          <g transform="translate(46.7, 60) scale(0.08)">
            ${riyalSvgPath.replace(/fill="[^"]*"/g, "").replace(/currentColor/g, "#7C6FD4")}
          </g>
        </svg>
      `;

      const categoriesListHtml = reportData.topCategories.map((cat: any, idx: number) => {
        const color = COLORS[idx % COLORS.length];
        const catNameAr = catNameArMap[cat.category] || cat.category;
        const catIconPath = getCategoryIconSvgPath(cat.category);
        return `
          <div style="display: table; width: 100%; border-bottom: 1px solid rgba(27,42,74,0.03); padding-bottom: 6px; margin-bottom: 2px;">
            <div style="display: table-cell; vertical-align: middle; width: 70%;">
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <div style="width: 24px; height: 24px; background-color: ${color}12; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; color: ${color};">
                  <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.2;">
                    ${catIconPath}
                  </svg>
                </div>
                <span style="font-size: 9.5px; font-weight: bold; color: #1B2A4A; text-align: right; line-height: 1.2;">
                  ${cat.category}
                  <span style="display: block; font-size: 7.5px; color: rgba(27,42,74,0.45); font-family: 'Segoe UI', 'Tahoma', sans-serif; font-weight: 800; margin-top: 1px;">${catNameAr}</span>
                </span>
              </div>
            </div>
            <div style="display: table-cell; vertical-align: middle; width: 30%; text-align: left; font-size: 9px; font-weight: bold; color: #1B2A4A;">
              <span style="font-size: 10px; font-weight: 900; display: block; line-height: 1.1;">
                ${cat.amount.toLocaleString()} <span style="font-size: 7.5px; font-weight: 800; color: rgba(27,42,74,0.55);">ر.س</span>
              </span>
              <span style="font-size: 7.5px; color: ${color}; font-weight: 800;">${cat.percentage}%</span>
            </div>
          </div>
        `;
      }).join("");

      const insightsHtml = reportData.insights.filter((ins: string) => !ins.includes("قرار تمويلي رسمي") && !ins.includes("financing decision")).map((insight: string) => {
        let iconColor = "#D4754B";
        let iconBg = "rgba(212,117,75,0.08)";
        let iconSvg = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.2;"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/></svg>`;
        
        if (insight.includes("الأغذية") || insight.includes("جاهز") || insight.includes("هنجرستيشن") || insight.includes("توصيل") || insight.includes("مطاعم")) {
          iconColor = "#D4754B";
          iconBg = "rgba(212,117,75,0.08)";
          iconSvg = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.2;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
        } else if (insight.includes("الدخل") || insight.includes("الصرف") || insight.includes("المصروفات") || insight.includes("صرف")) {
          iconColor = "#2E7D4F";
          iconBg = "rgba(46,125,79,0.08)";
          iconSvg = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.2;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
        } else if (insight.includes("الوفر") || insight.includes("الادخار") || insight.includes("ادخار") || insight.includes("توفير")) {
          iconColor = "#7C6FD4";
          iconBg = "rgba(124,111,212,0.08)";
          iconSvg = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.2;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
        }
        
        return `
          <div style="background-color: #FFFFFF; border: 1px solid rgba(27,42,74,0.03); padding: 8px 12px; border-radius: 12px; margin-bottom: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">
            <div style="display: table; width: 100%;">
              <div style="display: table-cell; width: 30px; vertical-align: top;">
                <div style="width: 24px; height: 24px; background-color: ${iconBg}; display: flex; align-items: center; justify-content: center; border-radius: 6px; color: ${iconColor};">
                  ${iconSvg}
                </div>
              </div>
              <div style="display: table-cell; vertical-align: middle;">
                <p style="margin: 0; font-size: 9.5px; font-weight: bold; color: #1B2A4A; line-height: 1.5; font-family: 'Segoe UI', 'Tahoma', sans-serif;">${insight}</p>
              </div>
            </div>
          </div>
        `;
      }).join("");

      const spentPct = reportData.totalIncome > 0 ? Math.round((reportData.totalSpent / reportData.totalIncome) * 100) : 0;

      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "-9999px";
      tempDiv.style.width = "595px";
      tempDiv.style.backgroundColor = "#F8F9FA";
      tempDiv.style.padding = "25px";
      tempDiv.style.boxSizing = "border-box";
      tempDiv.style.direction = isRtl ? "rtl" : "ltr";
      tempDiv.style.fontFamily = "'Segoe UI', 'Tahoma', 'Arial', sans-serif";

      tempDiv.innerHTML = `
        <div style="border: 1px solid rgba(27,42,74,0.05); padding: 24px; border-radius: 24px; background-color: #ffffff; box-shadow: 0 8px 24px rgba(27,42,74,0.04); font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif; position: relative;">
          
          <!-- Header (Alinma Premium Table Layout to protect RTL) -->
          <div style="display: table; width: 100%; margin-bottom: 18px; border-bottom: 1px dashed rgba(27,42,74,0.1); padding-bottom: 12px; direction: ${isRtl ? "rtl" : "ltr"};">
            <div style="display: table-cell; text-align: ${isRtl ? "right" : "left"}; vertical-align: middle;">
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; font-weight: 900; color: #1B2A4A; text-align: left; line-height: 1.1; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">
                  alinma bank
                  <span style="display: block; font-size: 8px; color: rgba(27, 42, 74, 0.5); font-family: 'Segoe UI', 'Tahoma', sans-serif; font-weight: bold; margin-top: 1px; text-transform: none; letter-spacing: 0;">مصرف الإنماء</span>
                </span>
                <div style="width: 26px; height: 26px; background-color: #1B2A4A; display: inline-flex; align-items: center; justify-content: center; border-radius: 7px; vertical-align: middle;">
                  <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: #FFFFFF; stroke-width: 2.5;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
              </div>
            </div>
            
            <div style="display: table-cell; text-align: ${isRtl ? "left" : "right"}; vertical-align: middle; color: #1B2A4A;">
              <div style="direction: ${isRtl ? "rtl" : "ltr"}; display: inline-block; vertical-align: middle;">
                <span style="font-size: 14px; font-weight: 900; font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif; color: #1B2A4A; vertical-align: middle;">${isRtl ? "معك" : "Ma3ak"}</span>
                <span style="display: inline-block; width: 1px; height: 12px; background-color: rgba(27,42,74,0.25); margin: 0 8px; vertical-align: middle;"></span>
                <span style="font-size: 14px; font-weight: 900; font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif; color: #1B2A4A; vertical-align: middle;">${isRtl ? "تقرير الأداء المالي" : "Financial Performance Report"}</span>
                <span style="color: #D4754B; display: inline-block; vertical-align: middle; margin-${isRtl ? "right" : "left"}: 6px; line-height: 1;">
                  <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor; display: block;"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/></svg>
                </span>
              </div>
            </div>
          </div>

          <!-- Customer & Period Info Table -->
          <div style="display: table; width: 100%; table-layout: fixed; margin-bottom: 16px; direction: ${isRtl ? "rtl" : "ltr"};">
            <div style="display: table-cell; width: 50%; padding-${isRtl ? "left" : "right"}: 6px; vertical-align: middle;">
              <div style="background-color: #F8F9FA; border: 1px solid rgba(27,42,74,0.03); padding: 10px 14px; border-radius: 14px; text-align: ${isRtl ? "right" : "left"};">
                <div style="display: inline-flex; align-items: center; gap: 10px;">
                  <div style="width: 28px; height: 28px; background-color: rgba(124,111,212,0.08); display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: #7C6FD4; vertical-align: middle;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  </div>
                  <div style="display: inline-block; vertical-align: middle; margin-${isRtl ? "right" : "left"}: 8px; text-align: ${isRtl ? "right" : "left"};">
                    <span style="font-size: 8px; font-weight: bold; color: rgba(27,42,74,0.4); display: block; line-height: 1;">الفترة: ${periodName}</span>
                    <span style="font-size: 10.5px; font-weight: 800; color: #1B2A4A; display: block; margin-top: 3px; direction: ltr;">${startFormatted} - ${endFormatted}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style="display: table-cell; width: 50%; padding-${isRtl ? "right" : "left"}: 6px; vertical-align: middle;">
              <div style="background-color: #F8F9FA; border: 1px solid rgba(27,42,74,0.03); padding: 10px 14px; border-radius: 14px; text-align: ${isRtl ? "right" : "left"};">
                <div style="display: inline-flex; align-items: center; gap: 10px;">
                  <div style="width: 28px; height: 28px; background-color: rgba(27,42,74,0.08); display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: #1B2A4A; vertical-align: middle;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </div>
                  <div style="display: inline-block; vertical-align: middle; margin-${isRtl ? "right" : "left"}: 8px; text-align: ${isRtl ? "right" : "left"};">
                    <span style="font-size: 8px; font-weight: bold; color: rgba(27,42,74,0.4); display: block; line-height: 1;">العميل</span>
                    <span style="font-size: 10.5px; font-weight: 800; color: #1B2A4A; display: block; margin-top: 3px;">${clientName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Income & Expenses Card Table -->
          <div style="display: table; width: 100%; table-layout: fixed; margin-bottom: 16px; direction: ${isRtl ? "rtl" : "ltr"};">
            <div style="display: table-cell; width: 50%; padding-${isRtl ? "left" : "right"}: 7px; vertical-align: middle;">
              <div style="background-color: #EBF7EE; border: 1px solid #D1F0D9; padding: 14px 16px; border-radius: 16px; position: relative; text-align: center;">
                <div style="position: absolute; left: 16px; top: 14px; width: 22px; height: 22px; background-color: rgba(46,125,79,0.08); display: flex; align-items: center; justify-content: center; border-radius: 6px; color: #2E7D4F;">
                  <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.5;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                </div>
                <span style="font-size: 9.5px; font-weight: bold; color: #2E7D4F; display: block; margin-bottom: 4px;">إجمالي الدخل</span>
                <span style="font-size: 17px; font-weight: 900; color: #2E7D4F; display: inline-flex; align-items: center; gap: 4px; direction: ltr;">
                  +${reportData.totalIncome.toLocaleString()} <span style="font-size: 11px;">${riyalSvg}</span>
                </span>
                <span style="font-size: 8px; font-weight: bold; color: rgba(46,125,79,0.65); display: block; margin-top: 4px;">
                  100% من إجمالي الدخل
                </span>
              </div>
            </div>

            <div style="display: table-cell; width: 50%; padding-${isRtl ? "right" : "left"}: 7px; vertical-align: middle;">
              <div style="background-color: #FCECEB; border: 1px solid #F9D6D4; padding: 14px 16px; border-radius: 16px; position: relative; text-align: center;">
                <div style="position: absolute; left: 16px; top: 14px; width: 22px; height: 22px; background-color: rgba(192,57,43,0.08); display: flex; align-items: center; justify-content: center; border-radius: 6px; color: #C0392B;">
                  <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.5;"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                </div>
                <span style="font-size: 9.5px; font-weight: bold; color: #C0392B; display: block; margin-bottom: 4px;">إجمالي المصروفات</span>
                <span style="font-size: 17px; font-weight: 900; color: #C0392B; display: inline-flex; align-items: center; gap: 4px; direction: ltr;">
                  -${reportData.totalSpent.toLocaleString()} <span style="font-size: 11px;">${riyalSvg}</span>
                </span>
                <span style="font-size: 8px; font-weight: bold; color: rgba(192,57,43,0.65); display: block; margin-top: 4px;">
                  ${spentPct}% من إجمالي الدخل
                </span>
              </div>
            </div>
          </div>

          <!-- Middle Section: Donut Chart & Category distribution list -->
          <div style="background-color: #FFFFFF; border: 1px solid rgba(27,42,74,0.04); border-radius: 18px; padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(27,42,74,0.01); direction: ${isRtl ? "rtl" : "ltr"}; text-align: right;">
            <div style="display: block; font-size: 11px; font-weight: 900; color: #1B2A4A; margin-bottom: 12px;">
              <div style="display: inline-flex; align-items: center; gap: 6px; vertical-align: middle;">
                <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.2; vertical-align: middle;"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                <span style="vertical-align: middle;">توزيع المصروفات حسب الفئات</span>
              </div>
            </div>
            <div style="display: table; width: 100%; table-layout: fixed;">
              <div style="display: table-cell; width: 45%; text-align: center; vertical-align: middle;">
                ${donutSvg}
              </div>
              <div style="display: table-cell; width: 55%; vertical-align: middle; text-align: ${isRtl ? "right" : "left"}; padding-${isRtl ? "right" : "left"}: 15px;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${categoriesListHtml || `<p style="font-size: 9px; font-weight: bold; color: rgba(27,42,74,0.4); text-align: center; margin: 10px 0;">لا توجد مصروفات مسجلة.</p>`}
                </div>
              </div>
            </div>
          </div>
          <!-- Insights & Recommendations List -->
          <div style="background-color: #FFFDFB; border: 1px solid #FADED3; border-radius: 18px; padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(212,117,75,0.01); direction: ${isRtl ? "rtl" : "ltr"}; text-align: right;">
            <div style="display: block; font-size: 11px; font-weight: 900; color: #D4754B; margin-bottom: 12px;">
              <div style="display: inline-flex; align-items: center; gap: 6px; vertical-align: middle;">
                <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.2; vertical-align: middle;"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/></svg>
                <span style="vertical-align: middle;">التحليل والتوصيات الذكية</span>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${insightsHtml || `<p style="font-size: 9px; font-weight: bold; color: rgba(27,42,74,0.4); text-align: center; margin: 10px 0;">لا تتوفر توصيات لهذه الفترة.</p>`}
            </div>
          </div>

          <!-- Footer (Legal SAMA disclaimer + branding) -->
          <div style="border-top: 1px dashed rgba(27,42,74,0.1); padding-top: 10px; display: table; width: 100%; font-size: 8px; font-weight: bold; color: rgba(27,42,74,0.4); direction: ${isRtl ? "rtl" : "ltr"};">
            <div style="display: table-cell; text-align: ${isRtl ? "right" : "left"}; vertical-align: middle;">
              <div style="display: inline-flex; align-items: center; gap: 3px; vertical-align: middle;">
                <svg viewBox="0 0 24 24" style="width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 2.2; vertical-align: middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span style="vertical-align: middle;">جميع القيم بالريال السعودي (ر.س)</span>
              </div>
            </div>
            <div style="display: table-cell; text-align: ${isRtl ? "left" : "right"}; vertical-align: middle;">
              <span>${footerText}</span>
            </div>
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
      
      const pageWidth = 210;
      const pageHeight = 297;
      const canvasRatio = pdfCanvas.height / pdfCanvas.width;
      
      let imgWidth = pageWidth;
      let imgHeight = imgWidth * canvasRatio;
      
      if (imgHeight > pageHeight) {
        imgHeight = pageHeight;
        imgWidth = imgHeight / canvasRatio;
      }
      
      const xOffset = (pageWidth - imgWidth) / 2;
      const yOffset = (pageHeight - imgHeight) / 2;
      
      pdf.addImage(imgData, "PNG", xOffset, yOffset, imgWidth, imgHeight);
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-4">
                
                {/* 1. REPORT CARD */}
                <motion.button
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage(isRtl ? "اعطني تقرير الشهر الماضي" : "Give me last month's report")}
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

                {/* 4. COMMITMENTS CARD */}
                <motion.button
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage(isRtl ? "عرض التزاماتي هذا الشهر" : "Show my commitments this month")}
                  className="bg-white rounded-2xl p-5 border border-brand-navy/5 shadow-sm text-right flex flex-col justify-between h-36 relative overflow-hidden group hover:border-brand-purple/25 transition-all focus:outline-none"
                >
                  <div className="w-9 h-9 bg-[#EBF7EE] flex items-center justify-center rounded-xl text-[#2E7D4F] mb-3">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-brand-navy group-hover:text-brand-purple transition-colors mb-1">
                      {isRtl ? "التزاماتي هذا الشهر" : "My Commitments This Month"}
                    </h4>
                    <p className="text-[9.5px] font-bold text-brand-navy/45 leading-normal">
                      {isRtl ? "تتبع الالتزامات الثابتة والمستحقة (أقساط، إيجار، فواتير) وسدادها." : "Track and pay fixed recurring bills, rent, and installments."}
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
                              className="bg-gradient-to-br from-white to-[#FDFDFD] rounded-[32px] p-6 border border-brand-navy/10 shadow-[0_20px_40px_rgba(27,42,74,0.04)] space-y-5 w-full max-w-md mx-auto"
                            >
                              {/* Card Banner */}
                              <div className="flex items-center justify-between bg-brand-purple/5 px-3.5 py-2 rounded-2xl border border-brand-purple/10 text-brand-purple">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-brand-purple" />
                                  <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-navy">
                                    {t("reportCardTitle")}
                                  </h4>
                                </div>
                                <span className="text-[9px] font-extrabold bg-brand-purple/10 px-2 py-0.5 rounded-lg text-brand-purple">
                                  {msg.metadata.reportData.period}
                                </span>
                              </div>

                              {/* Income / Spent Grid */}
                              <div className="grid grid-cols-2 gap-3.5">
                                <div className="bg-gradient-to-br from-[#EBF7EE]/60 to-[#EBF7EE]/15 p-3.5 rounded-2xl border border-brand-success/15 shadow-[0_2px_8px_rgba(46,125,79,0.01)] text-right">
                                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                                    {t("totalIncome")}
                                  </span>
                                  <span className="text-xs font-black text-brand-success block mt-0.5">
                                    +{msg.metadata.reportData.totalIncome.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}
                                  </span>
                                </div>

                                <div className="bg-gradient-to-br from-[#FCECEB]/60 to-[#FCECEB]/15 p-3.5 rounded-2xl border border-brand-danger/15 shadow-[0_2px_8px_rgba(192,57,43,0.01)] text-right">
                                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                                    {t("totalSpent")}
                                  </span>
                                  <span className="text-xs font-black text-brand-danger block mt-0.5">
                                    -{msg.metadata.reportData.totalSpent.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}
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
                                      <Legend formatter={(value) => <span className="text-[11px] font-black text-brand-navy/80">{value}</span>} layout="vertical" align="right" verticalAlign="middle" iconSize={8} iconType="circle" />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              {/* Category Percent List with premium progress bars */}
                              <div className="space-y-3 pt-1">
                                <span className="text-[9px] font-black text-brand-navy/45 uppercase tracking-wider block">
                                  {t("topCategories")}
                                </span>
                                {msg.metadata.reportData.topCategories.slice(0, 3).map((cat, idx) => (
                                  <div key={cat.category} className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-brand-navy/80">
                                      <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                        {cat.category}
                                      </span>
                                      <span>
                                        {cat.amount.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"} ({cat.percentage}%)
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-brand-cream/40 rounded-full overflow-hidden border border-brand-navy/5 p-0.5">
                                      <div 
                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${cat.percentage}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                                      ></div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Smart AI Insights */}
                              <div className="bg-gradient-to-br from-brand-orange/10 to-brand-orange/5 border border-brand-orange/20 rounded-2xl p-4.5 space-y-2.5 shadow-[0_2px_12px_rgba(212,117,75,0.02)]">
                                <div className="flex items-center gap-1.5 text-brand-orange font-black text-[10px]">
                                  <Sparkles className="w-4 h-4 animate-pulse" />
                                  <span>{t("insightsTitle")}</span>
                                </div>
                                <ul className="list-inside text-[9.5px] font-bold text-brand-navy/70 space-y-1.5 leading-relaxed text-right">
                                  {msg.metadata.reportData.insights.map((insight, idx) => (
                                    <li key={idx} className="relative pr-3">
                                      <span className="absolute right-0 text-brand-orange">•</span>
                                      {insight}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Actions bar */}
                              <div className="flex gap-2.5 pt-1.5 border-t border-brand-navy/5">
                                <button 
                                  onClick={() => handleSaveReportToHistory(msg.metadata?.reportData)}
                                  className="flex-1 py-2.5 rounded-xl border border-brand-navy/10 text-brand-navy text-[10px] font-black flex items-center justify-center gap-1.5 hover:bg-brand-cream/30 transition-all focus:outline-none"
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
                                            <span className="font-extrabold">{entry.value.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}</span>
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
                                          {scoreObj.reasons.map((reason: string, idx: number) => {
                                            const isWarning = reason.includes("يتجاوز") || reason.includes("مرتفعة") || reason.includes("غير كافٍ") || reason.includes("عجز") || reason.includes("مخاطر") || reason.includes("فشل") || reason.toLowerCase().includes("exceed") || reason.toLowerCase().includes("elevated") || reason.toLowerCase().includes("insufficient") || reason.toLowerCase().includes("deficit") || reason.toLowerCase().includes("failed");
                                            return (
                                              <li key={idx} className="flex items-start justify-end gap-2">
                                                <span className="text-right flex-grow">{reason}</span>
                                                {isWarning ? (
                                                  <AlertTriangle className="w-3.5 h-3.5 text-[#C0392B] flex-shrink-0 mt-0.5" />
                                                ) : (
                                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D4F] flex-shrink-0 mt-0.5" />
                                                )}
                                              </li>
                                            );
                                          })}
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
                                                    {sc.monthly_impact.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}
                                                  </span>
                                                </div>

                                                <div>
                                                  <span className="text-[7px] font-bold text-brand-navy/40 uppercase block leading-none">
                                                    {isRtl ? `الرصيد بعد ${projectionVal}ش` : `Bal in ${projectionVal}m`}
                                                  </span>
                                                  <span className="text-[10.5px] font-black text-brand-navy block leading-tight mt-0.5">
                                                    {Math.round(sc.balance_in_period ?? sc.balance_in_12m ?? 0).toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}
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

                          {/* =========================================================
                              3. DYNAMIC COMMITMENTS CARD (Premium Alinma Design)
                              ========================================================= */}
                          {msg.metadata.type === "commitments" && msg.metadata.commitmentsData && (
                            <motion.div 
                              initial={{ scale: 0.98, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="bg-gradient-to-br from-white to-[#FDFDFD] rounded-[32px] p-5 border border-brand-navy/10 shadow-[0_25px_50px_-12px_rgba(27,42,74,0.06)] space-y-4 w-full max-w-md mx-auto"
                            >
                              {/* Header Area */}
                              <div className="flex items-center justify-between gap-3 text-right">
                                <div className="flex items-center gap-2">
                                  {/* Bell / Notification placeholder */}
                                  <div className="p-2 rounded-xl bg-brand-cream/40 text-brand-navy/60 border border-brand-navy/5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                                    </svg>
                                  </div>
                                  <button
                                    onClick={() => setShowAddCommitment(true)}
                                    className="w-8 h-8 bg-brand-purple text-white rounded-xl text-lg font-black flex items-center justify-center shadow-md shadow-brand-purple/20 hover:bg-brand-purple/95 transition-all focus:outline-none"
                                    title={isRtl ? "إضافة التزام" : "Add Commitment"}
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="text-right">
                                  <h4 className="text-sm font-black text-brand-navy">
                                    {isRtl ? "الالتزامات" : "Commitments"}
                                  </h4>
                                  <p className="text-[9px] font-bold text-brand-navy/40">
                                    {isRtl ? "إدارة ومتابعة جميع التزاماتك في مكان واحد" : "Manage and track all commitments in one place"}
                                  </p>
                                </div>
                              </div>

                              {/* Status Filter Tabs (Pills) */}
                              <div className="flex gap-1.5 overflow-x-auto pb-1 select-none scrollbar-none justify-end">
                                {[
                                  { id: "all", label: isRtl ? "الكل" : "All", icon: (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                  )},
                                  { id: "upcoming", label: isRtl ? "قادم" : "Upcoming", icon: (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )},
                                  { id: "awaiting", label: isRtl ? "في انتظار" : "Awaiting", icon: (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6M12 12M12 18" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 20v-2a6 6 0 016-6 6 6 0 016 6v2M6 4v2a6 6 0 006 6 6 6 0 006-6V4" />
                                    </svg>
                                  )},
                                  { id: "completed", label: isRtl ? "منتهي" : "Completed", icon: (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )}
                                ].map((tab) => {
                                  const isActive = commitmentTab === tab.id;
                                  return (
                                    <button
                                      key={tab.id}
                                      onClick={() => setCommitmentTab(tab.id as any)}
                                      className={`px-3 py-1.5 rounded-full text-[9px] font-black flex items-center gap-1.5 transition-all focus:outline-none ${
                                        isActive
                                          ? "bg-brand-purple text-white shadow-sm shadow-brand-purple/20"
                                          : "bg-white text-brand-navy/60 border border-brand-navy/5 hover:bg-brand-cream/35"
                                      }`}
                                    >
                                      <span>{tab.label}</span>
                                      {tab.icon}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Calculations and Counters Grid */}
                              {(() => {
                                const data = msg.metadata.commitmentsData;
                                const todayStr = deriveToday(transactions);
                                const todayDay = parseInt(todayStr.slice(8, 10), 10) || 29;

                                const mapped = data.commitments_list.map((c: any) => {
                                  const isComp = c.status === "Completed" || c.remainingAmount === 0;
                                  const isAwait = !isComp && c.paidAmount > 0;
                                  const isUpc = !isComp && c.paidAmount === 0;
                                  const statusType: "completed" | "awaiting" | "upcoming" = isComp 
                                    ? "completed" 
                                    : (isAwait ? "awaiting" : "upcoming");

                                  let daysLabel = "";
                                  if (!isComp) {
                                    if (c.dueDate > todayDay) {
                                      const diff = c.dueDate - todayDay;
                                      daysLabel = isRtl
                                        ? (diff === 1 ? "غداً" : diff === 2 ? "بعد يومين" : `بعد ${diff} أيام`)
                                        : (diff === 1 ? "Tomorrow" : diff === 2 ? "In 2 days" : `In ${diff} days`);
                                    } else if (c.dueDate === todayDay) {
                                      daysLabel = isRtl ? "اليوم" : "Today";
                                    } else {
                                      const diff = todayDay - c.dueDate;
                                      daysLabel = isRtl
                                        ? (diff === 1 ? "متأخر يوم" : diff === 2 ? "متأخر يومين" : `متأخر ${diff} أيام`)
                                        : (diff === 1 ? "1d overdue" : diff === 2 ? "2d overdue" : `${diff}d overdue`);
                                    }
                                  }

                                  return { ...c, statusType, daysLabel };
                                });

                                const totalCount = mapped.length;
                                const upcomingCount = mapped.filter((x: any) => x.statusType === "upcoming").length;
                                const awaitingCount = mapped.filter((x: any) => x.statusType === "awaiting").length;
                                const completedCount = mapped.filter((x: any) => x.statusType === "completed").length;

                                const filtered = mapped.filter((c: any) => {
                                  if (commitmentTab === "all") return true;
                                  if (commitmentTab === "completed") return c.statusType === "completed";
                                  if (commitmentTab === "awaiting") return c.statusType === "awaiting";
                                  if (commitmentTab === "upcoming") return c.statusType === "upcoming";
                                  return true;
                                });

                                return (
                                  <>
                                    {/* Stats Counters Grid */}
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                      {/* Total */}
                                      <div className="bg-white border border-brand-navy/5 p-2 rounded-2xl flex flex-col items-center justify-between min-h-[60px] hover:shadow-sm transition-shadow">
                                        <div className="w-6 h-6 bg-brand-navy/5 text-brand-navy/60 rounded-lg flex items-center justify-center mb-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                          </svg>
                                        </div>
                                        <span className="text-xs font-black text-brand-navy leading-none">{totalCount}</span>
                                        <span className="text-[6.5px] font-black text-brand-navy/40 uppercase mt-0.5">{isRtl ? "الالتزامات" : "Total"}</span>
                                      </div>

                                      {/* Upcoming */}
                                      <div className="bg-white border border-brand-navy/5 p-2 rounded-2xl flex flex-col items-center justify-between min-h-[60px] hover:shadow-sm transition-shadow">
                                        <div className="w-6 h-6 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center mb-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </div>
                                        <span className="text-xs font-black text-blue-500 leading-none">{upcomingCount}</span>
                                        <span className="text-[6.5px] font-black text-blue-500/60 uppercase mt-0.5">{isRtl ? "قادم" : "Upcoming"}</span>
                                      </div>

                                      {/* Awaiting */}
                                      <div className="bg-white border border-brand-navy/5 p-2 rounded-2xl flex flex-col items-center justify-between min-h-[60px] hover:shadow-sm transition-shadow">
                                        <div className="w-6 h-6 bg-brand-orange/5 text-brand-orange rounded-lg flex items-center justify-center mb-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6M12 12M12 18" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 20v-2a6 6 0 016-6 6 6 0 016 6v2M6 4v2a6 6 0 006 6 6 6 0 006-6V4" />
                                          </svg>
                                        </div>
                                        <span className="text-xs font-black text-brand-orange leading-none">{awaitingCount}</span>
                                        <span className="text-[6.5px] font-black text-brand-orange/70 uppercase mt-0.5">{isRtl ? "في انتظار" : "Awaiting"}</span>
                                      </div>

                                      {/* Completed */}
                                      <div className="bg-white border border-brand-navy/5 p-2 rounded-2xl flex flex-col items-center justify-between min-h-[60px] hover:shadow-sm transition-shadow">
                                        <div className="w-6 h-6 bg-brand-success/5 text-brand-success rounded-lg flex items-center justify-center mb-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </div>
                                        <span className="text-xs font-black text-brand-success leading-none">{completedCount}</span>
                                        <span className="text-[6.5px] font-black text-brand-success/70 uppercase mt-0.5">{isRtl ? "منتهي" : "Paid"}</span>
                                      </div>
                                    </div>

                                    {/* List of filtered cards */}
                                    <div className="space-y-3 pt-1">
                                      {filtered.length === 0 ? (
                                        <p className="text-[9px] font-bold text-brand-navy/40 text-center py-6 bg-brand-cream/15 rounded-2xl border border-dashed border-brand-navy/10">
                                          {isRtl ? "لا توجد التزامات مطابقة للفلتر المحدد." : "No commitments found for the active tab."}
                                        </p>
                                      ) : (
                                        filtered.map((c: any) => {
                                          const isCompleted = c.statusType === "completed";
                                          const isAwaiting = c.statusType === "awaiting";
                                          const isUpcoming = c.statusType === "upcoming";

                                          // Color mapping
                                          const statusColor = isCompleted 
                                            ? "bg-brand-success" 
                                            : (isAwaiting ? "bg-brand-orange" : "bg-blue-500");

                                          const pillBg = isCompleted 
                                            ? "bg-[#EBF7EE] text-[#2E7D4F] border-[#2E7D4F]/10" 
                                            : (isAwaiting ? "bg-[#FDF9F3] text-[#D4754B] border-[#D4754B]/10" : "bg-[#EBF3F9] text-blue-500 border-blue-500/10");

                                          const labelText = isCompleted 
                                            ? (isRtl ? "منتهي ✓" : "Paid ✓") 
                                            : (isAwaiting ? (isRtl ? "في انتظار" : "Awaiting") : (isRtl ? "قادم" : "Upcoming"));

                                          // Category Icon Mapping in Brand Colors
                                          const isUtility = c.category === "Bills & Utilities" || c.merchant.toLowerCase().includes("electric") || c.merchant.toLowerCase().includes("water");
                                          const isFinance = c.category === "Financing" || c.merchant.toLowerCase().includes("finance") || c.merchant.toLowerCase().includes("loan");
                                          
                                          const iconColorClass = isUtility 
                                            ? "text-brand-success bg-brand-success/10 border-brand-success/5" 
                                            : (isFinance ? "text-brand-orange bg-brand-orange/10 border-brand-orange/5" : "text-brand-purple bg-brand-purple/10 border-brand-purple/5");

                                          // Calculate percent
                                          const totalAmt = c.expectedAmount || 1;
                                          const paidAmt = c.paidAmount || 0;
                                          const paidPct = Math.round((paidAmt / totalAmt) * 100);

                                          return (
                                            <div 
                                              key={c.id} 
                                              onClick={() => setSelectedCommitmentDetails(c)}
                                              className="bg-white border border-brand-navy/5 rounded-2xl p-3.5 transition-all duration-300 relative cursor-pointer hover:border-brand-purple/25 hover:shadow-sm overflow-visible flex items-center justify-between"
                                            >
                                              {/* Colored Status Ribbon on side */}
                                              <div className={`absolute top-0 bottom-0 ${isRtl ? "right-0 rounded-r-2xl" : "left-0 rounded-l-2xl"} w-1.5 ${statusColor}`} />

                                              {/* Left/Start side: Actions dots menu */}
                                              <div className="relative flex items-center gap-1">
                                                <button 
                                                  onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setActiveMenuId(activeMenuId === c.id ? null : c.id); 
                                                  }} 
                                                  className="p-1.5 rounded-xl hover:bg-brand-cream/60 text-brand-navy/35 hover:text-brand-navy transition-all focus:outline-none"
                                                >
                                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <circle cx="5" cy="12" r="2" />
                                                    <circle cx="12" cy="12" r="2" />
                                                    <circle cx="19" cy="12" r="2" />
                                                  </svg>
                                                </button>

                                                {activeMenuId === c.id && (
                                                  <div className="absolute top-8 left-0 bg-white border border-brand-navy/10 shadow-2xl rounded-2xl p-1 z-20 w-24 text-right flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); handleStartEditCommitment(c); }} 
                                                      className="px-2.5 py-1.5 hover:bg-brand-cream/50 text-[10px] font-black text-brand-navy rounded-xl w-full text-right flex items-center justify-between focus:outline-none"
                                                    >
                                                      <span>{isRtl ? "تعديل" : "Edit"}</span>
                                                      <svg className="w-3 h-3 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                      </svg>
                                                    </button>
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); handleDeleteCommitment(c.merchant); }} 
                                                      className="px-2.5 py-1.5 hover:bg-brand-danger/10 text-[10px] font-black text-brand-danger rounded-xl w-full text-right flex items-center justify-between focus:outline-none"
                                                    >
                                                      <span>{isRtl ? "حذف" : "Delete"}</span>
                                                      <svg className="w-3 h-3 text-brand-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                      </svg>
                                                    </button>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Center/End details */}
                                              <div className={`flex items-center gap-3 text-right flex-grow ${isRtl ? "justify-end pr-3" : "justify-start pl-3"}`}>
                                                <div className="text-right flex-grow">
                                                  <h5 className="text-[11px] font-black text-brand-navy leading-snug">{c.merchant}</h5>
                                                  <span className="text-[8px] font-bold text-brand-navy/35 block uppercase tracking-wide leading-none my-0.5">
                                                    {isRtl && c.category === "Bills & Utilities" ? "الفواتير والخدمات العامة" : isRtl && c.category === "Entertainment" ? "الترفيه والتسلية" : c.category}
                                                  </span>
                                                  
                                                  {/* Date & Icon */}
                                                  <span className="text-[8.5px] font-black text-brand-navy/55 flex items-center gap-1 justify-end mt-1">
                                                    <span>{isRtl ? `يوم ${c.dueDate} من الشهر` : `Day ${c.dueDate}`}</span>
                                                    <svg className="w-3 h-3 text-brand-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                                    </svg>
                                                  </span>
                                                </div>

                                                {/* Icon Square Wrapper */}
                                                <div className={`w-9 h-9 border rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0 ${iconColorClass}`}>
                                                  <span>{c.emoji || "📋"}</span>
                                                </div>
                                              </div>

                                              {/* Right/Start details: Status and Progress Indicators */}
                                              <div className={`flex flex-col items-center justify-center flex-shrink-0 min-w-[70px] ${isRtl ? "pr-4" : "pl-4"}`}>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-wider block text-center ${pillBg}`}>
                                                  {labelText}
                                                </span>
                                                
                                                {/* Upcoming countdown label */}
                                                {isUpcoming && c.daysLabel && (
                                                  <span className="text-[7.5px] font-black text-brand-navy/40 mt-1.5 block text-center">
                                                    {c.daysLabel}
                                                  </span>
                                                )}

                                                {/* Completed tick icon */}
                                                {isCompleted && (
                                                  <div className="w-5 h-5 bg-[#EBF7EE] text-[#2E7D4F] rounded-full flex items-center justify-center mt-1.5">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                  </div>
                                                )}

                                                {/* Awaiting Progress Ring */}
                                                {isAwaiting && (
                                                  <div className="flex items-center gap-1 mt-1.5">
                                                    <span className="text-[7.5px] font-black text-brand-orange">{paidPct}%</span>
                                                    <div className="w-5 h-5 flex items-center justify-center relative">
                                                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                        <path className="text-brand-navy/5" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                        <path className="text-brand-orange" strokeDasharray={`${paidPct}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                      </svg>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
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
          onClick={() => handleSendMessage(isRtl ? "اعطني تقرير الشهر الماضي" : "Give me last month's report")}
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

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSendMessage(isRtl ? "عرض التزاماتي هذا الشهر" : "Show my commitments this month")}
          className="px-3.5 py-2 bg-white text-brand-navy/70 border border-brand-navy/5 rounded-full text-[10px] font-extrabold shadow-sm hover:border-brand-purple/20 hover:text-brand-purple flex-shrink-0 flex items-center gap-1.5"
        >
          <Receipt className="w-3.5 h-3.5 text-brand-success" />
          <span>{isRtl ? "التزاماتي" : "My Commitments"}</span>
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

      {/* ADD COMMITMENT MODAL */}
      <AnimatePresence>
        {showAddCommitment && (
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
              className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-md p-6 relative border border-brand-navy/5 shadow-2xl space-y-4 text-right"
            >
              <div className="flex justify-between items-center border-b border-brand-navy/5 pb-3">
                <button
                  type="button"
                  onClick={() => setShowAddCommitment(false)}
                  className="p-1.5 rounded-full bg-brand-cream/50 text-brand-navy/60 hover:bg-brand-cream hover:text-brand-navy transition-colors focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-sm font-black text-brand-navy flex items-center gap-2 justify-end">
                  <span>{isRtl ? "إضافة التزام مالي جديد" : "Add New Commitment"}</span>
                  <Receipt className="w-5 h-5 text-brand-purple" />
                </h3>
              </div>

              <form onSubmit={handleAddCommitmentSubmit} className="space-y-4">
                {/* Merchant Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-navy/70 block">
                    {isRtl ? "اسم الجهة المستفيدة / المورد" : "Merchant / Provider Name"}
                  </label>
                  <input
                    type="text"
                    required
                    value={newCommitmentMerchant}
                    onChange={(e) => setNewCommitmentMerchant(e.target.value)}
                    placeholder={isRtl ? "مثال: وقت اللياقة" : "e.g., Fitness Time"}
                    className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-right"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Expected Day */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-navy/70 block">
                      {isRtl ? "يوم الاستحقاق الشهري" : "Monthly Due Day"}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={newCommitmentDay}
                      onChange={(e) => setNewCommitmentDay(e.target.value)}
                      placeholder="15"
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-center"
                    />
                  </div>

                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#1B2A4A] block">
                      {isRtl ? "القيمة (ريال)" : "Amount (SAR)"}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newCommitmentAmount}
                      onChange={(e) => setNewCommitmentAmount(e.target.value)}
                      placeholder="350"
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Emoji Icon */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-navy/70 block">
                      {isRtl ? "رمز تعبيري (أيقونة)" : "Emoji Icon"}
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={newCommitmentEmoji}
                      onChange={(e) => setNewCommitmentEmoji(e.target.value)}
                      placeholder="📋"
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-center"
                    />
                  </div>

                  {/* Category Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-navy/70 block">
                      {isRtl ? "التصنيف المالي" : "Financial Category"}
                    </label>
                    <select
                      value={newCommitmentCategory}
                      onChange={(e) => setNewCommitmentCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all"
                      style={{ direction: isRtl ? "rtl" : "ltr" }}
                    >
                      <option value="Bills & Utilities">{isRtl ? "الفواتير والخدمات العامة" : "Bills & Utilities"}</option>
                      <option value="Entertainment">{isRtl ? "الترفيه والتسلية" : "Entertainment"}</option>
                      <option value="Food & Restaurants">{isRtl ? "المطاعم والأغذية" : "Food & Restaurants"}</option>
                      <option value="Shopping">{isRtl ? "التسوق" : "Shopping"}</option>
                      <option value="Transportation">{isRtl ? "النقل والمواصلات" : "Transportation"}</option>
                      <option value="Healthcare">{isRtl ? "الصحة والعافية" : "Healthcare"}</option>
                    </select>
                  </div>
                </div>

                {/* Duration Choice */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-navy/70 block">
                    {isRtl ? "مدة الاستمرار" : "Duration"}
                  </label>
                  <select
                    value={newCommitmentDuration}
                    onChange={(e) => setNewCommitmentDuration(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all"
                    style={{ direction: isRtl ? "rtl" : "ltr" }}
                  >
                    <option value="ongoing">{isRtl ? "مستمر شهرياً حتى الإيقاف يدوياً" : "Ongoing until manually stopped"}</option>
                    <option value="1">{isRtl ? "شهر واحد فقط (هذا الشهر)" : "One-time (this month only)"}</option>
                    <option value="2">{isRtl ? "شهرين (2)" : "2 months"}</option>
                    <option value="3">{isRtl ? "3 أشهر" : "3 months"}</option>
                    <option value="custom">{isRtl ? "عدد مخصص من الأشهر..." : "Custom number of months..."}</option>
                  </select>
                </div>

                {/* Custom Duration Input */}
                {newCommitmentDuration === "custom" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-navy/70 block">
                      {isRtl ? "عدد الأشهر" : "Number of Months"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newCommitmentCustomDuration}
                      onChange={(e) => setNewCommitmentCustomDuration(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-center"
                    />
                  </div>
                )}

                {/* Submit button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-brand-navy text-white text-xs font-black shadow-md hover:bg-brand-navy/95 transition-all mt-4 flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{isRtl ? "تأكيد إضافة الالتزام" : "Confirm Add Commitment"}</span>
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT COMMITMENT MODAL */}
      <AnimatePresence>
        {showEditCommitment && editingCommitment && (
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
              className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-md p-6 relative border border-brand-navy/5 shadow-2xl space-y-4 text-right"
            >
              <div className="flex justify-between items-center border-b border-brand-navy/5 pb-3">
                <button
                  type="button"
                  onClick={() => setShowEditCommitment(false)}
                  className="p-1.5 rounded-full bg-brand-cream/50 text-brand-navy/60 hover:bg-brand-cream hover:text-brand-navy transition-colors focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-sm font-black text-brand-navy flex items-center gap-2 justify-end">
                  <span>{isRtl ? `تعديل التزام - ${editingCommitment.merchant}` : `Edit Commitment - ${editingCommitment.merchant}`}</span>
                  <Receipt className="w-5 h-5 text-brand-purple" />
                </h3>
              </div>

              <form onSubmit={handleEditCommitmentSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Emoji */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-navy/70 block">
                      {isRtl ? "رمز تعبيري (أيقونة)" : "Emoji Icon"}
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editCommitmentEmoji}
                      onChange={(e) => setEditCommitmentEmoji(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-center"
                    />
                  </div>

                  {/* Category Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-navy/70 block">
                      {isRtl ? "التصنيف المالي" : "Financial Category"}
                    </label>
                    <select
                      value={editCommitmentCategory}
                      onChange={(e) => setEditCommitmentCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all"
                      style={{ direction: isRtl ? "rtl" : "ltr" }}
                    >
                      <option value="Bills & Utilities">{isRtl ? "الفواتير والخدمات العامة" : "Bills & Utilities"}</option>
                      <option value="Entertainment">{isRtl ? "الترفيه والتسلية" : "Entertainment"}</option>
                      <option value="Food & Restaurants">{isRtl ? "المطاعم والأغذية" : "Food & Restaurants"}</option>
                      <option value="Shopping">{isRtl ? "التسوق" : "Shopping"}</option>
                      <option value="Transportation">{isRtl ? "النقل والمواصلات" : "Transportation"}</option>
                      <option value="Healthcare">{isRtl ? "الصحة والعافية" : "Healthcare"}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Expected Day */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-navy/70 block">
                      {isRtl ? "يوم الاستحقاق" : "Due Day"}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={editCommitmentDueDate}
                      onChange={(e) => setEditCommitmentDueDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-center"
                    />
                  </div>

                  {/* Expected Amount */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#1B2A4A] block">
                      {isRtl ? "القيمة المتوقعة" : "Expected Amount"}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={editCommitmentExpectedAmount}
                      onChange={(e) => setEditCommitmentExpectedAmount(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-bold focus:outline-none focus:border-brand-purple transition-all text-center"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-brand-navy text-white text-xs font-black shadow-md hover:bg-brand-navy/95 transition-all mt-4 flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{isRtl ? "تأكيد التعديل" : "Confirm Edit"}</span>
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMMITMENT DETAILS MODAL */}
      <AnimatePresence>
        {selectedCommitmentDetails && (
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
              className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-md max-h-[85vh] p-6 relative border border-brand-navy/5 shadow-2xl space-y-5 text-right overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-2 border-b border-brand-navy/5">
                <button
                  onClick={() => setSelectedCommitmentDetails(null)}
                  className="p-1.5 rounded-full bg-brand-cream/50 text-brand-navy/60 hover:bg-brand-cream hover:text-brand-navy transition-colors focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedCommitmentDetails.emoji || "📋"}</span>
                  <h3 className="text-base font-black text-brand-navy">
                    {selectedCommitmentDetails.merchant}
                  </h3>
                </div>
              </div>

              {/* General Info Grid */}
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-navy/5 space-y-1">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {isRtl ? "التصنيف" : "Category"}
                  </span>
                  <span className="font-extrabold text-brand-navy">
                    {selectedCommitmentDetails.category}
                  </span>
                </div>
                <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-navy/5 space-y-1">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {isRtl ? "تاريخ الاستحقاق" : "Due Date"}
                  </span>
                  <span className="font-extrabold text-brand-navy">
                    {isRtl ? `يوم ${selectedCommitmentDetails.dueDate} من الشهر` : `Day ${selectedCommitmentDetails.dueDate} of Month`}
                  </span>
                </div>
                <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-navy/5 space-y-1">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {isRtl ? "المدفوع هذا الشهر" : "Paid This Month"}
                  </span>
                  <span className="font-extrabold text-brand-success">
                    {selectedCommitmentDetails.paidAmount.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}
                  </span>
                </div>
                <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-navy/5 space-y-1">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {isRtl ? "المبلغ المتوقع" : "Expected Amount"}
                  </span>
                  <span className="font-extrabold text-brand-navy">
                    {selectedCommitmentDetails.expectedAmount.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}
                  </span>
                </div>
                <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-navy/5 space-y-1">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {isRtl ? "المتبقي للسداد" : "Remaining to Pay"}
                  </span>
                  <span className={`font-extrabold ${selectedCommitmentDetails.status === "Completed" ? "text-brand-success" : "text-brand-orange"}`}>
                    {selectedCommitmentDetails.remainingAmount.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"} ({selectedCommitmentDetails.remainingPercentage}%)
                  </span>
                </div>
                <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-navy/5 space-y-1">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {isRtl ? "حالة الالتزام" : "Commitment Status"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black inline-block ${
                    selectedCommitmentDetails.status === "Completed" ? "bg-brand-success/15 text-brand-success" : "bg-brand-orange/15 text-brand-orange"
                  }`}>
                    {selectedCommitmentDetails.status === "Completed" ? (isRtl ? "مكتمل ✓" : "Completed ✓") : (isRtl ? "قيد التنفيذ" : "In Progress")}
                  </span>
                </div>
              </div>

              {/* Commitment Duration Rules */}
              <div className="bg-brand-cream/20 p-4 rounded-2xl border border-brand-navy/5 space-y-1 text-xs">
                <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                  {isRtl ? "تفاصيل مدة الالتزام" : "Commitment Duration Details"}
                </span>
                <div className="font-extrabold text-brand-navy flex justify-between items-center">
                  <span className="text-[10px] text-brand-navy/60">
                    {selectedCommitmentDetails.startMonth ? (isRtl ? `تاريخ البدء: ${selectedCommitmentDetails.startMonth}` : `Started: ${selectedCommitmentDetails.startMonth}`) : ""}
                  </span>
                  <span>
                    {(() => {
                      const dur = selectedCommitmentDetails.duration;
                      if (!dur || dur === "ongoing") return isRtl ? "التزام مستمر شهرياً" : "Ongoing commitment";
                      if (dur === 1) return isRtl ? "شهر واحد فقط" : "1 Month only";
                      return isRtl ? `صالح لمدة ${dur} أشهر` : `Valid for ${dur} months`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Matched Transactions Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-brand-navy">
                  {isRtl ? "المعاملات المرتبطة هذا الشهر" : "Associated Payments This Month"}
                </h4>
                {(() => {
                  const currentMonth = deriveToday(transactions).slice(0, 7);
                  const matched = transactions.filter(t => 
                    t.type === "debit" && 
                    t.transaction_date.startsWith(currentMonth) && 
                    t.merchant.toLowerCase().includes(selectedCommitmentDetails.merchant.toLowerCase())
                  );

                  if (matched.length === 0) {
                    return (
                      <p className="text-[10px] font-bold text-brand-navy/40 text-center py-4 bg-brand-cream/15 rounded-2xl border border-dashed border-brand-navy/10">
                        {isRtl ? "لا توجد أي معاملات سداد مسجلة هذا الشهر حتى الآن." : "No payments logged this month yet."}
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                      {matched.map(t => (
                        <div key={t.id} className="flex justify-between items-center p-2.5 bg-brand-success/5 border border-brand-success/10 rounded-xl text-[10px] font-bold">
                          <span className="text-brand-success font-black">-{t.amount.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}</span>
                          <div className="text-right">
                            <span className="text-brand-navy block leading-none">{t.merchant}</span>
                            <span className="text-[8px] text-brand-navy/40 mt-0.5 block">{t.transaction_date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="flex gap-3.5 pt-2">
                <button
                  onClick={() => {
                    const c = selectedCommitmentDetails;
                    setSelectedCommitmentDetails(null);
                    handleStartEditCommitment(c);
                  }}
                  className="flex-1 py-3 rounded-2xl border border-brand-navy/10 text-brand-navy text-xs font-black hover:bg-brand-cream/40 transition-all flex items-center justify-center gap-1.5"
                >
                  {isRtl ? "تعديل الالتزام" : "Edit Commitment"}
                </button>
                {selectedCommitmentDetails.status !== "Completed" && (
                  <button
                    onClick={() => {
                      const c = selectedCommitmentDetails;
                      setSelectedCommitmentDetails(null);
                      setPaymentConfirmation({ merchant: c.merchant, amount: c.expectedAmount });
                    }}
                    className="flex-1 py-3 rounded-2xl bg-brand-navy text-white text-xs font-black shadow-md hover:bg-brand-navy/90 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Coins className="w-4 h-4" />
                    <span>{isRtl ? "سداد الآن" : "Pay Now"}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAYMENT CONFIRMATION MODAL */}
      <AnimatePresence>
        {paymentConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-md flex items-end md:items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-xs p-6 border border-brand-navy/5 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 bg-brand-purple/10 flex items-center justify-center rounded-2xl text-brand-purple mx-auto animate-bounce-slow">
                <Coins className="w-6 h-6 text-brand-purple" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black text-brand-navy">
                  {isRtl ? "تأكيد عملية السداد" : "Confirm Payment"}
                </h3>
                <p className="text-[10px] font-bold text-brand-navy/50 leading-relaxed">
                  {isRtl 
                    ? `هل أنت متأكد من رغبتك في سداد هذا الالتزام المالي؟` 
                    : `Are you sure you want to pay this commitment?`}
                </p>
              </div>

              {/* Payment Details Card */}
              <div className="bg-brand-cream/35 border border-brand-navy/5 p-3.5 rounded-2xl space-y-1">
                <span className="text-[9px] font-black text-brand-navy/60 block">{paymentConfirmation.merchant}</span>
                <span className="text-base font-black text-brand-success">{paymentConfirmation.amount.toLocaleString()} {isRtl ? <RiyalSymbol size="1.05em" /> : "SAR"}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentConfirmation(null)}
                  className="flex-1 py-2.5 rounded-xl border border-brand-navy/10 text-brand-navy text-[10px] font-black hover:bg-brand-cream/40 transition-all"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={async () => {
                    const merchant = paymentConfirmation.merchant;
                    const amount = paymentConfirmation.amount;
                    setPaymentConfirmation(null);
                    await handlePayCommitment(merchant, amount);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-brand-navy text-white text-[10px] font-black shadow-md hover:bg-brand-navy/90 transition-all"
                >
                  {isRtl ? "تأكيد السداد" : "Confirm Pay"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INPUT PANEL */}
      <div className="px-5 py-3.5 bg-white border-t border-brand-navy/5 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          
          {/* Custom Datepicker trigger */}
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            aria-label={t("customReportRange")}
            className={`p-2 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-1 ${
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
              } rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-xs font-semibold focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 transition-all duration-200`}
            />
            {/* Voice Mic Icon (UI placeholder only) */}
            <button 
              aria-label={t("voiceInputTooltip")}
              className={`absolute inset-y-0 ${
                isRtl ? "left-3" : "right-3"
              } flex items-center text-brand-navy/35 hover:text-brand-purple p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple`}
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
            aria-label={isRtl ? "إرسال الرسالة" : "Send message"}
            className="w-10 h-10 bg-brand-navy flex items-center justify-center rounded-2xl text-white shadow-md hover:bg-brand-navy/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-1 transition-all duration-200"
          >
            <Send className="w-4 h-4" />
          </motion.button>

        </div>
      </div>

      <BottomNav activeTab="chat" />
    </div>
  );
}
