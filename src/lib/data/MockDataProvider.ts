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
    if (!userExists) {
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

    // 4. Generate 6 Months of Story-Rich Saudi Transactions
    const transactions: Transaction[] = [];
    const today = new Date("2026-05-29"); // Static current time from prompt
    
    // Generate dates backwards from today for 6 months (approx 180 days)
    let currentBalance = 12450.75; // Goal balance at the end of May

    // Temporary list to build chronologically first, then adjust balances, then sort
    const tempTxList: Omit<Transaction, "id">[] = [];

    // Helper to generate transaction date
    const getDateDaysAgo = (days: number): string => {
      const date = new Date(today);
      date.setDate(today.getDate() - days);
      return date.toISOString().split("T")[0];
    };

    // Build 6 months (180 days) of transactions
    for (let monthIdx = 0; monthIdx < 6; monthIdx++) {
      const daysOffset = monthIdx * 30;
      
      // SALARY: 27th of each month (approx 2, 32, 62, 92, 122, 152 days ago)
      // Since current date is May 29:
      // May salary: May 27 (~2 days ago)
      // Apr salary: Apr 27 (~32 days ago)
      // Mar salary: Mar 27 (~63 days ago)
      // Feb salary: Feb 27 (~91 days ago)
      // Jan salary: Jan 27 (~122 days ago)
      // Dec salary: Dec 27 (~153 days ago)
      let salaryDaysAgo = 0;
      if (monthIdx === 0) salaryDaysAgo = 2; // May 27
      else if (monthIdx === 1) salaryDaysAgo = 32; // Apr 27
      else if (monthIdx === 2) salaryDaysAgo = 63; // Mar 27
      else if (monthIdx === 3) salaryDaysAgo = 91; // Feb 27
      else if (monthIdx === 4) salaryDaysAgo = 122; // Jan 27
      else if (monthIdx === 5) salaryDaysAgo = 153; // Dec 27

      tempTxList.push({
        user_id: "demo-user-id",
        account_id: "demo-account-id",
        amount: 15000,
        type: "credit",
        category: "Salary",
        merchant: "Alinma Bank Payroll",
        description: "شركة الإنماء للتقنية - راتب شهري / Payroll Deposit",
        transaction_date: getDateDaysAgo(salaryDaysAgo)
      });

      // RENT: 1st of each month (approx 28, 58, 89, 118, 149 days ago)
      let rentDaysAgo = 28; // May 1
      if (monthIdx === 1) rentDaysAgo = 58; // Apr 1
      else if (monthIdx === 2) rentDaysAgo = 89; // Mar 1
      else if (monthIdx === 3) rentDaysAgo = 117; // Feb 1
      else if (monthIdx === 4) rentDaysAgo = 148; // Jan 1
      else if (monthIdx === 5) rentDaysAgo = 179; // Dec 1

      tempTxList.push({
        user_id: "demo-user-id",
        account_id: "demo-account-id",
        amount: 2500,
        type: "debit",
        category: "Bills & Utilities",
        merchant: "Emaar Real Estate",
        description: "إعمار العقارية - إيجار الشقة الشهري / Apartment Rent",
        transaction_date: getDateDaysAgo(rentDaysAgo)
      });

      // STC TELECOM: 28th of each month (approx 1, 31, 62, 90, 121, 152 days ago)
      let stcDaysAgo = 1; // May 28
      if (monthIdx === 1) stcDaysAgo = 31; // Apr 28
      else if (monthIdx === 2) stcDaysAgo = 62; // Mar 28
      else if (monthIdx === 3) stcDaysAgo = 90; // Feb 28
      else if (monthIdx === 4) stcDaysAgo = 121; // Jan 28
      else if (monthIdx === 5) stcDaysAgo = 152; // Dec 28

      tempTxList.push({
        user_id: "demo-user-id",
        account_id: "demo-account-id",
        amount: 287.50,
        type: "debit",
        category: "Bills & Utilities",
        merchant: "stc pay",
        description: "إس تي سي - فاتورة الباقة المفوترة / stc Telecom Bill",
        transaction_date: getDateDaysAgo(stcDaysAgo)
      });

      // ELECTRICITY BILL: 5th of each month
      let elecDaysAgo = 24; // May 5
      if (monthIdx === 1) elecDaysAgo = 54; // Apr 5
      else if (monthIdx === 2) elecDaysAgo = 85; // Mar 5
      else if (monthIdx === 3) elecDaysAgo = 113; // Feb 5
      else if (monthIdx === 4) elecDaysAgo = 144; // Jan 5
      else if (monthIdx === 5) elecDaysAgo = 175; // Dec 5

      const elecAmount = Math.round(350 + Math.random() * 150);
      tempTxList.push({
        user_id: "demo-user-id",
        account_id: "demo-account-id",
        amount: elecAmount,
        type: "debit",
        category: "Bills & Utilities",
        merchant: "Saudi Electricity Co.",
        description: "الشركة السعودية للكهرباء - فاتورة كهرباء / Electricity Bill",
        transaction_date: getDateDaysAgo(elecDaysAgo)
      });

      // RECURRING SAVING TRANSFER: 28th of each month (Dec, Jan, Feb = 2000 SAR, March = 500 SAR, April/May = 0 SAR)
      if (monthIdx >= 3) { // 3 means Feb, 4 means Jan, 5 means Dec in terms of backward index
        const saveDaysAgo = monthIdx === 3 ? 90 : monthIdx === 4 ? 121 : 152;
        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount: 2000,
          type: "debit",
          category: "Transfers",
          merchant: "Alinma Savings Pot",
          description: "مصرف الإنماء - تحويل ادخاري شهري / Monthly Saving Transfer",
          transaction_date: getDateDaysAgo(saveDaysAgo)
        });
      } else if (monthIdx === 2) { // March: Jarir impulse buy month -> only saved 500
        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount: 500,
          type: "debit",
          category: "Transfers",
          merchant: "Alinma Savings Pot",
          description: "مصرف الإنماء - تحويل ادخاري شهري تخفيض / Reduced Saving Transfer",
          transaction_date: getDateDaysAgo(62) // Mar 28
        });
      } // monthIdx 0 (May) and 1 (April) have NO savings transfer (saving pattern broke!)

      // HIGH FREQUENCY FOOD DELIVERY OVERSPENDING (Hungerstation / Jahez / Maestro Pizza)
      // Generate food delivery every 2-3 days
      // In April & May (monthIdx 0 & 1), user goes crazy spending 1000+ SAR / month on delivery
      // In Dec, Jan, Feb, Mar, it was normal (approx 350-400 SAR / month)
      const foodDaysInterval = (monthIdx === 0 || monthIdx === 1) ? 2 : 4; 
      const deliveryMerchants = ["Hungerstation", "Jahez", "UberEats", "Maestro Pizza", "KFC", "McDonalds"];
      
      for (let day = 2; day < 30; day += foodDaysInterval) {
        const itemDaysAgo = daysOffset + day;
        if (itemDaysAgo >= 180) continue;
        
        const isDelivery = Math.random() > 0.3;
        const merchant = isDelivery 
          ? deliveryMerchants[Math.floor(Math.random() * 2)] // Hungerstation or Jahez
          : deliveryMerchants[Math.floor(Math.random() * (deliveryMerchants.length - 2) + 2)]; // others

        // April/May delivery amounts are larger (spiking delivery habits)
        const minAmt = (monthIdx === 0 || monthIdx === 1) ? 55 : 35;
        const maxAmt = (monthIdx === 0 || monthIdx === 1) ? 140 : 75;
        const amount = Math.round(minAmt + Math.random() * (maxAmt - minAmt));

        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount,
          type: "debit",
          category: "Food & Restaurants",
          merchant,
          description: merchant === "Hungerstation" 
            ? "هنجرستيشن - توصيل طعام / Hungerstation Food Delivery"
            : merchant === "Jahez" 
            ? "جاهز - طلبات طعام / Jahez Food Delivery"
            : `${merchant} - وجبة سريعة / Fast Food Order`,
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // WEEKLY GROCERIES (Tamimi, Othaim, Panda)
      const groceryMerchants = ["Tamimi Markets", "Othaim Markets", "Panda Supermarket"];
      for (let week = 0; week < 4; week++) {
        const itemDaysAgo = daysOffset + week * 7 + 3;
        if (itemDaysAgo >= 180) continue;

        const merchant = groceryMerchants[week % groceryMerchants.length];
        const amount = Math.round(300 + Math.random() * 250);

        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount,
          type: "debit",
          category: "Food & Restaurants",
          merchant,
          description: merchant === "Tamimi Markets"
            ? "أسواق التميمي - شراء مقاضي / Tamimi Grocery Purchase"
            : merchant === "Othaim Markets"
            ? "أسواق العثيم - أغذية ومستلزمات / Othaim Supermarket"
            : "هايبر بندة - مقاضي العائلة / Panda Family Grocery",
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // TRANSPORTATION (Careem, Uber, Aldrees petrol)
      for (let day = 4; day < 30; day += 5) {
        const itemDaysAgo = daysOffset + day;
        if (itemDaysAgo >= 180) continue;

        // Petrol
        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount: Math.round(60 + Math.random() * 30),
          type: "debit",
          category: "Transportation",
          merchant: "Aldrees Petrol Station",
          description: "محطة الدريس - وقود سيارات / Aldrees Fuel",
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });

        // Careem Ride
        if (Math.random() > 0.4) {
          tempTxList.push({
            user_id: "demo-user-id",
            account_id: "demo-account-id",
            amount: Math.round(25 + Math.random() * 25),
            type: "debit",
            category: "Transportation",
            merchant: "Careem",
            description: "مشوار كريم - خدمة توصيل / Careem Ride",
            transaction_date: getDateDaysAgo(itemDaysAgo + 2)
          });
        }
      }

      // WEEKLY ENTERTAINMENT / COFFEE (% Arabica, Starbucks, VOX Cinemas)
      const entMerchants = ["Starbucks", "% Arabica", "VOX Cinemas", "Riyadh Boulevard"];
      for (let week = 0; week < 4; week++) {
        const itemDaysAgo = daysOffset + week * 7 + 4;
        if (itemDaysAgo >= 180) continue;

        const merchant = entMerchants[week % entMerchants.length];
        const amount = merchant === "Riyadh Boulevard" 
          ? Math.round(150 + Math.random() * 200)
          : merchant === "VOX Cinemas" 
          ? 95
          : Math.round(24 + Math.random() * 22);

        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount,
          type: "debit",
          category: "Entertainment",
          merchant,
          description: merchant.includes("VOX") 
            ? "سينما فوكس - تذاكر عرض ومأكولات / VOX Cinemas Movie & Snacks"
            : merchant.includes("Boulevard")
            ? "بوليفارد الرياض - ترفيه وفعاليات / Riyadh Boulevard Tickets"
            : `${merchant} - قهوة ومشروبات / Speciality Coffee & Bakery`,
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // SHOPPING (Amazon.sa, Noon.com, ZARA)
      for (let shop = 0; shop < 2; shop++) {
        const itemDaysAgo = daysOffset + shop * 15 + 10;
        if (itemDaysAgo >= 180) continue;

        const merchant = shop === 0 ? "Amazon.sa" : "Zara Store";
        const amount = shop === 0 
          ? Math.round(120 + Math.random() * 300)
          : Math.round(250 + Math.random() * 400);

        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount,
          type: "debit",
          category: "Shopping",
          merchant,
          description: shop === 0
            ? "أمازون السعودية - شراء مستلزمات / Amazon.sa Online Purchase"
            : "زارا - ملابس ومستلزمات / ZARA Fashion Clothing",
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // HEALTHCARE (Dallah Hospital, Pharmacy)
      if (monthIdx % 2 === 0) {
        tempTxList.push({
          user_id: "demo-user-id",
          account_id: "demo-account-id",
          amount: Math.round(150 + Math.random() * 350),
          type: "debit",
          category: "Healthcare",
          merchant: "Al-Dawaa Pharmacy",
          description: "صيدلية الدواء - أدوية ومستلزمات صحية / Al-Dawaa Pharmacy Medicals",
          transaction_date: getDateDaysAgo(daysOffset + 12)
        });
      }
    }

    // 5. ONE LARGE IMPULSE PURCHASE (Jarir Bookstore 3,500 SAR, exactly 75 days ago / Mid-March)
    tempTxList.push({
      user_id: "demo-user-id",
      account_id: "demo-account-id",
      amount: 3500,
      type: "debit",
      category: "Shopping",
      merchant: "Jarir Bookstore",
      description: "مكتبة جرير - آيباد برو مع الملحقات / Jarir Bookstore - iPad Pro & Accessories",
      transaction_date: getDateDaysAgo(75) // ~75 days ago (approx Mar 15)
    });

    // 6. Chronologically calculate accounts and transaction balances
    // Sort transactions oldest to newest to calculate historic running balance
    // Oldest is 180 days ago
    tempTxList.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

    // Let's establish starting balance so that after applying all deposits and withdrawals,
    // the ending balance is exactly 12450.75 SAR.
    let netSum = 0;
    tempTxList.forEach(tx => {
      if (tx.type === "credit") netSum += tx.amount;
      else netSum -= tx.amount;
    });

    const startBalance = 12450.75 - netSum;

    // Map to final Transaction object with running IDs
    let runningBalance = startBalance;
    const finalTransactions: Transaction[] = tempTxList.map((tx, idx) => {
      if (tx.type === "credit") runningBalance += tx.amount;
      else runningBalance -= tx.amount;

      return {
        ...tx,
        id: `tx-${idx + 1}`
      };
    });

    // Update account balance
    demoAccount.balance = Math.round(runningBalance * 100) / 100;

    // Reverse transactions so newest are at the top (typical banking UI)
    finalTransactions.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

    // Save all to localStorage
    this.setStorageItem("ma3ak_user", demoUser);
    this.setStorageItem("ma3ak_accounts", [demoAccount]);
    this.setStorageItem("ma3ak_categories", CATEGORIES);
    this.setStorageItem("ma3ak_goals", demoGoals);
    this.setStorageItem("ma3ak_transactions", finalTransactions);
    
    // Clear chats
    this.setStorageItem("ma3ak_conversations", []);
    this.setStorageItem("ma3ak_messages", {});
  }

  // ============================================================================
  // PROVIDER INTERFACE IMPLEMENTATIONS
  // ============================================================================

  private generateSeedTransactions(userId: string, accountId: string): Omit<Transaction, "id">[] {
    const tempTxList: Omit<Transaction, "id">[] = [];
    const today = new Date("2026-05-29");

    const getDateDaysAgo = (days: number): string => {
      const date = new Date(today);
      date.setDate(today.getDate() - days);
      return date.toISOString().split("T")[0];
    };

    // Build 6 months (180 days) of transactions
    for (let monthIdx = 0; monthIdx < 6; monthIdx++) {
      const daysOffset = monthIdx * 30;
      
      // SALARY: 27th of each month
      let salaryDaysAgo = 0;
      if (monthIdx === 0) salaryDaysAgo = 2; // May 27
      else if (monthIdx === 1) salaryDaysAgo = 32; // Apr 27
      else if (monthIdx === 2) salaryDaysAgo = 63; // Mar 27
      else if (monthIdx === 3) salaryDaysAgo = 91; // Feb 27
      else if (monthIdx === 4) salaryDaysAgo = 122; // Jan 27
      else if (monthIdx === 5) salaryDaysAgo = 153; // Dec 27

      tempTxList.push({
        user_id: userId,
        account_id: accountId,
        amount: 15000,
        type: "credit",
        category: "Salary",
        merchant: "Alinma Bank Payroll",
        description: "شركة الإنماء للتقنية - راتب شهري / Payroll Deposit",
        transaction_date: getDateDaysAgo(salaryDaysAgo)
      });

      // RENT: 1st of each month
      let rentDaysAgo = 28; // May 1
      if (monthIdx === 1) rentDaysAgo = 58; // Apr 1
      else if (monthIdx === 2) rentDaysAgo = 89; // Mar 1
      else if (monthIdx === 3) rentDaysAgo = 117; // Feb 1
      else if (monthIdx === 4) rentDaysAgo = 148; // Jan 1
      else if (monthIdx === 5) rentDaysAgo = 179; // Dec 1

      tempTxList.push({
        user_id: userId,
        account_id: accountId,
        amount: 2500,
        type: "debit",
        category: "Bills & Utilities",
        merchant: "Emaar Real Estate",
        description: "إعمار العقارية - إيجار الشقة الشهري / Apartment Rent",
        transaction_date: getDateDaysAgo(rentDaysAgo)
      });

      // STC TELECOM: 28th of each month
      let stcDaysAgo = 1; // May 28
      if (monthIdx === 1) stcDaysAgo = 31; // Apr 28
      else if (monthIdx === 2) stcDaysAgo = 62; // Mar 28
      else if (monthIdx === 3) stcDaysAgo = 90; // Feb 28
      else if (monthIdx === 4) stcDaysAgo = 121; // Jan 28
      else if (monthIdx === 5) stcDaysAgo = 152; // Dec 28

      tempTxList.push({
        user_id: userId,
        account_id: accountId,
        amount: 287.50,
        type: "debit",
        category: "Bills & Utilities",
        merchant: "stc pay",
        description: "إس تي سي - فاتورة الباقة المفوترة / stc Telecom Bill",
        transaction_date: getDateDaysAgo(stcDaysAgo)
      });

      // ELECTRICITY BILL: 5th of each month
      let elecDaysAgo = 24; // May 5
      if (monthIdx === 1) elecDaysAgo = 54; // Apr 5
      else if (monthIdx === 2) elecDaysAgo = 85; // Mar 5
      else if (monthIdx === 3) elecDaysAgo = 113; // Feb 5
      else if (monthIdx === 4) elecDaysAgo = 144; // Jan 5
      else if (monthIdx === 5) elecDaysAgo = 175; // Dec 5

      const elecAmount = Math.round(350 + Math.random() * 150);
      tempTxList.push({
        user_id: userId,
        account_id: accountId,
        amount: elecAmount,
        type: "debit",
        category: "Bills & Utilities",
        merchant: "Saudi Electricity Co.",
        description: "الشركة السعودية للكهرباء - فاتورة كهرباء / Electricity Bill",
        transaction_date: getDateDaysAgo(elecDaysAgo)
      });

      // RECURRING SAVING TRANSFER: 28th of each month
      if (monthIdx >= 3) {
        const saveDaysAgo = monthIdx === 3 ? 90 : monthIdx === 4 ? 121 : 152;
        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount: 2000,
          type: "debit",
          category: "Transfers",
          merchant: "Alinma Savings Pot",
          description: "مصرف الإنماء - تحويل ادخاري شهري / Monthly Saving Transfer",
          transaction_date: getDateDaysAgo(saveDaysAgo)
        });
      } else if (monthIdx === 2) {
        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount: 500,
          type: "debit",
          category: "Transfers",
          merchant: "Alinma Savings Pot",
          description: "مصرف الإنماء - تحويل ادخاري شهري تخفيض / Reduced Saving Transfer",
          transaction_date: getDateDaysAgo(62) // Mar 28
        });
      }

      // HIGH FREQUENCY FOOD DELIVERY OVERSPENDING (Hungerstation / Jahez)
      const foodDaysInterval = (monthIdx === 0 || monthIdx === 1) ? 2 : 4; 
      const deliveryMerchants = ["Hungerstation", "Jahez", "UberEats", "Maestro Pizza", "KFC", "McDonalds"];
      
      for (let day = 2; day < 30; day += foodDaysInterval) {
        const itemDaysAgo = daysOffset + day;
        if (itemDaysAgo >= 180) continue;
        
        const isDelivery = Math.random() > 0.3;
        const merchant = isDelivery 
          ? deliveryMerchants[Math.floor(Math.random() * 2)]
          : deliveryMerchants[Math.floor(Math.random() * (deliveryMerchants.length - 2) + 2)];

        const minAmt = (monthIdx === 0 || monthIdx === 1) ? 55 : 35;
        const maxAmt = (monthIdx === 0 || monthIdx === 1) ? 140 : 75;
        const amount = Math.round(minAmt + Math.random() * (maxAmt - minAmt));

        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount,
          type: "debit",
          category: "Food & Restaurants",
          merchant,
          description: merchant === "Hungerstation" 
            ? "هنجرستيشن - توصيل طعام / Hungerstation Food Delivery"
            : merchant === "Jahez" 
            ? "جاهز - طلبات طعام / Jahez Food Delivery"
            : `${merchant} - وجبة سريعة / Fast Food Order`,
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // WEEKLY GROCERIES
      const groceryMerchants = ["Tamimi Markets", "Othaim Markets", "Panda Supermarket"];
      for (let week = 0; week < 4; week++) {
        const itemDaysAgo = daysOffset + week * 7 + 3;
        if (itemDaysAgo >= 180) continue;

        const merchant = groceryMerchants[week % groceryMerchants.length];
        const amount = Math.round(300 + Math.random() * 250);

        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount,
          type: "debit",
          category: "Food & Restaurants",
          merchant,
          description: merchant === "Tamimi Markets"
            ? "أسواق التميمي - شراء مقاضي / Tamimi Grocery Purchase"
            : merchant === "Othaim Markets"
            ? "أسواق العثيم - أغذية ومستلزمات / Othaim Supermarket"
            : "هايبر بندة - مقاضي العائلة / Panda Family Grocery",
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // TRANSPORTATION
      for (let day = 4; day < 30; day += 5) {
        const itemDaysAgo = daysOffset + day;
        if (itemDaysAgo >= 180) continue;

        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount: Math.round(60 + Math.random() * 30),
          type: "debit",
          category: "Transportation",
          merchant: "Aldrees Petrol Station",
          description: "محطة الدريس - وقود سيارات / Aldrees Fuel",
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });

        if (Math.random() > 0.4) {
          tempTxList.push({
            user_id: userId,
            account_id: accountId,
            amount: Math.round(25 + Math.random() * 25),
            type: "debit",
            category: "Transportation",
            merchant: "Careem",
            description: "مشوار كريم - خدمة توصيل / Careem Ride",
            transaction_date: getDateDaysAgo(itemDaysAgo + 2)
          });
        }
      }

      // WEEKLY ENTERTAINMENT / COFFEE
      const entMerchants = ["Starbucks", "% Arabica", "VOX Cinemas", "Riyadh Boulevard"];
      for (let week = 0; week < 4; week++) {
        const itemDaysAgo = daysOffset + week * 7 + 4;
        if (itemDaysAgo >= 180) continue;

        const merchant = entMerchants[week % entMerchants.length];
        const amount = merchant === "Riyadh Boulevard" 
          ? Math.round(150 + Math.random() * 200)
          : merchant === "VOX Cinemas" 
          ? 95
          : Math.round(24 + Math.random() * 22);

        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount,
          type: "debit",
          category: "Entertainment",
          merchant,
          description: merchant.includes("VOX") 
            ? "سينما فوكس - تذاكر عرض ومأكولات / VOX Cinemas Movie & Snacks"
            : merchant.includes("Boulevard")
            ? "بوليفارد الرياض - ترفيه وفعاليات / Riyadh Boulevard Tickets"
            : `${merchant} - قهوة ومشروبات / Speciality Coffee & Bakery`,
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // SHOPPING
      for (let shop = 0; shop < 2; shop++) {
        const itemDaysAgo = daysOffset + shop * 15 + 10;
        if (itemDaysAgo >= 180) continue;

        const merchant = shop === 0 ? "Amazon.sa" : "Zara Store";
        const amount = shop === 0 
          ? Math.round(120 + Math.random() * 300)
          : Math.round(250 + Math.random() * 400);

        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount,
          type: "debit",
          category: "Shopping",
          merchant,
          description: shop === 0
            ? "أمازون السعودية - شراء مستلزمات / Amazon.sa Online Purchase"
            : "زارا - ملابس ومستلزمات / ZARA Fashion Clothing",
          transaction_date: getDateDaysAgo(itemDaysAgo)
        });
      }

      // HEALTHCARE
      if (monthIdx % 2 === 0) {
        tempTxList.push({
          user_id: userId,
          account_id: accountId,
          amount: Math.round(150 + Math.random() * 350),
          type: "debit",
          category: "Healthcare",
          merchant: "Al-Dawaa Pharmacy",
          description: "صيدلية الدواء - أدوية ومستلزمات صحية / Al-Dawaa Pharmacy Medicals",
          transaction_date: getDateDaysAgo(daysOffset + 12)
        });
      }
    }

    // ONE LARGE IMPULSE PURCHASE (Jarir Bookstore 3,500 SAR, mid-March)
    tempTxList.push({
      user_id: userId,
      account_id: accountId,
      amount: 3500,
      type: "debit",
      category: "Shopping",
      merchant: "Jarir Bookstore",
      description: "مكتبة جرير - آيباد برو مع الملحقات / Jarir Bookstore - iPad Pro & Accessories",
      transaction_date: getDateDaysAgo(75)
    });

    return tempTxList;
  }

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

    // Seed transactions for this new user
    const tempTxList = this.generateSeedTransactions(newUserId, newAccountId);
    tempTxList.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

    let netSum = 0;
    tempTxList.forEach(tx => {
      if (tx.type === "credit") netSum += tx.amount;
      else netSum -= tx.amount;
    });

    const startBalance = 12450.75 - netSum;

    let runningBalance = startBalance;
    const finalTransactions: Transaction[] = tempTxList.map((tx, idx) => {
      if (tx.type === "credit") runningBalance += tx.amount;
      else runningBalance -= tx.amount;

      return {
        ...tx,
        id: `tx-${newUserId}-${idx + 1}`
      };
    });

    newAccount.balance = Math.round(runningBalance * 100) / 100;
    finalTransactions.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

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
