// Currency conversion utilities using FreecurrencyAPI
// Get your free API key at https://freecurrencyapi.com/

const API_KEY = process.env.NEXT_PUBLIC_CURRENCY_API_KEY || 'your-api-key-here'
const API_BASE_URL = 'https://api.freecurrencyapi.com/v1'

export interface ExchangeRates {
  [currency: string]: number
}

export interface CurrencyConversionResult {
  data: ExchangeRates
  baseCurrency: string
  timestamp: string
}

// Cache for exchange rates to avoid excessive API calls
let ratesCache: {
  data: ExchangeRates | null
  timestamp: number
  baseCurrency: string
} = {
  data: null,
  timestamp: 0,
  baseCurrency: ''
}

const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export async function getExchangeRates(baseCurrency: string = 'USD'): Promise<ExchangeRates> {
  // Check if we have valid cached data
  const now = Date.now()
  if (
    ratesCache.data &&
    ratesCache.baseCurrency === baseCurrency &&
    (now - ratesCache.timestamp) < CACHE_DURATION
  ) {
    return ratesCache.data
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/latest?apikey=${API_KEY}&base_currency=${baseCurrency}`
    )

    if (!response.ok) {
      throw new Error(`Currency API error: ${response.status}`)
    }

    const data: CurrencyConversionResult = await response.json()
    
    // Cache the results
    ratesCache = {
      data: data.data,
      timestamp: now,
      baseCurrency
    }
    return data.data
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    
    // Return cached data if available, even if expired
    if (ratesCache.data && ratesCache.baseCurrency === baseCurrency) {
      console.warn('Using expired exchange rates due to API error')
      return ratesCache.data
    }
    
    // Fallback: return 1:1 rates if no cache available
    console.warn('No exchange rates available, using 1:1 conversion')
    return {
      [baseCurrency]: 1
    }
  }
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): number {
  if (fromCurrency === toCurrency) {
    return amount
  }

  // If converting from base currency
  if (rates[fromCurrency]) {
    return amount / rates[fromCurrency]
  }

  // If converting to base currency
  if (rates[toCurrency]) {
    return amount * rates[toCurrency]
  }

  // Fallback: assume 1:1 conversion
  console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`)
  return amount
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getCurrencySymbol(currency: string): string {
  const symbols: { [key: string]: string } = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    RUB: '₽',
    BRL: 'R$',
    INR: '₹',
    KRW: '₩',
    SGD: 'S$',
    HKD: 'HK$',
  }
  
  return symbols[currency] || currency
}
