import { TranslationKeys } from "./en";

export const ar: Record<TranslationKeys, string> = {
  // Common
  appName: "معك",
  tagline: "مستشارك المالي الشخصي، معك دائماً",
  sar: "ريال",
  back: "رجوع",
  save: "حفظ",
  share: "مشاركة",
  cancel: "إلغاء",
  loading: "جاري التحميل...",
  
  // Login Page
  loginWelcome: "مرحباً بك في مصرف الإنماء",
  loginSubtitle: "سجل دخولك للتواصل مع «معك»، مساعدك المالي الذكي",
  emailLabel: "البريد الإلكتروني",
  emailPlaceholder: "demo@alinma.sa",
  passwordLabel: "كلمة المرور",
  passwordPlaceholder: "••••••••",
  loginButton: "تسجيل الدخول",
  loginAsDemo: "الدخول كمستخدم تجريبي",
  invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  
  // Dashboard
  greeting: "مرحباً بك،",
  availableBalance: "الرصيد المتاح",
  thisMonthSpent: "مصروفات هذا الشهر",
  vsLastMonth: "مقارنة بالشهر الماضي",
  quickActions: "عمليات سريعة",
  actionChat: "اسأل معك",
  actionTransfer: "تحويل",
  actionBills: "الفواتير والخدمات",
  actionCards: "بطاقاتي",
  spendingOverview: "نظرة عامة على الصرف",
  recentTransactions: "آخر العمليات",
  viewAll: "عرض الكل",
  
  // Chat Screen
  chatTitle: "المساعد الذكي «معك»",
  chatStatusOnline: "نشط وآمن",
  chatInputPlaceholder: "اسأل معك عن تاريخك المالي، أو تحليل مصروفاتك، أو محاكاة قراراتك...",
  voiceInputTooltip: "إدخال صوتي (العرض فقط)",
  suggestedPrompts: "أسئلة مقترحة",
  chipReport: "تقرير الأسبوع الحالي",
  chipHabits: "كيف صرفي هذا الشهر؟",
  chipSimulate: "محاكاة قرار مالي",
  typingIndicator: "«معك» يقوم بالحساب والتحليل المالي...",
  customReportRange: "تحديد فترة تقرير مخصص",
  generateReport: "إصدار التقرير",
  startDate: "تاريخ البدء",
  endDate: "تاريخ الانتهاء",
  
  // Report Component
  reportCardTitle: "تقرير النشاط المالي",
  totalIncome: "إجمالي الدخل",
  totalSpent: "إجمالي المصروفات",
  netSavings: "صافي الادخار",
  topCategories: "أعلى فئات الصرف",
  largestTransactions: "أكبر العمليات المالية",
  insightsTitle: "توصيات مالية ذكية",
  
  // Simulation Component
  simulationCardTitle: "محاكاة القرار المالي المستقبلية",
  proposedDecision: "القرار المقترح",
  scenarioNow: "السيناريو أ: اتخاذ القرار الآن",
  scenarioWait: "السيناريو ب: الانتظار 6 أشهر",
  scenarioAdjusted: "السيناريو ج: زيادة الدفعة الأولى وتعديل الشروط",
  monthlyImpact: "التأثير الشهري على التدفق النقدي",
  balance12m: "الرصيد المتوقع بعد 12 شهر",
  verdict: "الحكم المالي",
  recommendationTitle: "توصية «معك» النهائية والتحليل",
  viewSimulationChart: "مخطط التوقعات الـ 12 شهراً القادمة",
  
  // Reports History Screen
  reportsHistoryTitle: "التقارير المحفوظة",
  noReportsYet: "لا توجد تقارير محفوظة بعد. اطلب من «معك» إنشاء تقرير وحفظه هنا!",
  period: "الفترة",
  savedOn: "حُفظ في",
  
  // Transactions Screen
  transactionsTitle: "سجل العمليات المالية",
  searchPlaceholder: "ابحث عن تاجر أو وصف العملية...",
  filterCategory: "الفئة",
  filterType: "نوع العملية",
  allTypes: "كل العمليات",
  creditsOnly: "عمليات دخل (دائن)",
  debitsOnly: "عمليات صرف (مدين)",
  noTransactions: "لم يتم العثور على عمليات تطابق معايير البحث.",
  credit: "إيداع",
  debit: "صرف",
  
  // Profile & Settings
  profileTitle: "الملف الشخصي والإعدادات",
  accountInfo: "تفاصيل الحساب المالي",
  fullName: "الاسم الكامل",
  email: "البريد الإلكتروني",
  accountNum: "رقم الحساب",
  preferredLang: "اللغة المفضلة",
  logoutButton: "تسجيل الخروج",
  demoModeNotice: "يعمل في وضع العرض التجريبي المحلي (بيانات محاكاة)",
};
