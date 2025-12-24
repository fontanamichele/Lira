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
  period: "30d" | "180d" | "ytd" | "1y" | "5y" | "all";
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

    // Calculate the first transaction date (if any)
    let firstTransactionDate: Date | null = null;
    if (transactions.length > 0) {
      const oldestTransactionTime = transactions.reduce((min, t) => {
        const time = new Date(t.date).getTime();
        return isNaN(time) ? min : Math.min(min, time);
      }, new Date().getTime());
      firstTransactionDate = new Date(oldestTransactionTime);
      firstTransactionDate.setHours(0, 0, 0, 0);
    }

    // For "all" period, calculate the actual date range and use a supported period
    let periodToFetch = period;
    let startDate: Date | null = null;
    
    if (period === "all" && firstTransactionDate) {
      startDate = new Date(firstTransactionDate);
      const today = new Date();
      const diffDays = Math.ceil((today.getTime() - firstTransactionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Use the longest supported period that covers the range
      if (diffDays <= 365) {
        periodToFetch = "1y";
      } else if (diffDays <= 365 * 5) {
        periodToFetch = "5y";
      } else {
        // For very long periods, use 5y and we'll handle missing dates
        periodToFetch = "5y";
      }
    } else if (firstTransactionDate) {
      // For other periods, calculate the period start date and adjust if needed
      const today = new Date();
      let periodStartDate = new Date(today);
      
      // Calculate what the start date would be for this period
      if (period === "30d") {
        periodStartDate.setDate(periodStartDate.getDate() - 30);
      } else if (period === "180d") {
        periodStartDate.setDate(periodStartDate.getDate() - 180);
      } else if (period === "ytd") {
        periodStartDate = new Date(today.getFullYear(), 0, 1);
      } else if (period === "1y") {
        periodStartDate.setFullYear(periodStartDate.getFullYear() - 1);
      } else if (period === "5y") {
        periodStartDate.setFullYear(periodStartDate.getFullYear() - 5);
      }
      
      periodStartDate.setHours(0, 0, 0, 0);
      
      // If the period start date is before the first transaction, use first transaction date instead
      if (periodStartDate < firstTransactionDate) {
        startDate = new Date(firstTransactionDate);
      }
    }

    // Fetch historical exchange rates
    const historicalRates = await getHistoricalAssetRates(
      uniqueAssets,
      mainCurrency,
      periodToFetch,
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

    // Generate data points for each day from start date to today
    // If startDate is set (either from "all" period or because period starts before first transaction),
    // generate daily data points. Otherwise, use the timestamps from historical rates.
    let datesToProcess: Date[] = [];
    
    if (startDate) {
      // Generate daily data points from start date to today
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      const currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0); // Start of day
      
      while (currentDate <= today) {
        datesToProcess.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // For other periods without adjustment, use the timestamps from historical rates
      datesToProcess = sortedTimestamps.map(ts => new Date(ts));
    }

    // Helper function to find the closest historical rate for a given date
    const findClosestRates = (targetDate: Date): AssetRates => {
      const targetTime = targetDate.getTime();
      let closestTimestamp: string | null = null;
      let closestDiff = Infinity;

      // Find the closest timestamp (before or at the target date)
      for (const timestamp of sortedTimestamps) {
        const timestampTime = new Date(timestamp).getTime();
        const diff = targetTime - timestampTime;
        
        if (diff >= 0 && diff < closestDiff) {
          closestDiff = diff;
          closestTimestamp = timestamp;
        }
      }

      // If we found a close timestamp, use its rates
      if (closestTimestamp && ratesByTimestamp.has(closestTimestamp)) {
        return ratesByTimestamp.get(closestTimestamp)!;
      }

      // Fallback to current rates if no historical rate found
      return currentRates;
    };

    // Calculate historical portfolio values
    const historicalData: HistoricalDataPoint[] = [];

    for (const date of datesToProcess) {
      const rates = findClosestRates(date);
      const dateString = date.toISOString().split("T")[0];

      // Calculate portfolio value at this point in time
      const portfolioValue = calculatePortfolioValueAtDate(
        accounts,
        transactions,
        rates,
        mainCurrency,
        date
      );

      const dataPoint: HistoricalDataPoint = {
        date: dateString,
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
            date
          );

          const key = `${account.name}_${balance.currency}`;
          dataPoint[key] = assetValue;
        });
      });

      historicalData.push(dataPoint);
    }

    // Remove the first data point if it has a value of 0
    // This prevents showing a day before the first transaction
    if (historicalData.length > 0 && historicalData[0].totalValue === 0) {
      historicalData.shift();
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
    } else if (
      transaction.type === "expense" ||
      transaction.type === "taxation"
    ) {
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

    // Calculate the first transaction date (if any)
    const today = new Date();
    let firstTransactionDate: Date | null = null;
    if (transactions.length > 0) {
      const oldestTransactionTime = transactions.reduce((min, t) => {
        const time = new Date(t.date).getTime();
        return isNaN(time) ? min : Math.min(min, time);
      }, today.getTime());
      firstTransactionDate = new Date(oldestTransactionTime);
      firstTransactionDate.setHours(0, 0, 0, 0);
    }

    // Calculate the start date for the period
    let startDate: Date = new Date(today);
    
    if (period === "30d") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === "180d") {
      startDate.setDate(startDate.getDate() - 180);
    } else if (period === "ytd") {
      startDate = new Date(today.getFullYear(), 0, 1);
    } else if (period === "1y") {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else if (period === "5y") {
      startDate.setFullYear(startDate.getFullYear() - 5);
    } else {
      // "all" – from oldest transaction to today
      if (firstTransactionDate) {
        startDate = new Date(firstTransactionDate);
      } else {
        startDate.setDate(startDate.getDate() - 365);
      }
    }
    
    startDate.setHours(0, 0, 0, 0);

    // If the period start date is before the first transaction, use first transaction date instead
    if (firstTransactionDate && startDate < firstTransactionDate) {
      startDate = new Date(firstTransactionDate);
    }

    // Create data points for the requested period
    const historicalData: HistoricalDataPoint[] = [];

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

    // Generate data points from start date to today
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const dateString = currentDate.toISOString().split("T")[0];

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
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Remove the first data point if it has a value of 0
    // This prevents showing a day before the first transaction
    if (historicalData.length > 0 && historicalData[0].totalValue === 0) {
      historicalData.shift();
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
    } else if (
      transaction.type === "expense" ||
      transaction.type === "taxation"
    ) {
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
