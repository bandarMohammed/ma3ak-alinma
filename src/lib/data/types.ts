export interface User {
  id: string;
  email: string;
  full_name: string;
  preferred_language: 'ar' | 'en';
}

export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  balance: number;
  currency: string;
  type: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string; // matches name_en in Categories (e.g. 'Food & Restaurants')
  merchant: string;
  description: string;
  transaction_date: string; // ISO String YYYY-MM-DD
}

export interface Category {
  id: string;
  name_ar: string;
  name_en: string;
  icon: string; // Lucide icon name
  color: string; // Hex color or Tailwind class
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata?: {
    type?: 'report' | 'simulation' | 'text';
    reportData?: {
      period: string;
      totalSpent: number;
      totalIncome: number;
      topCategories: Array<{ category: string; amount: number; percentage: number }>;
      largestTransactions: Array<Transaction>;
      insights: string[];
    };
    simulationData?: {
      decision: string;
      scenarios: Array<{
        name: string; // Now, Wait 6 Months, Adjusted Terms
        monthly_impact: number;
        balance_in_12m: number;
        verdict: string; // Arabic or English depending on selected language
      }>;
      recommendation: string;
    };
  };
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
}

export interface TransactionFilters {
  category?: string;
  type?: 'credit' | 'debit';
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface DataProvider {
  // Auth
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  
  // Accounts
  getAccounts(userId: string): Promise<Account[]>;
  updateAccountBalance(accountId: string, newBalance: number): Promise<void>;
  
  // Transactions
  getTransactions(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;
  addTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  
  // Chat Conversations
  getConversations(userId: string): Promise<ChatConversation[]>;
  createConversation(userId: string, title: string): Promise<ChatConversation>;
  
  // Chat Messages
  getMessages(conversationId: string): Promise<ChatMessage[]>;
  addMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage>;
  
  // Financial Goals
  getGoals(userId: string): Promise<FinancialGoal[]>;
  updateGoal(goalId: string, currentAmount: number): Promise<void>;
  
  // Database Seeding (Reset)
  resetToDefaultSeedData(): Promise<void>;
}
