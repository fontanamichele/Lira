// Asset price conversion utilities using custom API provider
// Configure your API provider domain in environment variables
import {
  getCurrencyCodes,
  ASSETS,
  AssetCategory,
  findAssetCategory,
} from "@/lib/assets";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CURRENCY_API_URL || "https://your-api-provider.com";

export interface ExchangeRates {
  [asset: string]: number;
}

export interface AssetRates {
  [asset: string]: number;
}

export interface CurrencyPriceData {
  ticker: string;
  price: number;
  currency: string;
  timestamp: string;
}

// Cache for asset rates to avoid excessive API calls
let ratesCache: {
  data: AssetRates | null;
  timestamp: number;
  baseCurrency: string;
  requestedAssets: string[];
} = {
  data: null,
  timestamp: 0,
  baseCurrency: "",
  requestedAssets: [],
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// New function to get rates for specific assets that have balances
export async function getAssetRates(
  assetsWithBalances: string[],
  baseCurrency: string = "USD"
): Promise<AssetRates> {
  if (assetsWithBalances.length === 0) {
    return { [baseCurrency]: 1 };
  }

  // Check if we have valid cached data for the same assets
  const now = Date.now();
  const sortedRequestedAssets = [...assetsWithBalances].sort();
  const sortedCachedAssets = [...(ratesCache.requestedAssets || [])].sort();

  if (
    ratesCache.data &&
    ratesCache.baseCurrency === baseCurrency &&
    now - ratesCache.timestamp < CACHE_DURATION &&
    JSON.stringify(sortedRequestedAssets) === JSON.stringify(sortedCachedAssets)
  ) {
    return ratesCache.data;
  }

  try {
    // Group assets by category for different API endpoints
    const assetsByCategory: Record<AssetCategory, string[]> = {
      currency: [],
      stock: [],
      etf: [],
      crypto: [],
    };

    // Categorize assets
    assetsWithBalances.forEach((asset) => {
      const category = findAssetCategory(asset);
      if (category && !assetsByCategory[category].includes(asset)) {
        assetsByCategory[category].push(asset);
      }
    });

    const assetRates: AssetRates = { [baseCurrency]: 1 };

    // Fetch rates for each category
    for (const [category, assets] of Object.entries(assetsByCategory)) {
      if (assets.length === 0) continue;

      const categoryAssets = assets.filter((asset) => asset !== baseCurrency);
      if (categoryAssets.length === 0) continue;

      try {
        const tickers = categoryAssets.map((asset) => {
          switch (category) {
            case "currency":
              return `${asset}USD=X`;
            case "stock":
            case "etf":
              return asset; // Stocks and ETFs use their ticker directly
            case "crypto":
              return `${asset}-USD`; // Crypto pairs
            default:
              return asset;
          }
        });

        const tickerParams = tickers
          .map((ticker) => `tickers=${encodeURIComponent(ticker)}`)
          .join("&");

        const response = await fetch(
          `${API_BASE_URL}/prices/current?${tickerParams}&currency=${baseCurrency}`
        );

        if (!response.ok) {
          console.warn(
            `Failed to fetch rates for ${category}: ${response.status}`
          );
          continue;
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          data.forEach((priceData) => {
            let asset = "";

            // Extract asset from ticker based on category
            switch (category) {
              case "currency":
                asset = priceData.ticker.replace("USD=X", "");
                break;
              case "stock":
              case "etf":
                asset = priceData.ticker;
                break;
              case "crypto":
                asset = priceData.ticker.replace("-USD", "");
                break;
              default:
                asset = priceData.ticker;
            }

            if (asset && asset !== baseCurrency) {
              assetRates[asset] = priceData.price;
            }
          });
        }
      } catch (categoryError) {
        console.warn(`Error fetching rates for ${category}:`, categoryError);
        // Continue with other categories
      }
    }

    // Cache the results
    ratesCache = {
      data: assetRates,
      timestamp: now,
      baseCurrency,
      requestedAssets: assetsWithBalances,
    };

    console.log("Asset rates:", assetRates);
    return assetRates;
  } catch (error) {
    console.error("Error fetching asset rates:", error);

    // Return cached data if available, even if expired
    if (ratesCache.data && ratesCache.baseCurrency === baseCurrency) {
      console.warn("Using expired asset rates due to API error");
      return ratesCache.data;
    }

    // Fallback: return 1:1 rates for requested assets
    console.warn("No asset rates available, using 1:1 conversion");
    const fallbackRates: AssetRates = { [baseCurrency]: 1 };
    assetsWithBalances.forEach((asset) => {
      if (asset !== baseCurrency) {
        fallbackRates[asset] = 1;
      }
    });
    return fallbackRates;
  }
}

// Legacy function for backward compatibility - now uses the new system
export async function getExchangeRates(
  baseCurrency: string = "USD"
): Promise<ExchangeRates> {
  // Get all currency codes for backward compatibility
  const currencies = getCurrencyCodes();
  return getAssetRates(currencies, baseCurrency);
}

export function convertCurrency(
  amount: number,
  fromAsset: string,
  toAsset: string,
  rates: AssetRates
): number {
  if (fromAsset === toAsset) {
    return amount;
  }

  // Find the base currency (the one with rate = 1)
  const baseCurrency =
    Object.keys(rates).find((asset) => rates[asset] === 1) || "USD";

  // If converting from base currency to another asset
  if (fromAsset === baseCurrency && rates[toAsset]) {
    return amount * rates[toAsset];
  }

  // If converting from another asset to base currency
  if (toAsset === baseCurrency && rates[fromAsset]) {
    return amount * rates[fromAsset];
  }

  // If converting between two non-base assets
  if (rates[fromAsset] && rates[toAsset]) {
    // Convert from source asset to base currency, then to target asset
    const amountInBase = amount * rates[fromAsset];
    return amountInBase / rates[toAsset];
  }

  // Fallback: assume 1:1 conversion
  console.warn(`No exchange rate found for ${fromAsset} to ${toAsset}`);
  return amount;
}

// New function to get historical asset rates
export async function getHistoricalAssetRates(
  assetsWithBalances: string[],
  baseCurrency: string = "USD",
  period: string = "1d",
  interval: string = "1h"
): Promise<CurrencyPriceData[]> {
  if (assetsWithBalances.length === 0) {
    return [];
  }

  try {
    // Group assets by category for different API endpoints
    const assetsByCategory: Record<AssetCategory, string[]> = {
      currency: [],
      stock: [],
      etf: [],
      crypto: [],
    };

    // Categorize assets
    assetsWithBalances.forEach((asset) => {
      const category = findAssetCategory(asset);
      if (category && !assetsByCategory[category].includes(asset)) {
        assetsByCategory[category].push(asset);
      }
    });

    const allHistoricalData: CurrencyPriceData[] = [];

    // Fetch historical rates for each category
    for (const [category, assets] of Object.entries(assetsByCategory)) {
      if (assets.length === 0) continue;

      const categoryAssets = assets.filter((asset) => asset !== baseCurrency);
      if (categoryAssets.length === 0) continue;

      try {
        const tickers = categoryAssets.map((asset) => {
          switch (category) {
            case "currency":
              return `${asset}USD=X`;
            case "stock":
            case "etf":
              return asset; // Stocks and ETFs use their ticker directly
            case "crypto":
              return `${asset}-USD`; // Crypto pairs
            default:
              return asset;
          }
        });

        const tickerParams = tickers
          .map((ticker) => `tickers=${encodeURIComponent(ticker)}`)
          .join("&");

        const response = await fetch(
          `${API_BASE_URL}/prices/historical?${tickerParams}&currency=${baseCurrency}&period=${period}&interval=${interval}`
        );

        if (!response.ok) {
          console.warn(
            `Failed to fetch historical rates for ${category}: ${response.status}`
          );
          continue;
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          allHistoricalData.push(...data);
        }
      } catch (categoryError) {
        console.warn(
          `Error fetching historical rates for ${category}:`,
          categoryError
        );
        // Continue with other categories
      }
    }

    return allHistoricalData;
  } catch (error) {
    console.error("Error fetching historical asset rates:", error);
    return [];
  }
}

// Legacy function for backward compatibility
export async function getHistoricalExchangeRates(
  baseCurrency: string = "USD",
  period: string = "1d",
  interval: string = "1h"
): Promise<CurrencyPriceData[]> {
  // Get all currency codes for backward compatibility
  const currencies = getCurrencyCodes();
  return getHistoricalAssetRates(currencies, baseCurrency, period, interval);
}

export function formatCurrency(amount: number, asset: string): string {
  const category = findAssetCategory(asset);

  // For currencies, use standard currency formatting
  if (category === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: asset,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  // For other assets, use custom formatting with symbol
  const assetData = ASSETS[category]?.find((a) => a.ticker === asset);
  const symbol = assetData?.symbol || asset;

  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6, // More precision for stocks/crypto
    }).format(amount) + ` ${symbol}`
  );
}

export function getAssetSymbol(asset: string): string {
  const category = findAssetCategory(asset);
  const assetData = ASSETS[category]?.find((a) => a.ticker === asset);
  return assetData?.symbol || asset;
}

// Legacy function for backward compatibility
export function getCurrencySymbol(currency: string): string {
  return getAssetSymbol(currency);
}

// Helper function to extract unique assets from account balances
export function extractAssetsFromBalances(
  balances: Array<{ currency: string }>
): string[] {
  const uniqueAssets = new Set<string>();
  balances.forEach((balance) => {
    uniqueAssets.add(balance.currency);
  });
  return Array.from(uniqueAssets);
}
