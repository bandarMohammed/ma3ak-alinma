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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { RiyalSymbol } from "../../components/RiyalSymbol";

export default function ReportsPage() {
  const router = useRouter();
  const { t, language, isRtl } = useLanguage();
  const { user, savedReports, fetchSavedReports, loading } = useStore();

  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [mounted, setMounted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSharePDF = async () => {
    if (!selectedReport) return;
    try {
      const isRtl = language === "ar";
      const clientName = user?.full_name || (isRtl ? "أحمد العنزي" : "Ahmed Al-Enazi");
      const periodName = selectedReport.title.split(" - ")[1] || selectedReport.title;
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

      const startFormatted = formatDate(selectedReport.start_date);
      const endFormatted = formatDate(selectedReport.end_date);

      const catNameArMap: Record<string, string> = {
        "Bills & Utilities": "الفواتير والخدمات",
        "Housing": "السكن والإيجار",
        "Telecom": "الاتصالات",
        "Insurance": "التأمين",
        "Financing": "التمويل والأقساط",
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
          case "Housing":
            return `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`;
          case "Telecom":
            return `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>`;
          case "Insurance":
            return `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`;
          case "Financing":
            return `<line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 20 7 4 7"></polygon>`;
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

      const netSavings = selectedReport.total_income - selectedReport.total_spent;
      const savingsRate = selectedReport.total_income > 0 ? (netSavings / selectedReport.total_income) * 100 : 0;
      
      const start = new Date(selectedReport.start_date);
      const end = new Date(selectedReport.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 7;
      const avgDailySpend = selectedReport.total_spent / diffDays;

      const highestCategory = selectedReport.top_categories.length > 0 ? selectedReport.top_categories[0] : null;
      const highestCategoryNameAr = highestCategory ? (catNameArMap[highestCategory.category] || highestCategory.category) : (isRtl ? "لا يوجد" : "None");
      const highestCategoryPct = highestCategory ? highestCategory.percentage : 0;

      const COLORS = ["#7C6FD4", "#D4754B", "#1B2A4A", "#2E7D4F", "#C0392B", "#9B59B6", "#1ABC9C", "#95A5A6"];

      let donutCircles = "";
      if (selectedReport.total_spent === 0 || selectedReport.top_categories.length === 0) {
        donutCircles = `<circle cx="50" cy="50" r="35" fill="transparent" stroke="#E2E8F0" stroke-width="12" />`;
      } else {
        let currentOffset = 0;
        donutCircles = selectedReport.top_categories.map((cat, idx) => {
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
          <text x="50" y="55" text-anchor="middle" font-size="9" font-weight="900" fill="#1B2A4A" font-family="Inter, sans-serif">${selectedReport.total_spent.toLocaleString()}</text>
          <g transform="translate(46.7, 60) scale(0.08)">
            ${riyalSvgPath.replace(/fill="[^"]*"/g, "").replace(/currentColor/g, "#7C6FD4")}
          </g>
        </svg>
      `;

      const categoriesListHtml = selectedReport.top_categories.map((cat, idx) => {
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

      const insightsHtml = selectedReport.insights.filter((ins: string) => !ins.includes("قرار تمويلي رسمي") && !ins.includes("financing decision")).map((insight: string) => {
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

      const spentPct = selectedReport.total_income > 0 ? Math.round((selectedReport.total_spent / selectedReport.total_income) * 100) : 0;

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
                  +${selectedReport.total_income.toLocaleString()} <span style="font-size: 11px;">${riyalSvg}</span>
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
                  -${selectedReport.total_spent.toLocaleString()} <span style="font-size: 11px;">${riyalSvg}</span>
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
      pdf.save(`Ma3ak_Report_${selectedReport.title.replace(/\s+/g, "_")}.pdf`);
      
      setToastMessage(isRtl ? "تم تحميل التقرير كـ PDF ✓" : "PDF downloaded successfully ✓");
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(isRtl ? "عذراً، فشل تصدير التقرير كـ PDF" : "Sorry, PDF export failed");
    }
  };

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
              aria-label={isRtl ? "اطلب تقريراً الآن" : "Generate One Now"}
              className="px-6 py-2.5 bg-brand-navy text-white rounded-xl text-[10px] font-black shadow-md hover:bg-brand-navy/95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
            >
              {isRtl ? "اطلب تقريراً الآن" : "Generate One Now"}
            </motion.button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReports.map((report) => (
              <motion.div
                key={report.id}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedReport(report)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-brand-navy/5 flex items-center justify-between cursor-pointer transition-all duration-200 hover:border-brand-purple/20 hover:shadow-md"
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
                      -{report.total_spent.toLocaleString()} <RiyalSymbol size="1.05em" />
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
              className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-md max-h-[85vh] md:max-h-[90vh] overflow-y-auto p-6 relative border border-brand-navy/5 shadow-2xl space-y-5 text-right"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-1 border-b border-brand-navy/5">
                <button
                  onClick={() => setSelectedReport(null)}
                  aria-label={isRtl ? "إغلاق" : "Close"}
                  className="p-2 rounded-full bg-brand-cream/50 text-brand-navy/60 hover:bg-brand-cream hover:text-brand-navy transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-brand-purple">
                  <Award className="w-5 h-5 text-brand-orange animate-bounce-slow" />
                  <h3 className="text-base font-black text-brand-navy">
                    {selectedReport.title}
                  </h3>
                </div>
              </div>

              {/* Saved Date */}
              <span className="text-[9px] font-bold text-brand-navy/40 block bg-brand-cream/15 px-3.5 py-2 rounded-xl border border-brand-navy/5">
                {t("savedOn")}: {new Date(selectedReport.saved_at).toLocaleString()}
              </span>

              {/* Total Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-gradient-to-br from-[#EBF7EE]/60 to-[#EBF7EE]/15 p-3.5 rounded-2xl border border-brand-success/15 shadow-[0_2px_8px_rgba(46,125,79,0.01)] text-right">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {t("totalIncome")}
                  </span>
                  <span className="text-xs font-black text-brand-success block mt-0.5">
                    +{selectedReport.total_income.toLocaleString()} <RiyalSymbol size="1.05em" />
                  </span>
                </div>

                <div className="bg-gradient-to-br from-[#FCECEB]/60 to-[#FCECEB]/15 p-3.5 rounded-2xl border border-brand-danger/15 shadow-[0_2px_8px_rgba(192,57,43,0.01)] text-right">
                  <span className="text-[8px] font-bold text-brand-navy/40 block uppercase tracking-wide">
                    {t("totalSpent")}
                  </span>
                  <span className="text-xs font-black text-brand-danger block mt-0.5">
                    -{selectedReport.total_spent.toLocaleString()} <RiyalSymbol size="1.05em" />
                  </span>
                </div>
              </div>

              {/* Recharts PieChart Category Breakdown */}
              {mounted && selectedReport.top_categories.length > 0 && (
                <div id="chart-container-history" className="h-44 w-full bg-brand-cream/10 rounded-2xl border border-brand-navy/5 p-2 flex items-center justify-center">
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
                      <Legend formatter={(value) => <span className="text-[11px] font-black text-brand-navy/80">{value}</span>} layout="vertical" align="right" verticalAlign="middle" iconSize={8} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Category Breakdown list with progress bars */}
              <div className="space-y-3 pt-1">
                <span className="text-[9px] font-black text-brand-navy/45 uppercase tracking-wider block">
                  {t("topCategories")}
                </span>
                {selectedReport.top_categories.map((cat, idx) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-brand-navy/80">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        {cat.category}
                      </span>
                      <span>
                        {cat.amount.toLocaleString()} <RiyalSymbol size="1.05em" /> ({cat.percentage}%)
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

              {/* Dynamic Saved Insights */}
              <div className="bg-gradient-to-br from-brand-orange/10 to-brand-orange/5 border border-brand-orange/20 rounded-2xl p-4.5 space-y-2.5 shadow-[0_2px_12px_rgba(212,117,75,0.02)]">
                <div className="flex items-center gap-1.5 text-brand-orange font-black text-[10px]">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>{t("insightsTitle")}</span>
                </div>
                <ul className="list-inside text-[9.5px] font-bold text-brand-navy/70 space-y-1.5 leading-relaxed text-right">
                  {selectedReport.insights.map((insight, idx) => (
                    <li key={idx} className="relative pr-3">
                      <span className="absolute right-0 text-brand-orange">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <button 
                onClick={handleSharePDF}
                aria-label={isRtl ? "تصدير التقرير كـ PDF" : "Export Report as PDF"}
                className="w-full py-3.5 rounded-2xl bg-brand-navy text-white text-xs font-black shadow-md hover:bg-brand-navy/90 transition-all duration-200 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
              >
                <Share2 className="w-4 h-4" />
                <span>{isRtl ? "تصدير التقرير كـ PDF" : "Export Report as PDF"}</span>
              </button>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab="reports" />
    </div>
  );
}
