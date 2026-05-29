"use client";

import { create } from "zustand";
import { getDataProvider } from "../lib/data/config";
import { 
  User, 
  Account, 
  Transaction, 
  FinancialGoal, 
  ChatConversation, 
  ChatMessage, 
  TransactionFilters 
} from "../lib/data/types";

export interface SavedReport {
  id: string;
  user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  total_spent: number;
  total_income: number;
  top_categories: Array<{ category: string; amount: number; percentage: number }>;
  insights: string[];
  saved_at: string;
}

interface AppState {
  user: User | null;
  accounts: Account[];
  transactions: Transaction[];
  goals: FinancialGoal[];
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  savedReports: SavedReport[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  
  // Auth Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<User | null>;
  
  // Data Fetching Actions
  fetchFinancialData: () => Promise<void>;
  fetchTransactions: (filters?: TransactionFilters) => Promise<void>;
  createTransaction: (tx: Omit<Transaction, "id" | "user_id" | "account_id">) => Promise<void>;
  
  // Chat Actions
  fetchConversations: () => Promise<void>;
  setActiveConversation: (convId: string | null) => Promise<void>;
  startNewConversation: (title: string) => Promise<string>;
  sendChatMessage: (content: string, replyCallback?: (response: ChatMessage) => void) => Promise<void>;
  receiveAssistantResponse: (aiMsg: ChatMessage) => void;
  
  // Reports Actions
  fetchSavedReports: () => Promise<void>;
  saveReport: (report: Omit<SavedReport, "id" | "user_id" | "saved_at">) => Promise<void>;
  
  // Reset Action
  resetData: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  accounts: [],
  transactions: [],
  goals: [],
  conversations: [],
  activeConversationId: null,
  messages: [],
  savedReports: [],
  loading: false,
  actionLoading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const provider = getDataProvider();
      const user = await provider.login(email, password);
      set({ user, loading: false });
      
      // Auto-load data after successful login
      await get().fetchFinancialData();
      await get().fetchConversations();
      await get().fetchSavedReports();
      return true;
    } catch (err: any) {
      set({ error: err.message || "Invalid credentials", loading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      const provider = getDataProvider();
      await provider.logout();
      set({
        user: null,
        accounts: [],
        transactions: [],
        goals: [],
        conversations: [],
        activeConversationId: null,
        messages: [],
        savedReports: [],
        error: null
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  checkSession: async () => {
    set({ loading: true });
    try {
      const provider = getDataProvider();
      const user = await provider.getCurrentUser();
      if (user) {
        set({ user });
        await get().fetchFinancialData();
        await get().fetchConversations();
        await get().fetchSavedReports();
      }
      set({ loading: false });
      return user;
    } catch (err) {
      set({ user: null, loading: false });
      return null;
    }
  },

  fetchFinancialData: async () => {
    const { user } = get();
    if (!user) return;
    
    set({ loading: true });
    try {
      const provider = getDataProvider();
      const accounts = await provider.getAccounts(user.id);
      const transactions = await provider.getTransactions(user.id);
      const goals = await provider.getGoals(user.id);
      set({ accounts, transactions, goals, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchTransactions: async (filters) => {
    const { user } = get();
    if (!user) return;

    try {
      const provider = getDataProvider();
      const transactions = await provider.getTransactions(user.id, filters);
      set({ transactions });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createTransaction: async (tx) => {
    const { user, accounts } = get();
    if (!user || accounts.length === 0) return;

    set({ actionLoading: true });
    try {
      const provider = getDataProvider();
      const accountId = accounts[0].id; // Default to first account
      
      const newTx = await provider.addTransaction({
        ...tx,
        user_id: user.id,
        account_id: accountId
      });

      // Refresh accounts and transactions lists
      const updatedAccounts = await provider.getAccounts(user.id);
      const updatedTxs = await provider.getTransactions(user.id);
      
      set({ 
        accounts: updatedAccounts, 
        transactions: updatedTxs, 
        actionLoading: false 
      });
    } catch (err: any) {
      set({ error: err.message, actionLoading: false });
    }
  },

  fetchConversations: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const provider = getDataProvider();
      const conversations = await provider.getConversations(user.id);
      set({ conversations });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setActiveConversation: async (convId) => {
    set({ activeConversationId: convId, messages: [] });
    if (!convId) return;

    set({ loading: true });
    try {
      const provider = getDataProvider();
      const messages = await provider.getMessages(convId);
      set({ messages, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  startNewConversation: async (title) => {
    const { user } = get();
    if (!user) throw new Error("Not logged in");

    set({ actionLoading: true });
    try {
      const provider = getDataProvider();
      const newConv = await provider.createConversation(user.id, title);
      
      const conversations = await provider.getConversations(user.id);
      set({ 
        conversations, 
        activeConversationId: newConv.id, 
        messages: [],
        actionLoading: false 
      });
      return newConv.id;
    } catch (err: any) {
      set({ error: err.message, actionLoading: false });
      throw err;
    }
  },

  sendChatMessage: async (content, replyCallback) => {
    const { user, activeConversationId } = get();
    if (!user) return;

    let convId = activeConversationId;
    
    // If no active conversation, create one automatically
    if (!convId) {
      const firstWords = content.substring(0, 20) + "...";
      convId = await get().startNewConversation(firstWords);
    }

    const provider = getDataProvider();

    // 1. Add user message
    const userMsg = await provider.addMessage({
      conversation_id: convId,
      role: "user",
      content
    });

    set(state => ({
      messages: [...state.messages, userMsg]
    }));

    // Trigger loading spinner for AI thinking
    set({ actionLoading: true });
  },

  receiveAssistantResponse: (aiMsg: ChatMessage) => {
    set(state => ({
      messages: [...state.messages, aiMsg],
      actionLoading: false
    }));
  },

  fetchSavedReports: async () => {
    const { user } = get();
    if (!user) return;

    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`ma3ak_saved_reports_${user.id}`);
        const savedReports = stored ? JSON.parse(stored) : [];
        set({ savedReports });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveReport: async (report) => {
    const { user } = get();
    if (!user) return;

    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`ma3ak_saved_reports_${user.id}`);
        const savedReports: SavedReport[] = stored ? JSON.parse(stored) : [];
        
        const newReport: SavedReport = {
          ...report,
          id: `report-${Date.now()}`,
          user_id: user.id,
          saved_at: new Date().toISOString()
        };

        savedReports.unshift(newReport);
        localStorage.setItem(`ma3ak_saved_reports_${user.id}`, JSON.stringify(savedReports));
        set({ savedReports });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  resetData: async () => {
    set({ loading: true });
    try {
      const provider = getDataProvider();
      await provider.resetToDefaultSeedData();
      
      const { user } = get();
      if (user) {
        await get().fetchFinancialData();
        await get().fetchConversations();
        await get().fetchSavedReports();
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  }
}));
