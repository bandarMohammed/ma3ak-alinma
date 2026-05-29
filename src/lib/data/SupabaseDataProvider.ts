import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

export class SupabaseDataProvider implements DataProvider {
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-alinma.supabase.co";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key-12345";
    this.supabase = createClient(url, key);
  }

  public async login(email: string, password: string): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("No user found");

    // Fetch extra user details from public.users table
    const { data: profile, error: pError } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (pError || !profile) {
      // Return a basic profile using Auth details
      return {
        id: data.user.id,
        email: data.user.email || email,
        full_name: data.user.user_metadata?.full_name || "Alinma Customer",
        preferred_language: data.user.user_metadata?.preferred_language || "ar"
      };
    }

    return profile as User;
  }

  public async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  public async getCurrentUser(): Promise<User | null> {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error || !session || !session.user) return null;

    const { data: profile } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (!profile) {
      return {
        id: session.user.id,
        email: session.user.email || "",
        full_name: session.user.user_metadata?.full_name || "Alinma Customer",
        preferred_language: session.user.user_metadata?.preferred_language || "ar"
      };
    }

    return profile as User;
  }

  public async getAccounts(userId: string): Promise<Account[]> {
    const { data, error } = await this.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return (data || []) as Account[];
  }

  public async updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
    const { error } = await this.supabase
      .from("accounts")
      .update({ balance: Math.round(newBalance * 100) / 100 })
      .eq("id", accountId);

    if (error) throw error;
  }

  public async getTransactions(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
    let query = this.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    if (filters) {
      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.type) {
        query = query.eq("type", filters.type);
      }
      if (filters.startDate) {
        query = query.gte("transaction_date", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("transaction_date", filters.endDate);
      }
      if (filters.search) {
        query = query.or(`merchant.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Transaction[];
  }

  public async addTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    const { data, error } = await this.supabase
      .from("transactions")
      .insert(transaction)
      .select()
      .single();

    if (error) throw error;

    // Trigger balance update in account
    const accounts = await this.getAccounts(transaction.user_id);
    const targetAcc = accounts.find(a => a.id === transaction.account_id);
    if (targetAcc) {
      const diff = transaction.type === "credit" ? transaction.amount : -transaction.amount;
      await this.updateAccountBalance(transaction.account_id, targetAcc.balance + diff);
    }

    return data as Transaction;
  }

  public async getCategories(): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("*")
      .order("id");

    if (error) throw error;
    return (data || []) as Category[];
  }

  public async getConversations(userId: string): Promise<ChatConversation[]> {
    const { data, error } = await this.supabase
      .from("chat_conversations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ChatConversation[];
  }

  public async createConversation(userId: string, title: string): Promise<ChatConversation> {
    const { data, error } = await this.supabase
      .from("chat_conversations")
      .insert({ user_id: userId, title })
      .select()
      .single();

    if (error) throw error;
    return data as ChatConversation;
  }

  public async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []) as ChatMessage[];
  }

  public async addMessage(message: Omit<ChatMessage, "id" | "created_at">): Promise<ChatMessage> {
    const { data, error } = await this.supabase
      .from("chat_messages")
      .insert(message)
      .select()
      .single();

    if (error) throw error;
    return data as ChatMessage;
  }

  public async getGoals(userId: string): Promise<FinancialGoal[]> {
    const { data, error } = await this.supabase
      .from("financial_goals")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return (data || []) as FinancialGoal[];
  }

  public async updateGoal(goalId: string, currentAmount: number): Promise<void> {
    const { error } = await this.supabase
      .from("financial_goals")
      .update({ current_amount: Math.round(currentAmount * 100) / 100 })
      .eq("id", goalId);

    if (error) throw error;
  }

  public async resetToDefaultSeedData(): Promise<void> {
    // Seeding logic is managed via SQL migrations on the Supabase Dashboard
    // to prevent heavy payload inserts from client browsers during demo runs.
    return Promise.resolve();
  }
}
