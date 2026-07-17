export const en = {
  // Common
  appName: "Ma3ak",
  tagline: "Your personal financial advisor, always with you",
  sar: "SAR",
  back: "Back",
  save: "Save",
  share: "Share",
  cancel: "Cancel",
  loading: "Loading...",
  
  // Login Page
  loginWelcome: "Welcome to Alinma Bank",
  loginSubtitle: "Sign in to connect with Ma3ak, your smart financial companion",
  emailLabel: "Email Address",
  emailPlaceholder: "demo@alinma.sa",
  passwordLabel: "Password",
  passwordPlaceholder: "••••••••",
  loginButton: "Sign In",
  loginAsDemo: "Sign In as Demo User",
  invalidCredentials: "Invalid email or password",
  
  // Dashboard
  greeting: "Welcome,",
  availableBalance: "Available Balance",
  thisMonthSpent: "Spent this month",
  vsLastMonth: "vs last month",
  quickActions: "Quick Actions",
  actionChat: "Ask Ma3ak",
  actionTransfer: "Transfer",
  actionBills: "Bills & Utilities",
  actionCards: "My Cards",
  spendingOverview: "Spending Overview",
  recentTransactions: "Recent Transactions",
  viewAll: "View All",
  
  // Chat Screen
  chatTitle: "Ma3ak AI Companion",
  chatStatusOnline: "Online & Secure",
  chatInputPlaceholder: "Ask Ma3ak about your history, spending or simulations...",
  voiceInputTooltip: "Voice input (UI only)",
  suggestedPrompts: "Suggested Questions",
  chipReport: "Last month's report",
  chipHabits: "How is my spending?",
  chipSimulate: "Simulate a decision",
  typingIndicator: "Ma3ak is calculating...",
  customReportRange: "Custom Report Range",
  generateReport: "Generate Report",
  startDate: "Start Date",
  endDate: "End Date",
  
  // Report Component
  reportCardTitle: "Financial Activity Report",
  totalIncome: "Total Income",
  totalSpent: "Total Spent",
  netSavings: "Net Savings",
  topCategories: "Top Categories",
  largestTransactions: "Largest Transactions",
  insightsTitle: "Smart Financial Insights",
  
  // Simulation Component
  simulationCardTitle: "Financial Decision Simulation",
  proposedDecision: "Proposed Decision",
  scenarioNow: "Scenario A: Do it now",
  scenarioWait: "Scenario B: Wait 6 months",
  scenarioAdjusted: "Scenario C: Increase down payment / terms",
  monthlyImpact: "Monthly Cashflow Impact",
  balance12m: "Projected Balance (12m)",
  verdict: "Verdict",
  recommendationTitle: "Ma3ak's Final Recommendation",
  viewSimulationChart: "12-Month Projection Chart",
  
  // Reports History Screen
  reportsHistoryTitle: "Saved Reports",
  noReportsYet: "No reports saved yet. Ask Ma3ak to generate and save one!",
  period: "Period",
  savedOn: "Saved on",
  
  // Transactions Screen
  transactionsTitle: "Transactions History",
  searchPlaceholder: "Search by merchant or description...",
  filterCategory: "Category",
  filterType: "Type",
  allTypes: "All Types",
  creditsOnly: "Income (Credits)",
  debitsOnly: "Expenses (Debits)",
  noTransactions: "No transactions found matching criteria.",
  credit: "Credit",
  debit: "Debit",
  
  // Profile & Settings
  profileTitle: "Settings & Profile",
  accountInfo: "Account Details",
  fullName: "Full Name",
  email: "Email Address",
  accountNum: "Account Number",
  preferredLang: "Preferred Language",
  logoutButton: "Sign Out",
  demoModeNotice: "Running in Local Demo Mode (Seeded Data)",
};

export type TranslationKeys = keyof typeof en;
