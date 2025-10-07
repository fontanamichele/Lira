/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { getCurrencies } from "@/lib/assets";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";

const CURRENCIES = getCurrencies();

interface BankAccount {
  id: string;
  name: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState("");
  const [mainCurrency, setMainCurrency] = useState("USD");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    {
      id: "1",
      name: "",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
    };
    getUser();
  }, [router, supabase.auth]);

  const addBankAccount = () => {
    setBankAccounts([
      ...bankAccounts,
      {
        id: Date.now().toString(),
        name: "",
      },
    ]);
  };

  const removeBankAccount = (id: string) => {
    if (bankAccounts.length > 1) {
      setBankAccounts(bankAccounts.filter((account) => account.id !== id));
    }
  };

  const updateBankAccount = (
    id: string,
    field: keyof BankAccount,
    value: string | number
  ) => {
    setBankAccounts(
      bankAccounts.map((account) =>
        account.id === id ? { ...account, [field]: value } : account
      )
    );
  };

  const handleNext = () => {
    if (step === 1 && !nickname.trim()) {
      setError("Please enter a nickname");
      return;
    }
    if (step === 3 && bankAccounts.some((account) => !account.name.trim())) {
      setError("Please fill in all account names");
      return;
    }
    setError("");
    setStep(step + 1);
  };

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // Update profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .update({
          nickname,
          main_currency: mainCurrency,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Create bank accounts
      for (const account of bankAccounts) {
        // Create the account
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: accountError } = await (supabase as any)
          .from("accounts")
          .insert({
            user_id: user.id,
            name: account.name,
          });

        if (accountError) throw accountError;
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during setup";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8 animate-fade-in">
          <div className="mb-6">
            <h1 className="text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
              Lira
            </h1>
            <div className="w-20 h-1 bg-primary mx-auto rounded-full"></div>
          </div>
          <h2 className="text-3xl font-semibold text-foreground mb-2">
            Welcome! Let&apos;s set up your account
          </h2>
          <p className="text-muted-foreground text-lg">Step {step} of 3</p>

          {/* Progress bar */}
          <div className="mt-6 w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="card-elevated p-8 animate-scale-in">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-foreground">
                Personal Information
              </h3>
              <div>
                <label
                  htmlFor="nickname"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Nickname
                </label>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground  bg-background text-foreground"
                  placeholder="How should we call you?"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-foreground">
                Main Currency
              </h3>
              <div>
                <label
                  htmlFor="currency"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Select your main currency
                </label>
                <select
                  id="currency"
                  value={mainCurrency}
                  onChange={(e) => setMainCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm  bg-background text-foreground"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-foreground">
                Accounts
              </h3>
              <p className="text-muted-foreground">
                Add your bank accounts to start tracking your cashflow
              </p>

              {bankAccounts.map((account, index) => (
                <div
                  key={account.id}
                  className="border border-border rounded-lg p-4 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-foreground">
                      Account {index + 1}
                    </h4>
                    {bankAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBankAccount(account.id)}
                        className="text-destructive hover:text-destructive/80 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={account.name}
                      onChange={(e) =>
                        updateBankAccount(account.id, "name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground  bg-background text-foreground"
                      placeholder="e.g., Checking Account, Savings"
                    />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      Account balances will be created automatically when you
                      add income or transfer transactions in the cashflow
                      section.
                    </p>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addBankAccount}
                className="w-full py-2 px-4 border-2 border-dashed border-border rounded-md text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                + Add Another Account
              </button>
            </div>
          )}

          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary px-8 py-3 rounded-lg font-medium"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={loading}
                className="btn-primary px-8 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Setting up...
                  </div>
                ) : (
                  "Complete Setup"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
