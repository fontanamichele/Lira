/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import MainLayout from "@/components/layout/MainLayout";
import TransactionForm from "@/components/TransactionForm";
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowRightLeft,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { findAssetCategory } from "@/lib/assets";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type AccountBalance = Database["public"]["Tables"]["account_balances"]["Row"];

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

export default function CashflowPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalances[]>([]);
  const [loading, setLoading] = useState(true);
  const [animationsReady, setAnimationsReady] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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
        .order("name");

      // Fetch transactions
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      setAccounts(accountsData || []);
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
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

  const handleSubmit = async (formData: {
    account_id: string;
    account_balance_id: string;
    type: "income" | "expense" | "transfer";
    amount: number;
    currency: string;
    description?: string | null;
    category?: string | null;
    date: string;
    to_account_id?: string | null;
    to_account_balance_id?: string | null;
    to_amount?: number | null;
    to_currency?: string | null;
  }) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Auto-create missing balances based on transaction type
      let sourceBalanceId = formData.account_balance_id;
      let destBalanceId = formData.to_account_balance_id || null;

      if (formData.type === "income") {
        // Income: auto-create balance for the selected asset
        if (!sourceBalanceId && formData.currency) {
          const sourceCategory = findAssetCategory(formData.currency);
          const { data: upsertSource, error: upsertSourceErr } = await (
            supabase as any
          )
            .from("account_balances")
            .upsert(
              {
                account_id: formData.account_id,
                category: sourceCategory,
                currency: formData.currency,
              },
              { onConflict: "account_id,category,currency" }
            )
            .select()
            .single();
          if (upsertSourceErr) throw upsertSourceErr;
          sourceBalanceId = upsertSource.id;
        }
      }

      if (formData.type === "transfer") {
        // Transfer: auto-create balance for destination asset only
        if (!destBalanceId && formData.to_currency && formData.to_account_id) {
          const destCategory = findAssetCategory(formData.to_currency);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: upsertDest, error: upsertDestErr } = await (
            supabase as any
          )
            .from("account_balances")
            .upsert(
              {
                account_id: formData.to_account_id,
                category: destCategory,
                currency: formData.to_currency,
              },
              { onConflict: "account_id,category,currency" }
            )
            .select()
            .single();
          if (upsertDestErr) throw upsertDestErr;
          destBalanceId = upsertDest.id;
        }
      }

      if (editingTransaction) {
        // Update existing transaction
        const updateData: {
          account_id: string;
          account_balance_id: string;
          type: "income" | "expense" | "transfer";
          amount: number;
          currency: string;
          description?: string | null;
          category?: string | null;
          date: string;
          to_account_id?: string | null;
          to_account_balance_id?: string | null;
          to_amount?: number | null;
          to_currency?: string | null;
        } = {
          account_id: formData.account_id,
          account_balance_id: sourceBalanceId || formData.account_balance_id,
          type: formData.type,
          amount: formData.amount,
          currency: formData.currency,
          description: formData.description || null,
          category: formData.category || null,
          date: formData.date,
        };

        // Add transfer-specific fields if it's a transfer
        if (formData.type === "transfer") {
          updateData.to_account_id = formData.to_account_id;
          updateData.to_account_balance_id =
            destBalanceId || formData.to_account_balance_id;
          updateData.to_amount = formData.to_amount;
          updateData.to_currency = formData.to_currency;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("transactions")
          .update(updateData)
          .eq("id", editingTransaction.id);

        if (error) throw error;
      } else {
        // Create new transaction
        const insertData: {
          user_id: string;
          account_id: string;
          account_balance_id: string;
          type: "income" | "expense" | "transfer";
          amount: number;
          currency: string;
          description?: string | null;
          category?: string | null;
          date: string;
          to_account_id?: string | null;
          to_account_balance_id?: string | null;
          to_amount?: number | null;
          to_currency?: string | null;
        } = {
          user_id: user.id,
          account_id: formData.account_id,
          account_balance_id: sourceBalanceId || formData.account_balance_id,
          type: formData.type,
          amount: formData.amount,
          currency: formData.currency,
          description: formData.description || null,
          category: formData.category || null,
          date: formData.date,
        };

        // Add transfer-specific fields if it's a transfer
        if (formData.type === "transfer") {
          insertData.to_account_id = formData.to_account_id;
          insertData.to_account_balance_id =
            destBalanceId || formData.to_account_balance_id;
          insertData.to_amount = formData.to_amount;
          insertData.to_currency = formData.to_currency;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("transactions")
          .insert(insertData);

        if (error) throw error;
      }

      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving transaction:", error);
      throw error;
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowAddForm(true);
  };

  const handleDelete = async (transactionId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this transaction? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingTransaction(null);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? account.name : "Unknown Account";
  };

  const getToAccountName = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? account.name : "Unknown Account";
  };

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
      <div className="space-y-6">
        {/* Header */}
        <div
          className={`flex justify-between items-center transition-opacity duration-500 ${
            animationsReady ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: animationsReady ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cashflow</h1>
            <p className="text-muted-foreground mt-1">
              Track your income and expenses
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </button>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <TransactionForm
            accounts={accounts}
            editingTransaction={editingTransaction}
            onSubmit={handleSubmit}
            onCancel={resetForm}
          />
        )}

        {/* Transactions List */}
        <div
          className={`bg-card border border-border rounded-lg transition-all duration-300 ${
            animationsReady ? "animate-slide-in-up" : "opacity-0"
          }`}
          style={{ animationDelay: animationsReady ? "0.3s" : "0s" }}
        >
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Transactions
            </h2>
          </div>
          <div className="divide-y divide-border">
            {transactions.map((transaction, index) => (
              <div
                key={transaction.id}
                className={`p-6 hover:bg-muted/50 transition-all duration-300 ${
                  animationsReady ? "animate-slide-in-right" : "opacity-0"
                }`}
                style={{
                  animationDelay: animationsReady ? `${index * 0.05}s` : "0s",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-2 rounded-lg ${
                        transaction.type === "income"
                          ? "bg-green-500/10"
                          : transaction.type === "expense"
                          ? "bg-red-500/10"
                          : "bg-blue-500/10"
                      }`}
                    >
                      {transaction.type === "income" ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : transaction.type === "expense" ? (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      ) : (
                        <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
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
                          transaction.type === "transfer" &&
                          "Transfer"}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        {transaction.type === "transfer" ? (
                          <>
                            <span>
                              {getAccountName(transaction.account_id)} →{" "}
                              {getToAccountName(transaction.to_account_id!)}
                            </span>
                            <span>•</span>
                            <span>
                              {formatCurrency(
                                transaction.amount,
                                transaction.currency
                              )}{" "}
                              →{" "}
                              {formatCurrency(
                                transaction.to_amount!,
                                transaction.to_currency!
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              {getAccountName(transaction.account_id)}
                            </span>
                            {transaction.category && (
                              <>
                                <span>•</span>
                                <span>{transaction.category}</span>
                              </>
                            )}
                          </>
                        )}
                        <span>•</span>
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>
                            {new Date(transaction.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <p
                      className={`font-semibold ${
                        transaction.type === "income"
                          ? "text-green-500"
                          : transaction.type === "expense"
                          ? "text-red-500"
                          : "text-blue-500"
                      }`}
                    >
                      {transaction.type === "transfer"
                        ? `${formatCurrency(
                            transaction.amount,
                            transaction.currency
                          )}`
                        : transaction.type === "income"
                        ? `+${formatCurrency(
                            transaction.amount,
                            transaction.currency
                          )}`
                        : `-${formatCurrency(
                            transaction.amount,
                            transaction.currency
                          )}`}
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(transaction)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No transactions yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Start tracking your income and expenses to see your cashflow
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 mx-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Transaction
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
