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

-- Create account_balances table to store multiple currencies per account
CREATE TABLE IF NOT EXISTS public.account_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  currency TEXT NOT NULL,
  initial_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, currency)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  account_balance_id UUID REFERENCES public.account_balances(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  category TEXT,
  date DATE NOT NULL,
  -- Transfer-specific fields
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_balance_id UUID REFERENCES public.account_balances(id) ON DELETE CASCADE,
  to_amount DECIMAL(15,2),
  to_currency TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
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
    ELSIF NEW.type = 'expense' THEN
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
    ELSIF OLD.type = 'expense' THEN
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
    ELSIF NEW.type = 'expense' THEN
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
    ELSIF OLD.type = 'expense' THEN
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
