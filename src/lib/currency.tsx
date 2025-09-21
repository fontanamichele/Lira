// Currency conversion utilities using custom currency rate API provider
// Configure your API provider domain in environment variables

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CURRENCY_API_URL || "https://your-api-provider.com";

export interface ExchangeRates {
  [currency: string]: number;
}

export interface CurrencyPriceData {
  ticker: string;
  price: number;
  currency: string;
  timestamp: string;
}

// Cache for exchange rates to avoid excessive API calls
let ratesCache: {
  data: ExchangeRates | null;
  timestamp: number;
  baseCurrency: string;
} = {
  data: null,
  timestamp: 0,
  baseCurrency: "",
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function getExchangeRates(
  baseCurrency: string = "USD"
): Promise<ExchangeRates> {
  // Check if we have valid cached data
  const now = Date.now();
  if (
    ratesCache.data &&
    ratesCache.baseCurrency === baseCurrency &&
    now - ratesCache.timestamp < CACHE_DURATION
  ) {
    return ratesCache.data;
  }

  try {
    // Get exchange rates for major currencies against the base currency
    const currencies = [
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "CAD",
      "AUD",
      "CHF",
      "CNY",
      "SEK",
      "NOK",
      "DKK",
      "PLN",
      "CZK",
      "HUF",
      "RUB",
      "BRL",
      "INR",
      "KRW",
      "SGD",
      "HKD",
    ];
    const targetCurrencies = currencies.filter((c) => c !== baseCurrency);

    // Create tickers for the API call
    const tickerParams = targetCurrencies
      .map((currency) => `tickers=${encodeURIComponent(`${currency}USD=X`)}`)
      .join("&");

    const response = await fetch(
      `${API_BASE_URL}/prices/current?${tickerParams}&currency=${baseCurrency}`
    );

    if (!response.ok) {
      throw new Error(`Currency API error: ${response.status}`);
    }

    const data = await response.json();

    // Convert the API response to our ExchangeRates format
    const exchangeRates: ExchangeRates = { [baseCurrency]: 1 };

    // The API returns a direct array of price data objects
    if (Array.isArray(data)) {
      data.forEach((priceData) => {
        // Extract currency from ticker (e.g., "CHFUSD=X" -> "CHF")
        const currency = priceData.ticker.replace("USD=X", "");
        if (currency !== baseCurrency) {
          // The price represents how much of the base currency you get for 1 unit of the source currency
          // e.g., if baseCurrency is EUR and price is 1.0709, then 1 CHF = 1.0709 EUR
          exchangeRates[currency] = priceData.price;
        }
      });
    } else {
      console.warn("Invalid API response format:", data);
      throw new Error("Invalid API response format");
    }

    // Cache the results
    ratesCache = {
      data: exchangeRates,
      timestamp: now,
      baseCurrency,
    };
    return exchangeRates;
  } catch (error) {
    console.error("Error fetching exchange rates:", error);

    // Return cached data if available, even if expired
    if (ratesCache.data && ratesCache.baseCurrency === baseCurrency) {
      console.warn("Using expired exchange rates due to API error");
      return ratesCache.data;
    }

    // Fallback: return 1:1 rates if no cache available
    console.warn("No exchange rates available, using 1:1 conversion");
    return {
      [baseCurrency]: 1,
    };
  }
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Find the base currency (the one with rate = 1)
  const baseCurrency =
    Object.keys(rates).find((currency) => rates[currency] === 1) || "USD";

  // If converting from base currency to another currency
  if (fromCurrency === baseCurrency && rates[toCurrency]) {
    return amount * rates[toCurrency];
  }

  // If converting from another currency to base currency
  if (toCurrency === baseCurrency && rates[fromCurrency]) {
    return amount * rates[fromCurrency];
  }

  // If converting between two non-base currencies
  if (rates[fromCurrency] && rates[toCurrency]) {
    // Convert from source currency to base currency, then to target currency
    const amountInBase = amount * rates[fromCurrency];
    return amountInBase / rates[toCurrency];
  }

  // Fallback: assume 1:1 conversion
  console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  return amount;
}

// New function to get historical exchange rates
export async function getHistoricalExchangeRates(
  baseCurrency: string = "USD",
  period: string = "1d",
  interval: string = "1h"
): Promise<CurrencyPriceData[]> {
  try {
    const currencies = [
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "CAD",
      "AUD",
      "CHF",
      "CNY",
      "SEK",
      "NOK",
      "DKK",
      "PLN",
      "CZK",
      "HUF",
      "RUB",
      "BRL",
      "INR",
      "KRW",
      "SGD",
      "HKD",
    ];
    const targetCurrencies = currencies.filter((c) => c !== baseCurrency);

    // Create tickers for the API call
    const tickerParams = targetCurrencies
      .map((currency) => `tickers=${encodeURIComponent(`${currency}USD=X`)}`)
      .join("&");

    const response = await fetch(
      `${API_BASE_URL}/prices/historical?${tickerParams}&currency=${baseCurrency}&period=${period}&interval=${interval}`
    );

    if (!response.ok) {
      throw new Error(`Currency API error: ${response.status}`);
    }

    const data = await response.json();

    // The API returns a direct array of price data objects
    if (Array.isArray(data)) {
      return data;
    } else {
      console.warn("Invalid historical API response format:", data);
      return [];
    }
  } catch (error) {
    console.error("Error fetching historical exchange rates:", error);
    return [];
  }
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getCurrencySymbol(currency: string): string {
  const symbols: { [key: string]: string } = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    CNY: "¥",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
    RUB: "₽",
    BRL: "R$",
    INR: "₹",
    KRW: "₩",
    SGD: "S$",
    HKD: "HK$",
  };

  return symbols[currency] || currency;
}
