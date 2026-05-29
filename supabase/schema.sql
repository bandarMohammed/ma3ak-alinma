-- ============================================================================
-- MA3AK (معك) AI PERSONAL FINANCE COMPANION
-- DATABASE SCHEMA MIGRATIONS (SUPABASE POSTGRESQL)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id VARCHAR(50) PRIMARY KEY,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    icon VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL
);

-- Seed default categories
INSERT INTO public.categories (id, name_ar, name_en, icon, color) VALUES
('1', 'المطاعم والأغذية', 'Food & Restaurants', 'Utensils', '#E74C3C'),
('2', 'النقل والمواصلات', 'Transportation', 'Car', '#3498DB'),
('3', 'التسوق', 'Shopping', 'ShoppingBag', '#9B59B6'),
('4', 'الفواتير والخدمات', 'Bills & Utilities', 'FileText', '#F1C40F'),
('5', 'الصحة والعافية', 'Healthcare', 'HeartPulse', '#2ECC71'),
('6', 'الترفيه والتسلية', 'Entertainment', 'Gamepad2', '#E67E22'),
('7', 'الراتب', 'Salary', 'Briefcase', '#1ABC9C'),
('8', 'الحوالات والادخار', 'Transfers', 'ArrowUpDown', '#95A5A6')
ON CONFLICT (id) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color;

-- 2. Create users profile mapping table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    preferred_language VARCHAR(5) DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS) for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and update their own profiles" ON public.users
    FOR ALL USING (auth.uid() = id);

-- 3. Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_number VARCHAR(100) UNIQUE NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'SAR' NOT NULL,
    type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own accounts" ON public.accounts
    FOR ALL USING (auth.uid() = user_id);

-- 4. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
    category VARCHAR(255) NOT NULL, -- references name_en in categories (e.g. 'Food & Restaurants')
    merchant VARCHAR(255) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own transactions" ON public.transactions
    FOR ALL USING (auth.uid() = user_id);

-- Create index on transaction date and categories for reports scanning optimization
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON public.transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_category ON public.transactions(category);

-- 5. Create chat_conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_conversations
    FOR ALL USING (auth.uid() = user_id);

-- 6. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS for chat messages (joined with chat_conversations to verify ownership)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own chat messages" ON public.chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.chat_conversations c 
            WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
        )
    );

-- 7. Create financial_goals table
CREATE TABLE IF NOT EXISTS public.financial_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
    deadline DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for goals
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own financial targets" ON public.financial_goals
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS TO AUTOMATICALLY CREATE PUBLIC PROFILE ON AUTH SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, preferred_language)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Alinma Customer'),
        COALESCE(new.raw_user_meta_data->>'preferred_language', 'ar')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
