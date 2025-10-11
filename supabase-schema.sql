-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nickname TEXT,
  main_currency TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  -- Category of the asset balance (currency, stock, etf, crypto)
  category TEXT NOT NULL DEFAULT 'currency' CHECK (category IN ('currency', 'stock', 'etf', 'crypto')),
  currency TEXT NOT NULL,
  current_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure only one balance per asset category and symbol per account
  UNIQUE(account_id, category, currency)
);

-- Create user categories table
CREATE TABLE IF NOT EXISTS public.user_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'taxation')),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique category names per user and type
  UNIQUE(user_id, type, name)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  account_balance_id UUID REFERENCES public.account_balances(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'taxation')),
  amount DECIMAL(20,8) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.user_categories(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  -- Transfer-specific fields
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_balance_id UUID REFERENCES public.account_balances(id) ON DELETE CASCADE,
  to_amount DECIMAL(20,8),
  to_currency TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for accounts
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for account_balances
CREATE POLICY "Users can view own account balances" ON public.account_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = account_balances.account_id 
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own account balances" ON public.account_balances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = account_balances.account_id 
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own account balances" ON public.account_balances
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = account_balances.account_id 
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own account balances" ON public.account_balances
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = account_balances.account_id 
      AND accounts.user_id = auth.uid()
    )
  );

-- Create RLS policies for user_categories
CREATE POLICY "Users can view own categories" ON public.user_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.user_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.user_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.user_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, main_currency)
  VALUES (NEW.id, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to initialize default categories for new users
CREATE OR REPLACE FUNCTION public.initialize_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default expense categories
  INSERT INTO public.user_categories (user_id, type, name) VALUES
    (NEW.id, 'expense', 'Food & Dining'),
    (NEW.id, 'expense', 'Transportation'),
    (NEW.id, 'expense', 'Shopping'),
    (NEW.id, 'expense', 'Entertainment'),
    (NEW.id, 'expense', 'Bills & Utilities'),
    (NEW.id, 'expense', 'Healthcare'),
    (NEW.id, 'expense', 'Education'),
    (NEW.id, 'expense', 'Travel'),
    (NEW.id, 'expense', 'Groceries'),
    (NEW.id, 'expense', 'Gas'),
    (NEW.id, 'expense', 'Insurance'),
    (NEW.id, 'expense', 'Rent/Mortgage'),
    (NEW.id, 'expense', 'Gift'),
    (NEW.id, 'expense', 'Other')
  ON CONFLICT (user_id, type, name) DO NOTHING;

  -- Insert default income categories
  INSERT INTO public.user_categories (user_id, type, name) VALUES
    (NEW.id, 'income', 'Salary'),
    (NEW.id, 'income', 'Freelance'),
    (NEW.id, 'income', 'Investment'),
    (NEW.id, 'income', 'Dividend'),
    (NEW.id, 'income', 'Rental Income'),
    (NEW.id, 'income', 'Business'),
    (NEW.id, 'income', 'Bonus'),
    (NEW.id, 'income', 'Commission'),
    (NEW.id, 'income', 'Interest'),
    (NEW.id, 'income', 'Gift'),
    (NEW.id, 'income', 'Refund'),
    (NEW.id, 'income', 'Other')
  ON CONFLICT (user_id, type, name) DO NOTHING;

  -- Insert default taxation categories
  INSERT INTO public.user_categories (user_id, type, name) VALUES
    (NEW.id, 'taxation', 'Income Tax'),
    (NEW.id, 'taxation', 'Property Tax'),
    (NEW.id, 'taxation', 'Sales Tax'),
    (NEW.id, 'taxation', 'Capital Gains Tax'),
    (NEW.id, 'taxation', 'Corporate Tax'),
    (NEW.id, 'taxation', 'VAT'),
    (NEW.id, 'taxation', 'Social Security'),
    (NEW.id, 'taxation', 'Medicare'),
    (NEW.id, 'taxation', 'State Tax'),
    (NEW.id, 'taxation', 'Local Tax'),
    (NEW.id, 'taxation', 'Estate Tax'),
    (NEW.id, 'taxation', 'Gift Tax'),
    (NEW.id, 'taxation', 'Other Tax')
  ON CONFLICT (user_id, type, name) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize default categories
CREATE OR REPLACE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_default_categories();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_account_balances_updated_at
  BEFORE UPDATE ON public.account_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update account balance when transaction is added
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.account_balance_id;
    ELSIF NEW.type = 'expense' OR NEW.type = 'taxation' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.account_balance_id;
    ELSIF NEW.type = 'transfer' THEN
      -- For transfers: subtract from source, add to destination
      UPDATE public.account_balances 
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.account_balance_id;
      
      UPDATE public.account_balances 
      SET current_balance = current_balance + NEW.to_amount
      WHERE id = NEW.to_account_balance_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle update: first reverse the old transaction, then apply the new one
    IF OLD.type = 'income' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.account_balance_id;
    ELSIF OLD.type = 'expense' OR OLD.type = 'taxation' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.account_balance_id;
    ELSIF OLD.type = 'transfer' THEN
      -- Reverse transfer: add back to source, subtract from destination
      UPDATE public.account_balances 
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.account_balance_id;
      
      UPDATE public.account_balances 
      SET current_balance = current_balance - OLD.to_amount
      WHERE id = OLD.to_account_balance_id;
    END IF;
    
    -- Apply new transaction
    IF NEW.type = 'income' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.account_balance_id;
    ELSIF NEW.type = 'expense' OR NEW.type = 'taxation' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.account_balance_id;
    ELSIF NEW.type = 'transfer' THEN
      -- Apply new transfer: subtract from source, add to destination
      UPDATE public.account_balances 
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.account_balance_id;
      
      UPDATE public.account_balances 
      SET current_balance = current_balance + NEW.to_amount
      WHERE id = NEW.to_account_balance_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Handle delete: reverse the transaction
    IF OLD.type = 'income' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.account_balance_id;
    ELSIF OLD.type = 'expense' OR OLD.type = 'taxation' THEN
      UPDATE public.account_balances 
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.account_balance_id;
    ELSIF OLD.type = 'transfer' THEN
      -- Reverse transfer: add back to source, subtract from destination
      UPDATE public.account_balances 
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.account_balance_id;
      
      UPDATE public.account_balances 
      SET current_balance = current_balance - OLD.to_amount
      WHERE id = OLD.to_account_balance_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update account balance
CREATE TRIGGER update_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();
