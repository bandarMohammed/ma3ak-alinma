"use client";

import { 
  DataProvider, 
  User, 
  Account, 
  Transaction, 
  Category, 
  ChatConversation, 
  ChatMessage, 
  FinancialGoal, 
  TransactionFilters 
} from "./types";
import { generateTransactions, SEED_VERSION } from "./seed";

export const CATEGORIES: Category[] = [
  { id: '1', name_ar: 'المطاعم والأغذية', name_en: 'Food & Restaurants', icon: 'Utensils', color: '#E74C3C' },
  { id: '2', name_ar: 'النقل والمواصلات', name_en: 'Transportation', icon: 'Car', color: '#3498DB' },
  { id: '3', name_ar: 'التسوق', name_en: 'Shopping', icon: 'ShoppingBag', color: '#9B59B6' },
  { id: '4', name_ar: 'الفواتير والخدمات', name_en: 'Bills & Utilities', icon: 'FileText', color: '#F1C40F' },
  { id: '5', name_ar: 'الصحة والعافية', name_en: 'Healthcare', icon: 'HeartPulse', color: '#2ECC71' },
  { id: '6', name_ar: 'الترفيه والتسلية', name_en: 'Entertainment', icon: 'Gamepad2', color: '#E67E22' },
  { id: '7', name_ar: 'الراتب', name_en: 'Salary', icon: 'Briefcase', color: '#1ABC9C' },
  { id: '8', name_ar: 'الحوالات والادخار', name_en: 'Transfers', icon: 'ArrowUpDown', color: '#95A5A6' },
];

export class MockDataProvider implements DataProvider {
  constructor() {
    // Automatically seed data if not present in localStorage
    if (typeof window !== "undefined") {
      this.initDatabase();
    }
  }

  private isClient() {
    return typeof window !== "undefined";
  }

  private getStorageItem<T>(key: string, defaultValue: T): T {
    if (!this.isClient()) return defaultValue;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  }

  private setStorageItem<T>(key: string, value: T): void {
    if (!this.isClient()) return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  private initDatabase() {
    if (!this.isClient()) return;

    const userExists = localStorage.getItem("ma3ak_user");
    const seedVersion = localStorage.getItem("ma3ak_seed_version");
    if (!userExists || seedVersion !== String(SEED_VERSION)) {
      this.resetToDefaultSeedData();
    }
  }

  public async resetToDefaultSeedData(): Promise<void> {
    if (!this.isClient()) return;

    // 1. Demo User
    const demoUser: User = {
      id: "demo-user-id",
      email: "demo@alinma.sa",
      full_name: "Ahmed Al-Enazi",
      preferred_language: "ar"
    };
    
    // 2. Demo Account
    const demoAccount: Account = {
      id: "demo-account-id",
      user_id: "demo-user-id",
      account_number: "SA80 0500 0000 1234 5678 9012",
      balance: 12450.75,
      currency: "SAR",
      type: "حساب جاري / Current Account"
    };

    // 3. Financial Goals
    const demoGoals: FinancialGoal[] = [
      {
        id: "goal-1",
        user_id: "demo-user-id",
        name: "خطة الدفعة الأولى للسيارة / Car Down Payment",
        target_amount: 30000,
        current_amount: 14000,
        deadline: "2026-12-31"
      },
      {
        id: "goal-2",
        user_id: "demo-user-id",
        name: "صندوق الطوارئ / Emergency Fund",
        target_amount: 15000,
        current_amount: 8000,
        deadline: "2026-09-30"
      }
    ];

    // 4. Generate the rich 14-month transaction history + resulting balance (deterministic)
    const { transactions: finalTransactions, balance } = generateTransactions(
      "demo-user-id",
      "demo-account-id",
      "demo"
    );
    demoAccount.balance = balance;


    // Save all to localStorage
    this.setStorageItem("ma3ak_user", demoUser);
    this.setStorageItem("ma3ak_accounts", [demoAccount]);
    this.setStorageItem("ma3ak_categories", CATEGORIES);
    this.setStorageItem("ma3ak_goals", demoGoals);
    this.setStorageItem("ma3ak_transactions", finalTransactions);
    
    // Clear chats
    this.setStorageItem("ma3ak_conversations", []);
    this.setStorageItem("ma3ak_messages", {});

    // Record the seed version so existing data auto-refreshes on future bumps
    this.setStorageItem("ma3ak_seed_version", SEED_VERSION);
  }

  // ============================================================================
  // PROVIDER INTERFACE IMPLEMENTATIONS
  // ============================================================================

  public async login(email: string, password: string): Promise<User> {
    await new Promise(r => setTimeout(r, 800)); // Simulate networking
    
    const formattedEmail = email.toLowerCase().trim();
    
    // Get users list registry
    const registry = this.getStorageItem<User[]>("ma3ak_users_registry", []);
    
    // If empty (first load after reset), populate registry with demo user
    if (registry.length === 0) {
      const demoUser = this.getStorageItem<User | null>("ma3ak_user", null);
      if (demoUser) {
        registry.push(demoUser);
        this.setStorageItem("ma3ak_users_registry", registry);
      }
    }

    const existingUser = registry.find(u => u.email === formattedEmail);

    if (existingUser) {
      this.setStorageItem("ma3ak_session", existingUser);
      return existingUser;
    }

    // DYNAMIC ON-THE-FLY SIGNUP & SEEDING!
    const newUserId = `user-${Date.now()}`;
    const newAccountId = `account-${Date.now()}`;

    const namePart = formattedEmail.split("@")[0] || "customer";
    const nameParts = namePart.split(".");
    const fullName = nameParts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const newUser: User = {
      id: newUserId,
      email: formattedEmail,
      full_name: fullName,
      preferred_language: "ar"
    };

    const newAccount: Account = {
      id: newAccountId,
      user_id: newUserId,
      account_number: `SA80 0500 0000 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
      balance: 12450.75,
      currency: "SAR",
      type: "حساب جاري / Current Account"
    };

    const newGoals: FinancialGoal[] = [
      {
        id: `goal-${newUserId}-1`,
        user_id: newUserId,
        name: "خطة الدفعة الأولى للسيارة / Car Down Payment",
        target_amount: 30000,
        current_amount: 14000,
        deadline: "2026-12-31"
      },
      {
        id: `goal-${newUserId}-2`,
        user_id: newUserId,
        name: "صندوق الطوارئ / Emergency Fund",
        target_amount: 15000,
        current_amount: 8000,
        deadline: "2026-09-30"
      }
    ];

    // Seed transactions for this new user (deterministic per user id)
    const { transactions: finalTransactions, balance } = generateTransactions(newUserId, newAccountId, newUserId);
    newAccount.balance = balance;


    // Save records to DB lists
    const globalTxs = this.getStorageItem<Transaction[]>("ma3ak_transactions", []);
    const globalAccs = this.getStorageItem<Account[]>("ma3ak_accounts", []);
    const globalGoals = this.getStorageItem<FinancialGoal[]>("ma3ak_goals", []);

    this.setStorageItem("ma3ak_transactions", [...finalTransactions, ...globalTxs]);
    this.setStorageItem("ma3ak_accounts", [newAccount, ...globalAccs]);
    this.setStorageItem("ma3ak_goals", [...newGoals, ...globalGoals]);

    // Save to registry
    registry.push(newUser);
    this.setStorageItem("ma3ak_users_registry", registry);
    this.setStorageItem("ma3ak_session", newUser);

    return newUser;
  }

  public async logout(): Promise<void> {
    if (this.isClient()) {
      localStorage.removeItem("ma3ak_session");
    }
    return Promise.resolve();
  }

  public async getCurrentUser(): Promise<User | null> {
    const session = this.getStorageItem<User | null>("ma3ak_session", null);
    return Promise.resolve(session);
  }

  public async getAccounts(userId: string): Promise<Account[]> {
    const accounts = this.getStorageItem<Account[]>("ma3ak_accounts", []);
    return Promise.resolve(accounts.filter(a => a.user_id === userId));
  }

  public async updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
    const accounts = this.getStorageItem<Account[]>("ma3ak_accounts", []);
    const updated = accounts.map(acc => {
      if (acc.id === accountId) {
        return { ...acc, balance: Math.round(newBalance * 100) / 100 };
      }
      return acc;
    });
    this.setStorageItem("ma3ak_accounts", updated);
    return Promise.resolve();
  }

  public async getTransactions(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
    let txs = this.getStorageItem<Transaction[]>("ma3ak_transactions", []);
    
    // Filter by user
    txs = txs.filter(t => t.user_id === userId);

    if (filters) {
      if (filters.category) {
        txs = txs.filter(t => t.category === filters.category);
      }
      if (filters.type) {
        txs = txs.filter(t => t.type === filters.type);
      }
      if (filters.startDate) {
        txs = txs.filter(t => t.transaction_date >= filters.startDate!);
      }
      if (filters.endDate) {
        txs = txs.filter(t => t.transaction_date <= filters.endDate!);
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        txs = txs.filter(t => 
          t.merchant.toLowerCase().includes(query) || 
          t.description.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
        );
      }
    }
    return Promise.resolve(txs);
  }

  public async addTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    const txs = this.getStorageItem<Transaction[]>("ma3ak_transactions", []);
    const newTx: Transaction = {
      ...transaction,
      id: `tx-${txs.length + 1}`
    };

    txs.unshift(newTx); // Add at the beginning (newest first)
    this.setStorageItem("ma3ak_transactions", txs);

    // Update the corresponding account balance
    const accounts = this.getStorageItem<Account[]>("ma3ak_accounts", []);
    const updatedAccounts = accounts.map(acc => {
      if (acc.id === transaction.account_id) {
        const diff = transaction.type === "credit" ? transaction.amount : -transaction.amount;
        return { ...acc, balance: Math.round((acc.balance + diff) * 100) / 100 };
      }
      return acc;
    });
    this.setStorageItem("ma3ak_accounts", updatedAccounts);

    return Promise.resolve(newTx);
  }

  public async getCategories(): Promise<Category[]> {
    const cats = this.getStorageItem<Category[]>("ma3ak_categories", CATEGORIES);
    return Promise.resolve(cats);
  }

  public async getConversations(userId: string): Promise<ChatConversation[]> {
    const convs = this.getStorageItem<ChatConversation[]>("ma3ak_conversations", []);
    return Promise.resolve(convs.filter(c => c.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }

  public async createConversation(userId: string, title: string): Promise<ChatConversation> {
    const convs = this.getStorageItem<ChatConversation[]>("ma3ak_conversations", []);
    const newConv: ChatConversation = {
      id: `conv-${convs.length + 1}-${Date.now()}`,
      user_id: userId,
      title,
      created_at: new Date().toISOString()
    };
    convs.push(newConv);
    this.setStorageItem("ma3ak_conversations", convs);
    return Promise.resolve(newConv);
  }

  public async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const msgsMap = this.getStorageItem<Record<string, ChatMessage[]>>("ma3ak_messages", {});
    const msgs = msgsMap[conversationId] || [];
    return Promise.resolve(msgs.sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }

  public async addMessage(message: Omit<ChatMessage, "id" | "created_at">): Promise<ChatMessage> {
    const msgsMap = this.getStorageItem<Record<string, ChatMessage[]>>("ma3ak_messages", {});
    const conversationId = message.conversation_id;
    
    if (!msgsMap[conversationId]) {
      msgsMap[conversationId] = [];
    }

    const newMsg: ChatMessage = {
      ...message,
      id: `msg-${msgsMap[conversationId].length + 1}-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    msgsMap[conversationId].push(newMsg);
    this.setStorageItem("ma3ak_messages", msgsMap);

    return Promise.resolve(newMsg);
  }

  public async getGoals(userId: string): Promise<FinancialGoal[]> {
    const goals = this.getStorageItem<FinancialGoal[]>("ma3ak_goals", []);
    return Promise.resolve(goals.filter(g => g.user_id === userId));
  }

  public async updateGoal(goalId: string, currentAmount: number): Promise<void> {
    const goals = this.getStorageItem<FinancialGoal[]>("ma3ak_goals", []);
    const updated = goals.map(g => {
      if (g.id === goalId) {
        return { ...g, current_amount: Math.round(currentAmount * 100) / 100 };
      }
      return g;
    });
    this.setStorageItem("ma3ak_goals", updated);
    return Promise.resolve();
  }
}
