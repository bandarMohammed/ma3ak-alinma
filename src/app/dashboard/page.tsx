"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../../store/useStore";
import { useLanguage } from "../../context/LanguageContext";
import { Header } from "../../components/Header";
import { BottomNav } from "../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from "recharts";
import { 
  Eye, EyeOff, Send, Receipt, CreditCard, Bot, 
  ChevronRight, TrendingUp, Sparkles, X, Check,
  ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import { getCategoryIcon } from "../../lib/utils";
import { deriveToday } from "../../lib/finance/calculations";

export default function DashboardPage() {
  const router = useRouter();
  const { t, language, isRtl } = useLanguage();
  const { 
    user, accounts, transactions, loading, fetchFinancialData, createTransaction
  } = useStore();

  const [maskBalance, setMaskBalance] = useState(false);
  
  // Quick Actions Overlays
  const [activeModal, setActiveModal] = useState<"transfer" | "bills" | "cards" | null>(null);
  
  // Transfer Form State
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferBank, setTransferBank] = useState("Alinma");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Bills State
  const [billsPaid, setBillsPaid] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else {
      fetchFinancialData();
    }
  }, [user, router, fetchFinancialData]);

  if (loading || !user || accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-cream text-brand-navy">
        <div className="w-8 h-8 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin"></div>
      </div>
    );
  }

  const account = accounts[0];
  const recentTxs = transactions.slice(0, 5);

  // Spend comparison calculation for Recharts (Current Month vs Last Month)
  // Seed data has high food Delivery spike in current month (May) vs last month (April)
  const currentMonthSpent = transactions
    .filter(t => t.type === "debit" && t.transaction_date.includes("2026-05"))
    .reduce((sum, t) => sum + t.amount, 0);

  const lastMonthSpent = transactions
    .filter(t => t.type === "debit" && t.transaction_date.includes("2026-04"))
    .reduce((sum, t) => sum + t.amount, 0);

  const chartData = [
    {
      name: isRtl ? "أبريل / April" : "April",
      [isRtl ? "المصروفات" : "Spent"]: Math.round(lastMonthSpent),
    },
    {
      name: isRtl ? "مايو / May" : "May",
      [isRtl ? "المصروفات" : "Spent"]: Math.round(currentMonthSpent),
    }
  ];

  // Quick simulated transaction actions
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!transferRecipient || isNaN(amt) || amt <= 0 || amt > account.balance) return;

    await createTransaction({
      amount: amt,
      type: "debit",
      category: "Transfers",
      merchant: `${transferRecipient} (${transferBank})`,
      description: isRtl 
        ? `تحويل سريع إلى ${transferRecipient} - مصرف ${transferBank}`
        : `Transfer to ${transferRecipient} via ${transferBank}`,
      transaction_date: transactions.length > 0 ? deriveToday(transactions) : new Date().toISOString().split("T")[0]
    });

    setTransferSuccess(true);
    setTimeout(() => {
      setTransferSuccess(false);
      setActiveModal(null);
      setTransferRecipient("");
      setTransferAmount("");
    }, 1500);
  };

  const handlePayBill = async (billId: string, merchant: string, amount: number) => {
    if (billsPaid[billId]) return;

    await createTransaction({
      amount: amount,
      type: "debit",
      category: "Bills & Utilities",
      merchant: merchant,
      description: isRtl 
        ? `سداد فاتورة مفوترة - ${merchant}`
        : `Utility Invoice Payment - ${merchant}`,
      transaction_date: transactions.length > 0 ? deriveToday(transactions) : new Date().toISOString().split("T")[0]
    });

    setBillsPaid(prev => ({ ...prev, [billId]: true }));
  };

  return (
    <div className="min-h-screen md:min-h-0 bg-brand-cream md:bg-transparent pb-24 md:pb-0 max-w-md md:max-w-none mx-auto md:mx-0 relative shadow-2xl md:shadow-none">
      <Header />

      <main className="px-5 pt-4 md:px-0 md:pt-0 space-y-5 md:space-y-6 animate-slide-up">
        
        {/* WELCOME / GREETING BAR */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-brand-navy">
              {t("greeting")} {user.full_name.split(" ")[0]} 🦊
            </h2>
            <span className="text-[10px] font-bold text-brand-navy/55 block">
              {t("demoModeNotice")}
            </span>
          </div>
          
          {/* Active AI companion indicator */}
          <div className="flex items-center gap-1 bg-brand-purple/10 px-3 py-1.5 rounded-full border border-brand-purple/20">
            <span className="w-1.5 h-1.5 bg-brand-purple rounded-full animate-ping"></span>
            <span className="text-[9px] font-bold text-brand-purple uppercase tracking-wider">
              {t("chatStatusOnline")}
            </span>
          </div>
        </div>

        {/* Responsive Desktop Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Balance + Quick Actions + Advocacy Banner */}
          <div className="col-span-1 md:col-span-5 space-y-5">
            {/* BALANCE BOX */}
            <motion.div 
              whileHover={{ y: -2 }}
              className="w-full bg-brand-navy text-white rounded-3xl p-6 shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/20 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-orange/20 rounded-full blur-2xl"></div>
              
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-white/60 tracking-wider">
                  {t("availableBalance")}
                </span>
                <button 
                  onClick={() => setMaskBalance(!maskBalance)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  {maskBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <h3 className="text-3xl font-black tracking-tight mb-4">
                {maskBalance ? (
                  "•••••• " + t("sar")
                ) : (
                  `${account.balance.toLocaleString()} ${t("sar")}`
                )}
              </h3>

              <div className="border-t border-white/10 pt-4 flex justify-between items-center text-[10px] font-medium text-white/50">
                <span>{account.account_number}</span>
                <span>{account.type}</span>
              </div>
            </motion.div>

            {/* QUICK ACTIONS ROW */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-brand-navy/60 uppercase tracking-wider px-1">
                {t("quickActions")}
              </h3>
              <div className="grid grid-cols-4 gap-3">
                
                {/* ASK MA3AK */}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push("/chat")}
                  className="flex flex-col items-center bg-white p-3 rounded-2xl shadow-sm border border-brand-navy/5"
                >
                  <div className="w-10 h-10 bg-brand-purple/10 flex items-center justify-center rounded-xl text-brand-purple mb-2">
                    <Bot className="w-5 h-5 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-bold text-brand-navy text-center truncate max-w-[80px]">
                    {t("actionChat")}
                  </span>
                </motion.button>

                {/* TRANSFER */}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal("transfer")}
                  className="flex flex-col items-center bg-white p-3 rounded-2xl shadow-sm border border-brand-navy/5"
                >
                  <div className="w-10 h-10 bg-brand-navy/5 flex items-center justify-center rounded-xl text-brand-navy mb-2">
                    <Send className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-brand-navy text-center truncate max-w-[80px]">
                    {t("actionTransfer")}
                  </span>
                </motion.button>

                {/* BILLS */}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal("bills")}
                  className="flex flex-col items-center bg-white p-3 rounded-2xl shadow-sm border border-brand-navy/5"
                >
                  <div className="w-10 h-10 bg-brand-navy/5 flex items-center justify-center rounded-xl text-brand-navy mb-2">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-brand-navy text-center truncate max-w-[80px]">
                    {t("actionBills")}
                  </span>
                </motion.button>

                {/* CARDS */}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveModal("cards")}
                  className="flex flex-col items-center bg-white p-3 rounded-2xl shadow-sm border border-brand-navy/5"
                >
                  <div className="w-10 h-10 bg-brand-navy/5 flex items-center justify-center rounded-xl text-brand-navy mb-2">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-brand-navy text-center truncate max-w-[80px]">
                    {t("actionCards")}
                  </span>
                </motion.button>

              </div>
            </div>

            {/* DYNAMIC CHAT ADVOCACY BANNER */}
            <motion.div 
              onClick={() => router.push("/chat")}
              whileHover={{ scale: 1.01 }}
              className="w-full bg-gradient-to-r from-brand-purple to-brand-lightNavy text-white rounded-3xl p-4 shadow-md flex items-center justify-between cursor-pointer border border-brand-purple/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md flex items-center justify-center rounded-xl">
                  <Sparkles className="w-5 h-5 text-brand-orange animate-spin-slow" />
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wide">
                    {isRtl ? "هل أصرف بشكل زائد هذا الشهر؟" : "Am I overspending this month?"}
                  </h4>
                  <p className="text-[10px] font-semibold text-white/70">
                    {isRtl ? "دع «معك» يحلل عاداتك ويقترح خطة ضبط الميزانية." : "Let Ma3ak run an automated habit audit."}
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-white/50 ${isRtl ? "rotate-180" : ""}`} />
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Charts + Recent Transactions (7 cols on md) */}
          <div className="col-span-1 md:col-span-7 space-y-5">
            {/* SPENDING COMPARISON CHART CARD */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-brand-navy/5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider">
                  {t("spendingOverview")}
                </h3>
                <span className="text-[9px] font-bold text-brand-orange flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {isRtl ? "+٤٢٪ زيادة" : "+42% Increase"}
                </span>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#1B2A4A80" fontSize={9} fontWeight="bold" tickLine={false} />
                    <YAxis stroke="#1B2A4A80" fontSize={9} fontWeight="bold" tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(124, 111, 212, 0.05)" }} contentStyle={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid rgba(27, 42, 74, 0.1)", fontSize: "10px", fontWeight: "bold" }} />
                    <Bar 
                      dataKey={isRtl ? "المصروفات" : "Spent"} 
                      fill="#7C6FD4" 
                      radius={[8, 8, 0, 0]} 
                      maxBarSize={55}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RECENT TRANSACTIONS */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-bold text-brand-navy/60 uppercase tracking-wider">
                  {t("recentTransactions")}
                </h3>
                <button 
                  onClick={() => router.push("/transactions")}
                  className="text-[10px] font-extrabold text-brand-purple hover:underline"
                >
                  {t("viewAll")}
                </button>
              </div>

              <div className="space-y-2">
                {recentTxs.map((tx) => {
                  const Icon = getCategoryIcon(tx.category);
                  const isCredit = tx.type === "credit";
                  return (
                    <div 
                      key={tx.id}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-brand-navy/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-cream/50 flex items-center justify-center rounded-xl text-brand-navy/70">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-brand-navy truncate max-w-[150px]">
                            {tx.merchant}
                          </h4>
                          <span className="text-[9px] font-bold text-brand-navy/40">
                            {tx.transaction_date}
                          </span>
                        </div>
                      </div>
                      
                      <span className={`text-xs font-black ${isCredit ? "text-brand-success" : "text-brand-navy"}`}>
                        {isCredit ? "+" : "-"} {tx.amount.toLocaleString()} {t("sar")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

      </main>

      <BottomNav activeTab="home" />

      {/* ============================================================================
          INTERACTIVE OVERLAYS / MODAL POPUPS (TRANSFER, BILLS, CARDS)
          ============================================================================ */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4"
          >
            {/* Modal Canvas */}
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-md max-h-[85vh] md:max-h-[90vh] overflow-y-auto p-6 relative border border-brand-navy/5 shadow-2xl"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-brand-navy">
                  {activeModal === "transfer" && t("actionTransfer")}
                  {activeModal === "bills" && t("actionBills")}
                  {activeModal === "cards" && t("actionCards")}
                </h3>
                <button 
                  onClick={() => {
                    setActiveModal(null);
                    setTransferSuccess(false);
                  }}
                  className="p-1.5 rounded-full bg-brand-cream/50 text-brand-navy/60 hover:bg-brand-cream hover:text-brand-navy transition-colors focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* -----------------------------------------------------------
                  modal content A: TRANSFER FUNDS
                  ----------------------------------------------------------- */}
              {activeModal === "transfer" && (
                <div>
                  {transferSuccess ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                      <div className="w-16 h-16 bg-brand-success/10 rounded-full flex items-center justify-center text-brand-success">
                        <Check className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-black text-brand-navy text-center">
                        {isRtl ? "تم إرسال الحوالة بنجاح!" : "Transfer Sent Successfully!"}
                      </h4>
                      <p className="text-xs font-semibold text-brand-navy/50 text-center">
                        {isRtl ? `تم تحويل ${transferAmount} ريال إلى ${transferRecipient}` : `Sent ${transferAmount} SAR to ${transferRecipient}`}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleTransferSubmit} className="space-y-4">
                      {/* Recipient Input */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-brand-navy/70 block">
                          {isRtl ? "اسم المستلم" : "Recipient Full Name"}
                        </label>
                        <input
                          type="text"
                          required
                          value={transferRecipient}
                          onChange={(e) => setTransferRecipient(e.target.value)}
                          placeholder={isRtl ? "خالد العتيبي" : "Khaled Al-Otaibi"}
                          className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-sm font-semibold focus:outline-none focus:border-brand-purple transition-all"
                        />
                      </div>

                      {/* Bank Select */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-brand-navy/70 block">
                          {isRtl ? "مصرف المستلم" : "Recipient Bank"}
                        </label>
                        <select
                          value={transferBank}
                          onChange={(e) => setTransferBank(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-sm font-semibold focus:outline-none focus:border-brand-purple transition-all"
                        >
                          <option value="Alinma">{isRtl ? "مصرف الإنماء" : "Alinma Bank"}</option>
                          <option value="Al Rajhi">{isRtl ? "مصرف الراجحي" : "Al Rajhi Bank"}</option>
                          <option value="SNB">{isRtl ? "البنك الأهلي السعودي" : "SNB Bank"}</option>
                          <option value="Riyad">{isRtl ? "بنك الرياض" : "Riyad Bank"}</option>
                        </select>
                      </div>

                      {/* Amount */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-brand-navy/70 block">
                          {isRtl ? "المبلغ المالي" : "Transfer Amount"}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="1"
                            max={account.balance}
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            placeholder="0.00"
                            className={`w-full ${isRtl ? "pl-14 pr-4" : "pr-14 pl-4"} py-3 rounded-2xl bg-brand-cream/40 border border-brand-navy/10 text-brand-navy text-sm font-bold focus:outline-none focus:border-brand-purple transition-all`}
                          />
                          <span className={`absolute inset-y-0 ${isRtl ? "left-4" : "right-4"} flex items-center text-xs font-black text-brand-navy/40`}>
                            {t("sar")}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-brand-navy/40 block px-1">
                          {isRtl ? `الرصيد المتاح: ${account.balance.toLocaleString()} ريال` : `Available balance: ${account.balance.toLocaleString()} SAR`}
                        </span>
                      </div>

                      {/* Submit */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        className="w-full py-3.5 rounded-2xl bg-brand-navy text-white text-sm font-extrabold shadow-md hover:bg-brand-navy/95 transition-all mt-4 flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isRtl ? "إرسال الحوالة فوراً" : "Send Transfer Instantly"}</span>
                      </motion.button>
                    </form>
                  )}
                </div>
              )}

              {/* -----------------------------------------------------------
                  modal content B: UTILITY BILLS
                  ----------------------------------------------------------- */}
              {activeModal === "bills" && (
                <div className="space-y-4">
                  {[
                    { id: "bill-elec", merchant: "Saudi Electricity Co.", desc: isRtl ? "فاتورة كهرباء شهرية" : "Monthly Electricity Bill", amount: 480 },
                    { id: "bill-tele", merchant: "stc pay", desc: isRtl ? "فاتورة الهاتف المحمول" : "stc Telecom Bill", amount: 287.5 }
                  ].map(bill => {
                    const isPaid = billsPaid[bill.id];
                    return (
                      <div 
                        key={bill.id}
                        className="bg-brand-cream/35 border border-brand-navy/5 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div>
                          <h4 className="text-xs font-black text-brand-navy">{bill.merchant}</h4>
                          <span className="text-[10px] font-bold text-brand-navy/50">{bill.desc}</span>
                          <span className="text-[11px] font-extrabold text-brand-navy block mt-1">
                            {bill.amount.toLocaleString()} {t("sar")}
                          </span>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          disabled={isPaid}
                          onClick={() => handlePayBill(bill.id, bill.merchant, bill.amount)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black shadow-sm transition-all ${
                            isPaid 
                              ? "bg-brand-success/15 text-brand-success" 
                              : "bg-brand-navy text-white hover:bg-brand-navy/90"
                          }`}
                        >
                          {isPaid ? (isRtl ? "مدفوعة" : "Paid") : (isRtl ? "سداد الآن" : "Pay Now")}
                        </motion.button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* -----------------------------------------------------------
                  modal content C: DEBIT CARDS
                  ----------------------------------------------------------- */}
              {activeModal === "cards" && (
                <div className="space-y-5 flex flex-col items-center">
                  
                  {/* Virtual Luxury Card */}
                  <motion.div 
                    initial={{ rotateY: 90 }}
                    animate={{ rotateY: 0 }}
                    className="w-full max-w-[320px] aspect-[1.586/1] bg-gradient-to-br from-brand-navy via-brand-lightNavy to-brand-purple text-white rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute top-0 right-0 w-36 h-36 bg-brand-orange/10 rounded-full blur-2xl"></div>
                    
                    {/* Alinma logo + chips */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-[10px] font-black uppercase tracking-wider">alinma</span>
                      </div>
                      
                      {/* Gold Chip */}
                      <div className="w-7 h-5.5 bg-gradient-to-r from-amber-400 to-amber-200 rounded-md shadow-inner"></div>
                    </div>

                    {/* Card Number */}
                    <div className="my-auto">
                      <p className="text-base font-black text-center tracking-widest text-white/90">
                        ٤٥٦٨ •••• •••• ٩٠١٢
                      </p>
                    </div>

                    {/* Holder info */}
                    <div className="flex justify-between items-end text-[10px] font-medium text-white/60">
                      <div>
                        <span className="text-[7px] uppercase tracking-wider block text-white/40">Card Holder</span>
                        <span className="font-bold text-white">{user.full_name}</span>
                      </div>
                      <div>
                        <span className="text-[7px] uppercase tracking-wider block text-white/40">Expiry</span>
                        <span className="font-bold text-white">09 / 30</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Card limit progress bar */}
                  <div className="w-full space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-brand-navy/60">
                      <span>{isRtl ? "حد السحب اليومي" : "Daily Withdrawal Limit"}</span>
                      <span>5,000 / 10,000 {t("sar")}</span>
                    </div>
                    <div className="w-full h-2 bg-brand-cream rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-brand-purple rounded-full"></div>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3 mt-2">
                    <button className="py-2.5 rounded-xl border border-brand-navy/10 text-brand-navy text-[10px] font-extrabold hover:bg-brand-cream/30 transition-all">
                      {isRtl ? "تجميد المؤقت" : "Temporary Freeze"}
                    </button>
                    <button className="py-2.5 rounded-xl border border-brand-navy/10 text-brand-navy text-[10px] font-extrabold hover:bg-brand-cream/30 transition-all">
                      {isRtl ? "تغيير الرقم السري" : "Change PIN"}
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
