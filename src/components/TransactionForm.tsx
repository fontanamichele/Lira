"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ASSETS, AssetCategory } from "@/lib/assets";
import { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type AccountBalance = Database["public"]["Tables"]["account_balances"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

interface TransactionFormProps {
  accounts: AccountWithBalances[];
  editingTransaction?: Transaction | null;
  onSubmit: (formData: {
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
  }) => Promise<void>;
  onCancel: () => void;
}

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Education",
  "Travel",
  "Groceries",
  "Gas",
  "Insurance",
  "Rent/Mortgage",
  "Gift",
  "Other",
];

const TAXATION_CATEGORIES = [
  "Income Tax",
  "Property Tax",
  "Sales Tax",
  "Capital Gains Tax",
  "Corporate Tax",
  "VAT",
  "Social Security",
  "Medicare",
  "State Tax",
  "Local Tax",
  "Estate Tax",
  "Gift Tax",
  "Other Tax",
];

const INCOME_SOURCES = [
  "Salary",
  "Freelance",
  "Investment",
  "Dividend",
  "Rental Income",
  "Business",
  "Bonus",
  "Commission",
  "Interest",
  "Gift",
  "Refund",
  "Other",
];

export default function TransactionForm({
  accounts,
  editingTransaction,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [formData, setFormData] = useState({
    account_id: "",
    account_balance_id: "",
    type: "expense" as "income" | "expense" | "transfer" | "taxation",
    amount: 0,
    currency: "USD",
    description: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    // Transfer-specific fields
    to_account_id: "",
    to_account_balance_id: "",
    to_amount: 0,
    to_currency: "USD",
    // Asset selection fields for income/transfer
    asset_category: "currency" as AssetCategory,
    asset_ticker: "USD",
    to_asset_category: "currency" as AssetCategory,
    to_asset_ticker: "USD",
  });

  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const fetchUserProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile(profileData);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        account_id: editingTransaction.account_id,
        account_balance_id: editingTransaction.account_balance_id,
        type: editingTransaction.type,
        amount: editingTransaction.amount,
        currency: editingTransaction.currency,
        description: editingTransaction.description || "",
        category: editingTransaction.category || "",
        date: editingTransaction.date,
        to_account_id: editingTransaction.to_account_id || "",
        to_account_balance_id: editingTransaction.to_account_balance_id || "",
        to_amount: editingTransaction.to_amount || 0,
        to_currency: editingTransaction.to_currency || "USD",
        // Set asset selection based on currency
        asset_category: "currency" as AssetCategory,
        asset_ticker: editingTransaction.currency,
        to_asset_category: "currency" as AssetCategory,
        to_asset_ticker: editingTransaction.to_currency || "USD",
      });
    }
  }, [editingTransaction]);

  const getSelectedAccount = () => {
    return accounts.find((acc) => acc.id === formData.account_id);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Account validation
    if (!formData.account_id) {
      newErrors.account_id = "Please select an account";
    }

    // Currency/asset validation
    if (formData.type === "expense" || formData.type === "taxation") {
      if (!formData.account_balance_id)
        newErrors.currency = "Please select a currency";
    } else if (formData.type === "income") {
      if (!formData.asset_ticker) newErrors.currency = "Please select an asset";
    } else if (formData.type === "transfer") {
      if (!formData.account_balance_id)
        newErrors.currency = "Please select a source currency";
    }

    // Transfer-specific validation
    if (formData.type === "transfer") {
      if (!formData.to_account_id) {
        newErrors.to_account_id = "Please select a destination account";
      }
      if (!formData.to_asset_ticker) {
        newErrors.to_currency = "Please select a destination asset";
      }
      if (formData.to_amount <= 0) {
        newErrors.to_amount = "Received amount must be greater than 0";
      }
    }

    // Amount validation (real-time validation already handles this, but we check for any existing errors)
    if (errors.amount) {
      newErrors.amount = errors.amount;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAccountChange = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    const newFormData = {
      ...formData,
      account_id: accountId,
      account_balance_id: "",
      currency: "USD",
      amount: 0,
      description: "",
      category: "",
      date: new Date().toISOString().split("T")[0],
      to_account_id: "",
      to_account_balance_id: "",
      to_amount: 0,
      to_currency: "USD",
      asset_category: "currency" as AssetCategory,
      asset_ticker: "USD",
      to_asset_category: "currency" as AssetCategory,
      to_asset_ticker: "USD",
    };

    // Auto-populate with user's base currency if available
    if (account && userProfile?.main_currency) {
      const baseCurrencyBalance = account.balances.find(
        (b) => b.currency === userProfile.main_currency
      );
      if (baseCurrencyBalance) {
        newFormData.account_balance_id = baseCurrencyBalance.id;
        newFormData.currency = baseCurrencyBalance.currency;
        newFormData.asset_ticker = baseCurrencyBalance.currency;
      }
    }

    setFormData(newFormData);

    // Clear all errors when account is selected
    setErrors({});
  };

  const handleToAccountChange = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    const newFormData = {
      ...formData,
      to_account_id: accountId,
      to_account_balance_id: "",
      to_currency: "USD",
      to_amount: 0,
      to_asset_category: "currency" as AssetCategory,
      to_asset_ticker: "USD",
    };

    // Auto-populate with user's base currency if available
    if (account && userProfile?.main_currency) {
      const baseCurrencyBalance = account.balances.find(
        (b) => b.currency === userProfile.main_currency
      );
      if (baseCurrencyBalance) {
        newFormData.to_account_balance_id = baseCurrencyBalance.id;
        newFormData.to_currency = baseCurrencyBalance.currency;
        newFormData.to_asset_ticker = baseCurrencyBalance.currency;
      }
    }

    setFormData(newFormData);

    // Clear transfer-related errors when destination account is selected
    const newErrors = { ...errors };
    delete newErrors.to_account_id;
    setErrors(newErrors);
  };

  const handleToAmountChange = (value: number) => {
    setFormData({ ...formData, to_amount: value });

    // Real-time validation for received amount
    const newErrors = { ...errors };

    if (value <= 0) {
      newErrors.to_amount = "Received amount must be greater than 0";
    } else {
      delete newErrors.to_amount;
    }

    setErrors(newErrors);
  };

  const handleAssetCategoryChange = (category: AssetCategory) => {
    const newFormData = {
      ...formData,
      asset_category: category,
      asset_ticker: ASSETS[category][0]?.ticker || "",
      currency: ASSETS[category][0]?.ticker || "",
    };
    setFormData(newFormData);

    // Clear currency error when asset is selected
    if (errors.currency) {
      setErrors((prev) => ({ ...prev, currency: "" }));
    }
  };

  const handleAssetTickerChange = (ticker: string) => {
    const newFormData = {
      ...formData,
      asset_ticker: ticker,
      currency: ticker,
    };
    setFormData(newFormData);

    // Clear currency error when asset is selected
    if (errors.currency) {
      setErrors((prev) => ({ ...prev, currency: "" }));
    }
  };

  const handleToAssetCategoryChange = (category: AssetCategory) => {
    const newFormData = {
      ...formData,
      to_asset_category: category,
      to_asset_ticker: ASSETS[category][0]?.ticker || "",
      to_currency: ASSETS[category][0]?.ticker || "",
    };
    setFormData(newFormData);

    // Clear currency error when asset is selected
    if (errors.to_currency) {
      setErrors((prev) => ({ ...prev, to_currency: "" }));
    }
  };

  const handleToAssetTickerChange = (ticker: string) => {
    const newFormData = {
      ...formData,
      to_asset_ticker: ticker,
      to_currency: ticker,
    };
    setFormData(newFormData);

    // Clear currency error when asset is selected
    if (errors.to_currency) {
      setErrors((prev) => ({ ...prev, to_currency: "" }));
    }
  };

  const handleCurrencyChange = (accountBalanceId: string, currency: string) => {
    const newFormData = {
      ...formData,
      account_balance_id: accountBalanceId,
      currency: currency,
    };

    setFormData(newFormData);

    // Clear currency error when currency is selected
    if (errors.currency) {
      setErrors((prev) => ({ ...prev, currency: "" }));
    }

    // Re-validate amount since available balance might be different
    // if (newFormData.amount > 0) {
    //   const newErrors = { ...errors }

    //   // Only check balance limit for expense transactions
    //   if (newFormData.type === 'expense') {
    //     const selectedBalance = getSelectedAccount()?.balances.find(b => b.id === accountBalanceId)
    //     if (selectedBalance && newFormData.amount > selectedBalance.current_balance) {
    //       newErrors.amount = `Amount cannot exceed available balance (${selectedBalance.current_balance.toFixed(2)} ${selectedBalance.currency})`
    //     } else {
    //       delete newErrors.amount
    //     }
    //   } else {
    //     // For income transactions, just clear any existing amount error
    //     delete newErrors.amount
    //   }

    //   setErrors(newErrors)
    // }
  };

  const handleAmountChange = (value: number) => {
    setFormData({ ...formData, amount: value });

    // Real-time validation for amount
    const newErrors = { ...errors };

    if (value <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }
    //else {
    // Only check balance limit for expense transactions
    //   if (formData.type === 'expense') {
    //     const selectedBalance = getSelectedBalance()
    //     if (selectedBalance && value > selectedBalance.current_balance) {
    //       newErrors.amount = `Amount cannot exceed available balance (${selectedBalance.current_balance.toFixed(2)} ${selectedBalance.currency})`
    //     } else {
    //       // Clear amount error if validation passes
    //       delete newErrors.amount
    //     }
    //   } else {
    //     // For income transactions, just clear any existing amount error
    //     delete newErrors.amount
    //   }
    // }

    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare form data for submission
      const submitData = {
        ...formData,
        // For income/transfer, use asset_ticker as currency and clear account_balance_id
        currency:
          formData.type === "income"
            ? formData.asset_ticker
            : formData.currency,
        account_balance_id:
          formData.type === "income" ? "" : formData.account_balance_id,
        // For transfer, use to_asset_ticker as to_currency and clear to_account_balance_id
        to_currency:
          formData.type === "transfer"
            ? formData.to_asset_ticker
            : formData.to_currency,
        to_account_balance_id:
          formData.type === "transfer" ? "" : formData.to_account_balance_id,
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAccountSelected = !!formData.account_id;
  const isFormValid =
    isAccountSelected &&
    (formData.type === "expense" || formData.type === "taxation"
      ? !!formData.account_balance_id
      : formData.type === "income"
      ? !!formData.asset_ticker
      : formData.type === "transfer"
      ? !!formData.account_balance_id
      : false) &&
    formData.amount > 0 &&
    !errors.amount &&
    (formData.type !== "transfer" ||
      (formData.to_account_id &&
        !!formData.to_asset_ticker &&
        formData.to_amount > 0 &&
        !errors.to_account_id &&
        !errors.to_currency &&
        !errors.to_amount));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type and Account Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Type
          </label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => {
              const newType = e.target.value as
                | "income"
                | "expense"
                | "transfer"
                | "taxation";
              setFormData({
                ...formData,
                type: newType,
                account_id: "",
                account_balance_id: "",
                currency: "USD",
                amount: 0,
                description: "",
                category: "",
                date: new Date().toISOString().split("T")[0],
                to_account_id: "",
                to_account_balance_id: "",
                to_amount: 0,
                to_currency: "USD",
                asset_category: "currency" as AssetCategory,
                asset_ticker: "USD",
                to_asset_category: "currency" as AssetCategory,
                to_asset_ticker: "USD",
              });
              // Clear all errors when type changes
              setErrors({});
            }}
            className="w-full px-3 py-2 border border-input rounded-md shadow-sm  bg-background text-foreground"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
            <option value="taxation">Taxation</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="account_id"
            className="block text-sm font-medium text-foreground mb-2"
          >
            {formData.type === "transfer" ? "From Account *" : "Account *"}
          </label>
          <select
            id="account_id"
            value={formData.account_id}
            onChange={(e) => handleAccountChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm  bg-background text-foreground ${
              errors.account_id ? "border-red-500" : "border-input"
            }`}
            required
          >
            <option value="">Select an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.balances.length} currencies)
              </option>
            ))}
          </select>
          {errors.account_id && (
            <p className="text-red-500 text-sm mt-1">{errors.account_id}</p>
          )}
        </div>
      </div>

      {/* Conditional Fields - Only show when account is selected */}
      {isAccountSelected && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Amount *
              </label>
              <input
                id="amount"
                type="number"
                step="0.00001"
                min="0"
                value={formData.amount || ""}
                onChange={(e) =>
                  handleAmountChange(parseFloat(e.target.value) || 0)
                }
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  errors.amount ? "border-red-500" : "border-input"
                }`}
                required
              />
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            {formData.type === "expense" ||
            formData.type === "taxation" ||
            formData.type === "transfer" ? (
              <div>
                <label
                  htmlFor="currency"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  {formData.type === "transfer"
                    ? "From Currency *"
                    : "Currency *"}
                </label>
                <select
                  id="currency"
                  value={formData.account_balance_id}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      // Handle "Select a currency" option
                      setFormData({
                        ...formData,
                        account_balance_id: "",
                        currency: "",
                      });
                      // Clear currency error
                      if (errors.currency) {
                        setErrors((prev) => ({ ...prev, currency: "" }));
                      }
                    } else {
                      const selectedBalance =
                        getSelectedAccount()?.balances.find(
                          (b) => b.id === e.target.value
                        );
                      if (selectedBalance) {
                        handleCurrencyChange(
                          selectedBalance.id,
                          selectedBalance.currency
                        );
                      }
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm  bg-background text-foreground ${
                    errors.currency ? "border-red-500" : "border-input"
                  }`}
                  required
                >
                  <option value="">Select a currency</option>
                  {getSelectedAccount()?.balances.map((balance) => (
                    <option key={balance.id} value={balance.id}>
                      {balance.currency} (Balance:{" "}
                      {balance.current_balance.toFixed(2)})
                    </option>
                  ))}
                </select>
                {errors.currency && (
                  <p className="text-red-500 text-sm mt-1">{errors.currency}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="asset_category"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Asset Category *
                  </label>
                  <select
                    id="asset_category"
                    value={formData.asset_category}
                    onChange={(e) =>
                      handleAssetCategoryChange(e.target.value as AssetCategory)
                    }
                    className={`w-full px-3 py-2 border rounded-md shadow-sm  bg-background text-foreground ${
                      errors.currency ? "border-red-500" : "border-input"
                    }`}
                    required
                  >
                    {Object.keys(ASSETS).map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="asset_ticker"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Asset *
                  </label>
                  <select
                    id="asset_ticker"
                    value={formData.asset_ticker}
                    onChange={(e) => handleAssetTickerChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm  bg-background text-foreground ${
                      errors.currency ? "border-red-500" : "border-input"
                    }`}
                    required
                  >
                    <option value="">Select an asset</option>
                    {ASSETS[formData.asset_category].map((asset) => (
                      <option key={asset.ticker} value={asset.ticker}>
                        {asset.ticker} - {asset.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.currency && (
                  <p className="text-red-500 text-sm mt-1 col-span-2">
                    {errors.currency}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Date *
              </label>
              <input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full px-3 py-2 border border-input rounded-md shadow-sm  bg-background text-foreground"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Description
            </label>
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground  bg-background text-foreground"
              placeholder="What was this transaction for?"
            />
          </div>

          {formData.type !== "transfer" && (
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-foreground mb-2"
              >
                {formData.type === "income"
                  ? "Source"
                  : formData.type === "taxation"
                  ? "Tax Type"
                  : "Category"}
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-3 py-2 border border-input rounded-md shadow-sm  bg-background text-foreground"
              >
                <option value="">
                  {formData.type === "income"
                    ? "Select a source"
                    : formData.type === "taxation"
                    ? "Select a tax type"
                    : "Select a category"}
                </option>
                {(formData.type === "income"
                  ? INCOME_SOURCES
                  : formData.type === "taxation"
                  ? TAXATION_CATEGORIES
                  : EXPENSE_CATEGORIES
                ).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Transfer-specific fields */}
          {formData.type === "transfer" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="to_account_id"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    To Account *
                  </label>
                  <select
                    id="to_account_id"
                    value={formData.to_account_id}
                    onChange={(e) => handleToAccountChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm  bg-background text-foreground ${
                      errors.to_account_id ? "border-red-500" : "border-input"
                    }`}
                    required
                  >
                    <option value="">Select destination account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.balances.length} currencies)
                      </option>
                    ))}
                  </select>
                  {errors.to_account_id && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.to_account_id}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="to_asset_category"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      To Asset Category *
                    </label>
                    <select
                      id="to_asset_category"
                      value={formData.to_asset_category}
                      onChange={(e) =>
                        handleToAssetCategoryChange(
                          e.target.value as AssetCategory
                        )
                      }
                      className={`w-full px-3 py-2 border rounded-md shadow-sm  bg-background text-foreground ${
                        errors.to_currency ? "border-red-500" : "border-input"
                      }`}
                      required
                    >
                      {Object.keys(ASSETS).map((category) => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="to_asset_ticker"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      To Asset *
                    </label>
                    <select
                      id="to_asset_ticker"
                      value={formData.to_asset_ticker}
                      onChange={(e) =>
                        handleToAssetTickerChange(e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-md shadow-sm  bg-background text-foreground ${
                        errors.to_currency ? "border-red-500" : "border-input"
                      }`}
                      required
                    >
                      <option value="">Select destination asset</option>
                      {ASSETS[formData.to_asset_category].map((asset) => (
                        <option key={asset.ticker} value={asset.ticker}>
                          {asset.ticker} - {asset.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.to_currency && (
                    <p className="text-red-500 text-sm mt-1 col-span-2">
                      {errors.to_currency}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="to_amount"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Amount Received *
                </label>
                <input
                  id="to_amount"
                  type="number"
                  step="0.00001"
                  min="0"
                  value={formData.to_amount || ""}
                  onChange={(e) =>
                    handleToAmountChange(parseFloat(e.target.value) || 0)
                  }
                  className={`w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    errors.to_amount ? "border-red-500" : "border-input"
                  }`}
                  required
                />
                {errors.to_amount && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.to_amount}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            isFormValid && !isSubmitting
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {isSubmitting
            ? "Processing..."
            : editingTransaction
            ? "Update Transaction"
            : "Add Transaction"}
        </button>
      </div>
    </form>
  );
}
