/* eslint-disable @typescript-eslint/no-explicit-any */
import { Database } from "@/types/database";
import {
  getHistoricalAssetRates,
  convertCurrency,
  AssetRates,
} from "@/lib/currency";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type AccountBalance = Database["public"]["Tables"]["account_balances"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

export interface HistoricalDataPoint {
  date: string;
  totalValue: number;
  [key: string]: string | number; // For individual asset values
}

export interface HistoricalCalculationOptions {
  period: "7d" | "30d" | "90d" | "1y";
  interval: "1h" | "4h" | "1d";
  mainCurrency: string;
}

/**
 * Calculate historical portfolio value based on transactions and historical exchange rates
 */
export async function calculateHistoricalHoldings(
  accounts: AccountWithBalances[],
  transactions: Transaction[],
  options: HistoricalCalculationOptions
): Promise<HistoricalDataPoint[]> {
  const { period, interval, mainCurrency } = options;

  // Get all unique assets from current balances
  const allBalances = accounts.flatMap((account) => account.balances);
  const uniqueAssets = [
    ...new Set(allBalances.map((balance) => balance.currency)),
  ];

  if (uniqueAssets.length === 0) {
    return [];
  }

  try {
    // Get current exchange rates first (we'll use these as fallback)
    const { getAssetRates } = await import("@/lib/currency");
    let currentRates: AssetRates = { [mainCurrency]: 1 };
    try {
      currentRates = await getAssetRates(uniqueAssets, mainCurrency);

      // Ensure we have rates for all assets (fallback to 1:1 for missing ones)
      uniqueAssets.forEach((asset) => {
        if (!currentRates[asset]) {
          currentRates[asset] = 1;
        }
      });
    } catch (error) {
      // Create fallback rates for all assets
      uniqueAssets.forEach((asset) => {
        currentRates[asset] = 1;
      });
    }

    // Fetch historical exchange rates
    const historicalRates = await getHistoricalAssetRates(
      uniqueAssets,
      mainCurrency,
      period,
      interval
    );

    // Check if we have enough historical data
    if (historicalRates.length === 0) {
      return createSimpleHistoricalChart(
        accounts,
        transactions,
        mainCurrency,
        period,
        currentRates
      );
    }

    // If we only have one data point (common for currencies), create a simple chart
    if (historicalRates.length === 1) {
      return createSimpleHistoricalChart(
        accounts,
        transactions,
        mainCurrency,
        period,
        currentRates
      );
    }

    // Check if we have enough data points for a meaningful chart
    const uniqueDates = new Set(
      historicalRates.map((rate) => rate.date || rate.timestamp)
    );
    if (uniqueDates.size < 3) {
      return createSimpleHistoricalChart(
        accounts,
        transactions,
        mainCurrency,
        period,
        currentRates
      );
    }

    // Group historical rates by timestamp
    const ratesByTimestamp = new Map<string, AssetRates>();

    historicalRates.forEach((rate) => {
      // Use the date field from the API response
      const dateString = rate.date || rate.timestamp;

      if (!dateString) {
        return;
      }

      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return;
      }

      const timestamp = date.toISOString();

      if (!ratesByTimestamp.has(timestamp)) {
        // Initialize with current rates as fallback
        ratesByTimestamp.set(timestamp, { ...currentRates });
      }

      // Use close price for the rate, fallback to price
      const rateValue = rate.close || rate.price;
      if (rateValue !== undefined) {
        // Extract the actual asset symbol from the ticker
        let assetSymbol = rate.ticker;

        // Handle different ticker formats
        if (rate.ticker.includes("USD=X")) {
          assetSymbol = rate.ticker.replace("USD=X", "");
        } else if (rate.ticker.includes("-USD")) {
          assetSymbol = rate.ticker.replace("-USD", "");
        }

        ratesByTimestamp.get(timestamp)![assetSymbol] = rateValue;
      }
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(ratesByTimestamp.keys()).sort();

    if (sortedTimestamps.length === 0) {
      return [];
    }

    // Calculate historical portfolio values
    const historicalData: HistoricalDataPoint[] = [];

    for (const timestamp of sortedTimestamps) {
      const rates = ratesByTimestamp.get(timestamp)!;
      const date = new Date(timestamp).toISOString().split("T")[0];

      // Calculate portfolio value at this point in time
      const portfolioValue = calculatePortfolioValueAtDate(
        accounts,
        transactions,
        rates,
        mainCurrency,
        new Date(timestamp)
      );

      const dataPoint: HistoricalDataPoint = {
        date,
        totalValue: portfolioValue,
      };

      // Add individual asset values for detailed breakdown
      accounts.forEach((account) => {
        account.balances.forEach((balance) => {
          const assetValue = calculateAssetValueAtDate(
            balance,
            transactions.filter(
              (t) =>
                t.account_balance_id === balance.id ||
                t.to_account_balance_id === balance.id
            ),
            rates,
            mainCurrency,
            new Date(timestamp)
          );

          const key = `${account.name}_${balance.currency}`;
          dataPoint[key] = assetValue;
        });
      });

      historicalData.push(dataPoint);
    }

    return historicalData;
  } catch (error) {
    return [];
  }
}

/**
 * Calculate portfolio value at a specific date
 */
function calculatePortfolioValueAtDate(
  accounts: AccountWithBalances[],
  transactions: Transaction[],
  rates: AssetRates,
  mainCurrency: string,
  targetDate: Date
): number {
  let totalValue = 0;

  accounts.forEach((account) => {
    account.balances.forEach((balance) => {
      const assetValue = calculateAssetValueAtDate(
        balance,
        transactions.filter(
          (t) =>
            t.account_balance_id === balance.id ||
            t.to_account_balance_id === balance.id
        ),
        rates,
        mainCurrency,
        targetDate
      );
      totalValue += assetValue;
    });
  });

  return totalValue;
}

/**
 * Calculate the value of a specific asset at a given date
 */
function calculateAssetValueAtDate(
  currentBalance: AccountBalance,
  assetTransactions: Transaction[],
  rates: AssetRates,
  mainCurrency: string,
  targetDate: Date
): number {
  // Filter transactions up to the target date
  const relevantTransactions = assetTransactions.filter(
    (t) => new Date(t.date) <= targetDate
  );

  // Calculate the balance at the target date
  let balanceAtDate = 0;

  relevantTransactions.forEach((transaction) => {
    if (transaction.type === "income") {
      balanceAtDate += transaction.amount;
    } else if (transaction.type === "expense") {
      balanceAtDate -= transaction.amount;
    } else if (transaction.type === "transfer") {
      // For transfers, we need to check if it's incoming or outgoing
      if (transaction.to_account_balance_id === currentBalance.id) {
        // Incoming transfer - add the amount received in this asset
        balanceAtDate += transaction.to_amount || 0;
      } else if (transaction.account_balance_id === currentBalance.id) {
        // Outgoing transfer - subtract the amount sent from this asset
        balanceAtDate -= transaction.amount;
      }
      // If neither condition is true, this transfer doesn't affect this asset
    }
  });

  // Convert to main currency using historical rates
  try {
    const convertedValue = convertCurrency(
      balanceAtDate,
      currentBalance.currency,
      mainCurrency,
      rates
    );
    return convertedValue;
  } catch (error) {
    // Return the balance as-is if conversion fails
    return balanceAtDate;
  }
}

/**
 * Create a simple historical chart when we don't have enough historical rate data
 * This creates a chart based on transaction history with estimated values
 */
async function createSimpleHistoricalChart(
  accounts: AccountWithBalances[],
  transactions: Transaction[],
  mainCurrency: string,
  period: string,
  currentRates?: AssetRates
): Promise<HistoricalDataPoint[]> {
  try {
    // Use provided current rates or fetch them
    let rates: AssetRates = currentRates || { [mainCurrency]: 1 };

    if (!currentRates) {
      const { getAssetRates, extractAssetsFromBalances } = await import(
        "@/lib/currency"
      );
      const allBalances = accounts.flatMap((account) => account.balances);
      const uniqueAssets = extractAssetsFromBalances(allBalances);

      if (uniqueAssets.length > 0) {
        try {
          rates = await getAssetRates(uniqueAssets, mainCurrency);
        } catch (error) {
          // Use fallback rates
        }
      }
    }

    // Calculate the number of days based on period
    const days =
      period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;

    // Create data points for the requested period
    const historicalData: HistoricalDataPoint[] = [];
    const today = new Date();

    // Group transactions by date
    const transactionsByDate = new Map<string, Transaction[]>();
    transactions.forEach((transaction) => {
      const date = transaction.date;
      if (!transactionsByDate.has(date)) {
        transactionsByDate.set(date, []);
      }
      transactionsByDate.get(date)!.push(transaction);
    });

    // Calculate portfolio value over time by working backwards from current balances
    // This is more accurate than summing transactions forward

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split("T")[0];

      // Calculate what the portfolio value would have been at this date
      let portfolioValue = 0;

      accounts.forEach((account) => {
        account.balances.forEach((balance) => {
          // Calculate the balance at this date by working backwards from current balance
          const balanceAtDate = calculateBalanceAtDate(
            balance,
            transactions.filter(
              (t) =>
                t.account_balance_id === balance.id ||
                t.to_account_balance_id === balance.id
            ),
            new Date(dateString)
          );

          // Convert to main currency using current rates (approximation)
          try {
            const convertedValue = convertCurrency(
              balanceAtDate,
              balance.currency,
              mainCurrency,
              rates
            );
            portfolioValue += convertedValue;
          } catch (error) {
            portfolioValue += balanceAtDate; // Fallback to 1:1
          }
        });
      });

      historicalData.push({
        date: dateString,
        totalValue: portfolioValue,
      });
    }

    return historicalData;
  } catch (error) {
    return [];
  }
}

/**
 * Calculate the balance of a specific asset at a given date
 */
function calculateBalanceAtDate(
  currentBalance: AccountBalance,
  assetTransactions: Transaction[],
  targetDate: Date
): number {
  // Filter transactions up to the target date
  const relevantTransactions = assetTransactions.filter(
    (t) => new Date(t.date) <= targetDate
  );

  // Calculate the balance at the target date
  let balanceAtDate = 0;

  relevantTransactions.forEach((transaction) => {
    if (transaction.type === "income") {
      balanceAtDate += transaction.amount;
    } else if (transaction.type === "expense") {
      balanceAtDate -= transaction.amount;
    } else if (transaction.type === "transfer") {
      // For transfers, we need to check if it's incoming or outgoing
      if (transaction.to_account_balance_id === currentBalance.id) {
        // Incoming transfer - add the amount received in this asset
        balanceAtDate += transaction.to_amount || 0;
      } else if (transaction.account_balance_id === currentBalance.id) {
        // Outgoing transfer - subtract the amount sent from this asset
        balanceAtDate -= transaction.amount;
      }
      // If neither condition is true, this transfer doesn't affect this asset
    }
  });

  return balanceAtDate;
}

/**
 * Calculate current portfolio value using current exchange rates
 */
function calculateCurrentPortfolioValue(
  accounts: AccountWithBalances[],
  rates: AssetRates,
  mainCurrency: string
): number {
  let totalValue = 0;

  accounts.forEach((account) => {
    account.balances.forEach((balance) => {
      try {
        const convertedValue = convertCurrency(
          balance.current_balance,
          balance.currency,
          mainCurrency,
          rates
        );
        totalValue += convertedValue;
      } catch (error) {
        totalValue += balance.current_balance; // Fallback to 1:1
      }
    });
  });

  return totalValue;
}

/**
 * Get default historical calculation options
 */
export function getDefaultHistoricalOptions(): HistoricalCalculationOptions {
  return {
    period: "30d",
    interval: "1d",
    mainCurrency: "USD",
  };
}

/**
 * Format historical data for Recharts
 */
export function formatHistoricalDataForChart(
  data: HistoricalDataPoint[],
  showIndividualAssets: boolean = false
): any[] {
  if (!showIndividualAssets) {
    return data.map((point) => ({
      date: point.date,
      value: point.totalValue,
    }));
  }

  // For individual assets, we need to group by asset
  const assetKeys = Object.keys(data[0] || {}).filter(
    (key) => key !== "date" && key !== "totalValue"
  );

  return data.map((point) => {
    const formatted: any = {
      date: point.date,
      total: point.totalValue,
    };

    assetKeys.forEach((key) => {
      formatted[key] = point[key] || 0;
    });

    return formatted;
  });
}
