/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import MainLayout from "@/components/layout/MainLayout";
import TransactionForm from "@/components/TransactionForm";
import Modal from "@/components/ui/Modal";
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  FileText,
} from "lucide-react";
import {
  formatCurrency,
  getAssetRates,
  convertCurrency,
  AssetRates,
} from "@/lib/currency";
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
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    type: "" as "" | "income" | "expense" | "transfer" | "taxation",
    accountId: "",
    startDate: "",
    endDate: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    type: "" as "" | "income" | "expense" | "transfer" | "taxation",
    accountId: "",
    startDate: "",
    endDate: "",
  });
  const [userProfile, setUserProfile] = useState<{
    main_currency: string;
  } | null>(null);
  const [exchangeRates, setExchangeRates] = useState<AssetRates | null>(null);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile to get main currency
      const { data: profileData } = await supabase
        .from("profiles")
        .select("main_currency")
        .eq("id", user.id)
        .single();

      setUserProfile(profileData);

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

  const fetchExchangeRates = useCallback(async () => {
    if (!userProfile?.main_currency || transactions.length === 0) return;

    try {
      // Extract all unique currencies from transactions
      const uniqueCurrencies = Array.from(
        new Set([
          ...transactions.map((t) => t.currency),
          ...transactions
            .filter((t) => t.to_currency)
            .map((t) => t.to_currency!),
        ])
      );

      const rates = await getAssetRates(
        uniqueCurrencies,
        userProfile.main_currency
      );
      setExchangeRates(rates);
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
    }
  }, [userProfile?.main_currency, transactions]);

  useEffect(() => {
    if (userProfile?.main_currency) {
      fetchExchangeRates();
    }
  }, [userProfile, fetchExchangeRates]);

  const handleSubmit = async (formData: {
    account_id: string;
    account_balance_id: string;
    type: "income" | "expense" | "transfer" | "taxation";
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
          type: "income" | "expense" | "transfer" | "taxation";
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
          type: "income" | "expense" | "transfer" | "taxation";
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

        const { error } = await (supabase as any)
          .from("transactions")
          .insert(insertData);

        if (error) throw error;
      }

      resetForm();
      setCurrentPage(1); // Reset to first page when adding new transaction
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

      // Reset to first page if current page becomes empty
      const newTotalPages = Math.ceil(
        (transactions.length - 1) / transactionsPerPage
      );
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }

      fetchData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingTransaction(null);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((transaction) => {
    // Filter by type
    if (appliedFilters.type && transaction.type !== appliedFilters.type) {
      return false;
    }

    // Filter by account
    if (
      appliedFilters.accountId &&
      transaction.account_id !== appliedFilters.accountId
    ) {
      return false;
    }

    // Filter by date range
    if (
      appliedFilters.startDate &&
      new Date(transaction.date) < new Date(appliedFilters.startDate)
    ) {
      return false;
    }
    if (
      appliedFilters.endDate &&
      new Date(transaction.date) > new Date(appliedFilters.endDate)
    ) {
      return false;
    }

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(
    filteredTransactions.length / transactionsPerPage
  );
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Filter handlers
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    const emptyFilters = {
      type: "" as "" | "income" | "expense" | "transfer" | "taxation",
      accountId: "",
      startDate: "",
      endDate: "",
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setCurrentPage(1);
  };

  const clearFormFilters = () => {
    const emptyFilters = {
      type: "" as "" | "income" | "expense" | "transfer" | "taxation",
      accountId: "",
      startDate: "",
      endDate: "",
    };
    setFilters(emptyFilters);
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
    setShowFilterModal(false);
  };

  const openFilterModal = () => {
    setFilters(appliedFilters); // Initialize modal with current applied filters
    setShowFilterModal(true);
  };

  const hasActiveFilters =
    appliedFilters.type ||
    appliedFilters.accountId ||
    appliedFilters.startDate ||
    appliedFilters.endDate;

  const getAccountName = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? account.name : "Unknown Account";
  };

  const getToAccountName = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? account.name : "Unknown Account";
  };

  const getConvertedValue = (
    amount: number,
    currency: string
  ): string | null => {
    if (
      !exchangeRates ||
      !userProfile?.main_currency ||
      currency === userProfile.main_currency
    ) {
      return null;
    }

    const convertedAmount = convertCurrency(
      amount,
      currency,
      userProfile.main_currency,
      exchangeRates
    );

    return formatCurrency(convertedAmount, userProfile.main_currency);
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

        {/* Add/Edit Modal */}
        <Modal
          isOpen={showAddForm}
          onClose={resetForm}
          title={
            editingTransaction ? "Edit Transaction" : "Add New Transaction"
          }
          className="max-w-7xl"
        >
          <TransactionForm
            accounts={accounts}
            editingTransaction={editingTransaction}
            onSubmit={handleSubmit}
            onCancel={resetForm}
          />
        </Modal>

        {/* Filter Modal */}
        <Modal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          title="Filter Transactions"
          className="max-w-5xl"
        >
          <div className="space-y-6">
            {/* Transaction Type Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Transaction Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
                <option value="taxation">Taxation</option>
              </select>
            </div>

            {/* Account Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Account
              </label>
              <select
                value={filters.accountId}
                onChange={(e) =>
                  handleFilterChange("accountId", e.target.value)
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-border">
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clearFormFilters}
                className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </Modal>

        {/* Transactions List */}
        <div
          className={`bg-card border border-border rounded-lg transition-all duration-300 ${
            animationsReady ? "animate-bounce-in" : "opacity-0"
          }`}
          style={{ animationDelay: animationsReady ? "0.3s" : "0s" }}
        >
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Recent Transactions
              </h2>
              <div className="flex items-center space-x-3">
                {/* Active Filters Display */}
                {hasActiveFilters && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      Filters:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {appliedFilters.type && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          Type: {appliedFilters.type}
                        </span>
                      )}
                      {appliedFilters.accountId && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          Account: {getAccountName(appliedFilters.accountId)}
                        </span>
                      )}
                      {appliedFilters.startDate && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          From:{" "}
                          {new Date(
                            appliedFilters.startDate
                          ).toLocaleDateString()}
                        </span>
                      )}
                      {appliedFilters.endDate && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          To:{" "}
                          {new Date(
                            appliedFilters.endDate
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </button>
                  </div>
                )}
                <button
                  onClick={openFilterModal}
                  className={`flex items-center px-3 py-2 rounded-md border transition-colors ${
                    hasActiveFilters
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                  {hasActiveFilters && (
                    <span className="ml-2 px-2 py-0.5 bg-primary-foreground/20 text-xs rounded-full">
                      Active
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {currentTransactions.map((transaction, index) => (
              <div
                key={transaction.id}
                className={`p-6 hover:bg-muted/50 transition-all duration-300 ${
                  animationsReady ? "animate-bounce-in" : "opacity-0"
                }`}
                style={{
                  animationDelay: animationsReady
                    ? `${0.3 + index * 0.05}s`
                    : "0s",
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
                          : transaction.type === "taxation"
                          ? "bg-yellow-500/10"
                          : "bg-blue-500/10"
                      }`}
                    >
                      {transaction.type === "income" ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : transaction.type === "expense" ? (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      ) : transaction.type === "taxation" ? (
                        <FileText className="h-5 w-5 text-yellow-500" />
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
                          transaction.type === "taxation" &&
                          "Taxation"}
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
                    <div className="text-right">
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
                        {transaction.type === "transfer"
                          ? `${formatCurrency(
                              transaction.amount,
                              transaction.currency
                            )} → ${formatCurrency(
                              transaction.to_amount!,
                              transaction.to_currency!
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
                      {transaction.type === "transfer"
                        ? // For transfers, show converted values for both currencies
                          (getConvertedValue(
                            transaction.amount,
                            transaction.currency
                          ) ||
                            getConvertedValue(
                              transaction.to_amount!,
                              transaction.to_currency!
                            )) && (
                            <p className="text-xs text-muted-foreground">
                              {getConvertedValue(
                                transaction.amount,
                                transaction.currency
                              ) &&
                                getConvertedValue(
                                  transaction.amount,
                                  transaction.currency
                                )}
                              {getConvertedValue(
                                transaction.amount,
                                transaction.currency
                              ) &&
                                getConvertedValue(
                                  transaction.to_amount!,
                                  transaction.to_currency!
                                ) &&
                                " → "}
                              {getConvertedValue(
                                transaction.to_amount!,
                                transaction.to_currency!
                              ) &&
                                getConvertedValue(
                                  transaction.to_amount!,
                                  transaction.to_currency!
                                )}
                            </p>
                          )
                        : // For other transaction types, show single converted value
                          getConvertedValue(
                            transaction.amount,
                            transaction.currency
                          ) && (
                            <p className="text-xs text-muted-foreground">
                              {getConvertedValue(
                                transaction.amount,
                                transaction.currency
                              )}
                            </p>
                          )}
                    </div>
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

          {/* No Transactions Message */}
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {transactions.length === 0
                  ? "No transactions yet"
                  : "No transactions match your filters"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {transactions.length === 0
                  ? "Start tracking your income and expenses to see your cashflow"
                  : "Try adjusting your filters or clear them to see all transactions"}
              </p>
              <div className="flex justify-center space-x-3">
                {transactions.length > 0 && hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </button>
                )}
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {transactions.length === 0
                    ? "Add Your First Transaction"
                    : "Add Transaction"}
                </button>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredTransactions.length > transactionsPerPage && (
            <div className="p-6 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(endIndex, filteredTransactions.length)} of{" "}
                  {filteredTransactions.length} transactions
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            page === currentPage
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
