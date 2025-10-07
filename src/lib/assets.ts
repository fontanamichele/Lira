export type AssetCategory = "currency" | "stock" | "etf" | "crypto";

export interface AssetItem {
  ticker: string;
  name: string;
  symbol?: string;
}

export type AssetsByCategory = Record<AssetCategory, AssetItem[]>;

export const ASSETS: AssetsByCategory = {
  currency: [
    { ticker: "USD", name: "US Dollar", symbol: "$" },
    { ticker: "EUR", name: "Euro", symbol: "€" },
    { ticker: "GBP", name: "British Pound", symbol: "£" },
    { ticker: "JPY", name: "Japanese Yen", symbol: "¥" },
    { ticker: "CAD", name: "Canadian Dollar", symbol: "C$" },
    { ticker: "AUD", name: "Australian Dollar", symbol: "A$" },
    { ticker: "CHF", name: "Swiss Franc", symbol: "CHF" },
    { ticker: "CNY", name: "Chinese Yuan", symbol: "¥" },
    { ticker: "SEK", name: "Swedish Krona", symbol: "kr" },
    { ticker: "NOK", name: "Norwegian Krone", symbol: "kr" },
    { ticker: "DKK", name: "Danish Krone", symbol: "kr" },
    { ticker: "PLN", name: "Polish Zloty", symbol: "zł" },
    { ticker: "CZK", name: "Czech Koruna", symbol: "Kč" },
    { ticker: "HUF", name: "Hungarian Forint", symbol: "Ft" },
    { ticker: "RUB", name: "Russian Ruble", symbol: "₽" },
    { ticker: "BRL", name: "Brazilian Real", symbol: "R$" },
    { ticker: "INR", name: "Indian Rupee", symbol: "₹" },
    { ticker: "KRW", name: "South Korean Won", symbol: "₩" },
    { ticker: "SGD", name: "Singapore Dollar", symbol: "S$" },
    { ticker: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  ],
  stock: [
    { ticker: "AAPL", name: "Apple Inc." },
    { ticker: "MSFT", name: "Microsoft Corp." },
    { ticker: "GOOGL", name: "Alphabet Inc." },
    { ticker: "AMZN", name: "Amazon.com Inc." },
    { ticker: "TSLA", name: "Tesla Inc." },
    { ticker: "META", name: "Meta Platforms Inc." },
    { ticker: "NVDA", name: "NVIDIA Corp." },
    { ticker: "BRK.B", name: "Berkshire Hathaway Inc." },
    { ticker: "UNH", name: "UnitedHealth Group Inc." },
    { ticker: "JNJ", name: "Johnson & Johnson" },
    { ticker: "V", name: "Visa Inc." },
    { ticker: "PG", name: "Procter & Gamble Co." },
    { ticker: "JPM", name: "JPMorgan Chase & Co." },
    { ticker: "MA", name: "Mastercard Inc." },
    { ticker: "HD", name: "Home Depot Inc." },
    { ticker: "DIS", name: "Walt Disney Co." },
    { ticker: "PYPL", name: "PayPal Holdings Inc." },
    { ticker: "ADBE", name: "Adobe Inc." },
    { ticker: "CRM", name: "Salesforce Inc." },
    { ticker: "NFLX", name: "Netflix Inc." },
    { ticker: "INTC", name: "Intel Corp." },
    { ticker: "AMD", name: "Advanced Micro Devices Inc." },
    { ticker: "UBER", name: "Uber Technologies Inc." },
    { ticker: "SQ", name: "Block Inc." },
  ],
  etf: [
    { ticker: "SPY", name: "SPDR S&P 500 ETF Trust" },
    { ticker: "IVV", name: "iShares Core S&P 500 ETF" },
    { ticker: "VTI", name: "Vanguard Total Stock Market ETF" },
    { ticker: "VWCE.DE", name: "Vanguard Total World Stock ETF" },
    { ticker: "QQQ", name: "Invesco QQQ Trust" },
    { ticker: "IWM", name: "iShares Russell 2000 ETF" },
    { ticker: "VEA", name: "Vanguard FTSE Developed Markets ETF" },
    { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF" },
    { ticker: "BND", name: "Vanguard Total Bond Market ETF" },
    { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
    { ticker: "GLD", name: "SPDR Gold Shares" },
    { ticker: "SLV", name: "iShares Silver Trust" },
    { ticker: "XLF", name: "Financial Select Sector SPDR Fund" },
    { ticker: "XLK", name: "Technology Select Sector SPDR Fund" },
    { ticker: "XLE", name: "Energy Select Sector SPDR Fund" },
    { ticker: "XLV", name: "Health Care Select Sector SPDR Fund" },
    { ticker: "ARKK", name: "ARK Innovation ETF" },
    { ticker: "TAN", name: "Invesco Solar ETF" },
    { ticker: "ICLN", name: "iShares Global Clean Energy ETF" },
  ],
  crypto: [
    { ticker: "BTC", name: "Bitcoin", symbol: "₿" },
    { ticker: "ETH", name: "Ethereum", symbol: "Ξ" },
    { ticker: "SOL", name: "Solana" },
    { ticker: "ADA", name: "Cardano" },
    { ticker: "DOT", name: "Polkadot" },
    { ticker: "MATIC", name: "Polygon" },
    { ticker: "AVAX", name: "Avalanche" },
    { ticker: "LINK", name: "Chainlink" },
    { ticker: "UNI", name: "Uniswap" },
    { ticker: "ATOM", name: "Cosmos" },
    { ticker: "FTM", name: "Fantom" },
    { ticker: "ALGO", name: "Algorand" },
    { ticker: "VET", name: "VeChain" },
    { ticker: "FIL", name: "Filecoin" },
    { ticker: "TRX", name: "TRON" },
    { ticker: "XRP", name: "Ripple" },
    { ticker: "LTC", name: "Litecoin" },
    { ticker: "BCH", name: "Bitcoin Cash" },
    { ticker: "DOGE", name: "Dogecoin" },
    { ticker: "SHIB", name: "Shiba Inu" },
    { ticker: "USDC", name: "USD Coin" },
    { ticker: "USDT", name: "Tether" },
    { ticker: "DAI", name: "Dai" },
    { ticker: "BUSD", name: "Binance USD" },
  ],
};

export function getCurrencies(): {
  code: string;
  name: string;
  symbol: string;
}[] {
  return ASSETS.currency.map((c) => ({
    code: c.ticker,
    name: c.name,
    symbol: c.symbol || c.ticker,
  }));
}

export function getCurrencyCodes(): string[] {
  return ASSETS.currency.map((c) => c.ticker);
}

export function findAssetCategory(ticker: string): AssetCategory {
  const lower = ticker.toUpperCase();
  for (const category of Object.keys(ASSETS) as AssetCategory[]) {
    if (ASSETS[category].some((a) => a.ticker.toUpperCase() === lower)) {
      return category;
    }
  }
  return "currency";
}
