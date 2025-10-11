/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import MainLayout from "@/components/layout/MainLayout";
import { Plus, Edit, Trash2, CreditCard, Wallet } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  getAssetRates,
  convertCurrency,
  formatCurrency,
  AssetRates,
  extractAssetsFromBalances,
} from "@/lib/currency";
import { ASSETS, findAssetCategory } from "@/lib/assets";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type AccountBalance = Database["public"]["Tables"]["account_balances"]["Row"];

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

// Helper function to get asset name from ticker
function getAssetName(ticker: string): string {
  const category = findAssetCategory(ticker);
  const asset = ASSETS[category].find(
    (a) => a.ticker.toUpperCase() === ticker.toUpperCase()
  );
  return asset ? asset.name : ticker;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithBalances[]>([]);
  const [loading, setLoading] = useState(true);
  const [animationsReady, setAnimationsReady] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<AccountWithBalances | null>(null);
  const [formData, setFormData] = useState<{ name: string }>({
    name: "",
  });
  const [exchangeRates, setExchangeRates] = useState<AssetRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    main_currency: string;
  } | null>(null);
  const supabase = createClient();

  const fetchAccounts = useCallback(async () => {
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

      const { data, error } = await supabase
        .from("accounts")
        .select(
          `
          *,
          balances:account_balances(*)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
      // Delay animations to ensure smooth transition
      setTimeout(() => {
        setAnimationsReady(true);
        document.body.classList.add("animations-complete");
      }, 100);
    }
  }, [supabase]);

  const fetchExchangeRates = useCallback(async () => {
    if (!userProfile?.main_currency || accounts.length === 0) return;

    setRatesLoading(true);
    try {
      // Extract all unique assets from all account balances
      const allBalances = accounts.flatMap((account) => account.balances);
      const uniqueAssets = extractAssetsFromBalances(allBalances);

      // Only fetch rates for assets that actually have balances
      const rates = await getAssetRates(
        uniqueAssets,
        userProfile.main_currency
      );
      setExchangeRates(rates);
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
    } finally {
      setRatesLoading(false);
    }
  }, [userProfile?.main_currency, accounts]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (userProfile?.main_currency) {
      fetchExchangeRates();
    }
  }, [userProfile, fetchExchangeRates]);

  const calculateAccountTotal = (account: AccountWithBalances): number => {
    if (!exchangeRates || !userProfile?.main_currency) return 0;

    return account.balances.reduce((total, balance) => {
      const convertedAmount = convertCurrency(
        balance.current_balance,
        balance.currency,
        userProfile.main_currency,
        exchangeRates
      );
      return total + convertedAmount;
    }, 0);
  };

  const calculateTotalPortfolioValue = (): number => {
    if (!exchangeRates || !userProfile?.main_currency) return 0;

    return accounts.reduce((total, account) => {
      return total + calculateAccountTotal(account);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (editingAccount) {
        // Update existing account
        const { error } = await (supabase as any)
          .from("accounts")
          .update({ name: formData.name })
          .eq("id", editingAccount.id);

        if (error) throw error;
      } else {
        // Create new account
        const { error: accountError } = await (supabase as any)
          .from("accounts")
          .insert({
            user_id: user.id,
            name: formData.name,
          })
          .select()
          .single();

        if (accountError) throw accountError;
      }

      setFormData({ name: "" });
      setShowAddForm(false);
      setEditingAccount(null);
      fetchAccounts();
    } catch (error) {
      console.error("Error saving account:", error);
    }
  };

  const handleEdit = (account: AccountWithBalances) => {
    setEditingAccount(account);
    setFormData({ name: account.name });
    setShowAddForm(true);
  };

  const handleDelete = async (accountId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this account? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;
      fetchAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const resetForm = () => {
    setFormData({ name: "" });
    setShowAddForm(false);
    setEditingAccount(null);
  };

  // Balance management removed from Accounts page

  // Balance management removed from Accounts page

  // Balance management removed from Accounts page

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
            <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
            <p className="text-muted-foreground mt-1">
              Manage your accounts and track balances
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </button>
        </div>

        {/* Portfolio Summary */}
        {userProfile?.main_currency && accounts.length > 0 && (
          <div
            className={`bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 transition-all duration-300 ${
              animationsReady ? "animate-bounce-in" : "opacity-0"
            }`}
            style={{ animationDelay: animationsReady ? "0.1s" : "0s" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/20 rounded-xl shadow-lg">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Total Portfolio Value
                  </h3>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  {ratesLoading ? (
                    <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-3xl font-bold text-primary">
                      {formatCurrency(
                        calculateTotalPortfolioValue(),
                        userProfile.main_currency
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal
          isOpen={showAddForm}
          onClose={resetForm}
          title={editingAccount ? "Edit Account" : "Add New Account"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Account Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground bg-background text-foreground"
                placeholder="e.g., Checking Account, Savings"
                required
                autoFocus
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.name.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                {editingAccount ? "Update Account" : "Add Account"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Accounts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account, index) => (
            <div
              key={account.id}
              className="bg-card border border-border rounded-lg p-6 animate-bounce-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-foreground">
                      {account.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {account.balances.length}{" "}
                      {account.balances.length === 1 ? "asset" : "assets"}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(account)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="mt-1 space-y-2">
                    {account.balances
                      .filter((balance) => balance.current_balance > 0)
                      .map((balance, index) => {
                        const assetName = getAssetName(balance.currency);
                        const convertedValue =
                          exchangeRates && userProfile?.main_currency
                            ? convertCurrency(
                                balance.current_balance,
                                balance.currency,
                                userProfile.main_currency,
                                exchangeRates
                              )
                            : 0;

                        return (
                          <div
                            key={index}
                            className="flex justify-between items-start"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">
                                {assetName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {balance.currency}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-semibold text-foreground">
                                {formatCurrency(
                                  balance.current_balance,
                                  balance.currency
                                )}
                              </span>
                              {exchangeRates && userProfile?.main_currency && (
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(
                                    convertedValue,
                                    userProfile.main_currency
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Total in user's main currency */}
                {userProfile?.main_currency && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">
                        Total ({userProfile.main_currency})
                      </span>
                      <div className="flex items-center space-x-2">
                        {ratesLoading ? (
                          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="font-bold text-primary">
                            {formatCurrency(
                              calculateAccountTotal(account),
                              userProfile.main_currency
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm text-foreground">
                    {new Date(account.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No accounts yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Add your first bank account to start tracking your cashflow
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 mx-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
