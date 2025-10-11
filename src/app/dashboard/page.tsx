"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import MainLayout from "@/components/layout/MainLayout";
import HistoricalChart from "@/components/HistoricalChart";
import PieChart from "@/components/PieChart";
import {
  TrendingUp,
  TrendingDown,
  CreditCard,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  getAssetRates,
  convertCurrency,
  formatCurrency,
  AssetRates,
  extractAssetsFromBalances,
} from "@/lib/currency";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type AccountBalance = Database["public"]["Tables"]["account_balances"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalances[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [animationsReady, setAnimationsReady] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<AssetRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const supabase = createClient();

  const fetchExchangeRates = useCallback(async () => {
    if (!profile?.main_currency || accounts.length === 0) return;

    setRatesLoading(true);
    try {
      // Extract all unique assets from all account balances
      const allBalances = accounts.flatMap((account) => account.balances);
      const uniqueAssets = extractAssetsFromBalances(allBalances);

      // Only fetch rates for assets that actually have balances
      const rates = await getAssetRates(uniqueAssets, profile.main_currency);
      setExchangeRates(rates);
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
    } finally {
      setRatesLoading(false);
    }
  }, [profile?.main_currency, accounts]);

  // Track parameters to prevent unnecessary refetches
  const [lastRatesParams, setLastRatesParams] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Fetch accounts with balances
      const { data: accountsData } = await supabase
        .from("accounts")
        .select(
          `
            *,
            balances:account_balances(*)
          `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch recent transactions
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(5);

      // Fetch all transactions for historical chart
      const { data: allTransactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      setProfile(profileData);
      setAccounts(accountsData || []);
      setRecentTransactions(transactionsData || []);
      setAllTransactions(allTransactionsData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      // Delay animations to ensure smooth transition
      setTimeout(() => {
        setAnimationsReady(true);
        document.body.classList.add("animations-complete");
      }, 100);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!profile?.main_currency || accounts.length === 0) return;

    // Create a unique key for the current parameters
    const ratesParamsKey = JSON.stringify({
      mainCurrency: profile.main_currency,
      accountsLength: accounts.length,
      assets: accounts
        .flatMap((account) => account.balances)
        .map((b) => b.currency)
        .sort(),
    });

    // Only fetch if parameters have changed
    if (ratesParamsKey !== lastRatesParams) {
      setLastRatesParams(ratesParamsKey);
      fetchExchangeRates();
    }
  }, [profile?.main_currency, accounts, fetchExchangeRates, lastRatesParams]);

  // Calculate total balance converted to main currency
  const calculateTotalBalance = (): number => {
    if (!exchangeRates || !profile?.main_currency) return 0;

    return accounts.reduce((total, account) => {
      return (
        total +
        account.balances.reduce((accountTotal, balance) => {
          const convertedAmount = convertCurrency(
            balance.current_balance,
            balance.currency,
            profile?.main_currency || "USD",
            exchangeRates
          );
          return accountTotal + convertedAmount;
        }, 0)
      );
    }, 0);
  };

  const calculateAccountTotal = (account: AccountWithBalances): number => {
    if (!exchangeRates || !profile?.main_currency) return 0;

    return account.balances.reduce((total, balance) => {
      const convertedAmount = convertCurrency(
        balance.current_balance,
        balance.currency,
        profile?.main_currency || "USD",
        exchangeRates
      );
      return total + convertedAmount;
    }, 0);
  };

  // Calculate total income and expenses converted to main currency for the last month
  const calculateTotalIncome = (): number => {
    if (!exchangeRates || !profile?.main_currency) return 0;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return allTransactions
      .filter((t) => t.type === "income" && new Date(t.date) >= oneMonthAgo)
      .reduce((total, transaction) => {
        const convertedAmount = convertCurrency(
          transaction.amount,
          transaction.currency,
          profile?.main_currency || "USD",
          exchangeRates
        );
        return total + convertedAmount;
      }, 0);
  };

  const calculateTotalExpenses = (): number => {
    if (!exchangeRates || !profile?.main_currency) return 0;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return allTransactions
      .filter((t) => t.type === "expense" && new Date(t.date) >= oneMonthAgo)
      .reduce((total, transaction) => {
        const convertedAmount = convertCurrency(
          transaction.amount,
          transaction.currency,
          profile?.main_currency || "USD",
          exchangeRates
        );
        return total + convertedAmount;
      }, 0);
  };

  // Get main currency for display
  const mainCurrency = profile?.main_currency || "USD";
  const totalBalance = calculateTotalBalance();
  const totalIncome = calculateTotalIncome();
  const totalExpenses = calculateTotalExpenses();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-3">
        {/* Header */}
        <div
          className={`text-center lg:text-left transition-opacity duration-500 ${
            animationsReady ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: animationsReady ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Welcome back{profile?.nickname ? `, ${profile.nickname}` : ""}! 👋
            </h1>
            <p className="text-muted-foreground text-lg">
              Here&apos;s an overview of your financial situation
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            className={`card-elevated p-6 hover:scale-105 transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.1s" : "0s" }}
          >
            <div className="flex items-center">
              <div className="p-3 bg-primary/20 rounded-xl shadow-lg">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Balance
                </p>
                <div className="flex items-center space-x-2 h-8">
                  {ratesLoading ? (
                    <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-8">
                      {formatCurrency(totalBalance, mainCurrency)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`card-elevated p-6 hover:scale-105 transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.2s" : "0s" }}
          >
            <div className="flex items-center">
              <div className="p-3 bg-green-500/20 rounded-xl shadow-lg">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Income (Last Month)
                </p>
                <div className="flex items-center space-x-2 h-8">
                  {ratesLoading ? (
                    <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-8">
                      {formatCurrency(totalIncome, mainCurrency)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`card-elevated p-6 hover:scale-105 transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.3s" : "0s" }}
          >
            <div className="flex items-center">
              <div className="p-3 bg-red-500/20 rounded-xl shadow-lg">
                <TrendingDown className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Expenses (Last Month)
                </p>
                <div className="flex items-center space-x-2 h-8">
                  {ratesLoading ? (
                    <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-8">
                      {formatCurrency(totalExpenses, mainCurrency)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 
          <div className={`card-elevated p-6 hover:scale-105 transition-all duration-300 ${animationsReady ? 'animate-bounce-in' : 'opacity-0'}`} style={{ animationDelay: animationsReady ? '0.4s' : '0s' }}>
            <div className="flex items-center">
              <div className="p-3 bg-blue-500/20 rounded-xl shadow-lg">
                <CreditCard className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Accounts</p>
                <p className="text-2xl font-bold text-foreground">{accounts.length}</p>
              </div>
            </div>
          </div>
           */}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Historical Chart */}
          <div
            className={`lg:col-span-2 transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.4s" : "0s" }}
          >
            {animationsReady &&
              accounts.length > 0 &&
              allTransactions.length > 0 && (
                <HistoricalChart
                  accounts={accounts}
                  transactions={allTransactions}
                  mainCurrency={mainCurrency}
                />
              )}
          </div>

          {/* Asset Distribution Pie Chart */}
          <div
            className={`transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.5s" : "0s" }}
          >
            {animationsReady && accounts.length > 0 && (
              <PieChart
                accounts={accounts}
                exchangeRates={exchangeRates}
                mainCurrency={mainCurrency}
              />
            )}
          </div>
        </div>

        {/* Accounts Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div
            className={`card-elevated p-6 transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.7s" : "0s" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-primary" />
                Your Accounts
              </h2>
              <Link
                href="/accounts"
                className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            {accounts.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No accounts found. Add your first account to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account, index) => (
                  <div
                    key={account.id}
                    className="flex justify-between items-center p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors duration-200 animate-bounce-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {account.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {account.balances.length}{" "}
                        {account.balances.length === 1 ? "asset" : "assets"}
                      </p>
                    </div>
                    <div className="text-right">
                      {ratesLoading ? (
                        <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span className="font-semibold text-foreground">
                          {formatCurrency(
                            calculateAccountTotal(account),
                            mainCurrency
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className={`card-elevated p-6 transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.8s" : "0s" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-primary" />
                Recent Transactions
              </h2>
              <Link
                href="/cashflow"
                className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No recent transactions. Start tracking your expenses and
                  income.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction, index) => (
                  <div
                    key={transaction.id}
                    className="flex justify-between items-center p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors duration-200 animate-bounce-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {transaction.description && transaction.description}
                        {!transaction.description &&
                          transaction.type === "income" &&
                          "Income"}
                        {!transaction.description &&
                          transaction.type === "expense" &&
                          "Expense"}
                        {!transaction.description &&
                          transaction.type === "taxation" &&
                          "Taxation"}
                        {!transaction.description &&
                          transaction.type === "transfer" &&
                          "Transfer"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        transaction.type === "income"
                          ? "text-green-500"
                          : transaction.type === "expense"
                          ? "text-red-500"
                          : transaction.type === "taxation"
                          ? "text-yellow-500"
                          : "text-blue-500"
                      }`}
                    >
                      {transaction.type === "income"
                        ? "+"
                        : transaction.type === "expense" ||
                          transaction.type === "taxation"
                        ? "-"
                        : ""}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
