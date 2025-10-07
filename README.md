# Lira - Multi-Asset Cashflow Tracking App

A modern Next.js application for tracking personal cashflow with comprehensive multi-asset support. Built with TypeScript, Tailwind CSS, and a beautiful theme with dark mode support.

## Features

- 🔐 **Authentication**: Secure login/signup with Supabase Auth
- 📊 **Dashboard**: Overview of your financial situation with key metrics
- 💳 **Account Management**: Add, edit, and manage multiple bank accounts
- 💰 **Cashflow Tracking**: Record income, expenses, and transfers with categories
- 🌍 **Multi-Asset Support**: Track currencies, stocks, ETFs, and cryptocurrencies
- 📈 **Real-Time Asset Pricing**: Live price updates for all supported assets

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS with custom theme
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Asset Pricing API**: Custom API provider for real-time asset prices (currencies, stocks, ETFs, crypto)
- **Icons**: Lucide React
- **UI Components**: Radix UI primitives

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Custom asset pricing API provider with the following endpoints:
  - `GET /prices/current?tickers={ticker1,ticker2}&currency={currency}`
  - `GET /prices/historical?tickers={ticker1,ticker2}&currency={currency}&period={period}&interval={interval}`

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd lira
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Copy the `.env.local` file and update it with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Set up Asset Pricing API

1. Configure your asset pricing API provider domain in your `.env.local` file:

```env
NEXT_PUBLIC_CURRENCY_API_URL=https://your-asset-pricing-api-provider.com
```

The API provider should support the following endpoints:

- **Current prices**: `GET /prices/current?tickers={ticker1}&tickers={ticker2}&currency={currency}`
- **Historical prices**: `GET /prices/historical?tickers={ticker1}&tickers={ticker2}&currency={currency}&period={period}&interval={interval}`

**Ticker formats**:

- **Currencies**: `{CURRENCY}USD=X` (e.g., `EURUSD=X` for EUR to USD conversion)
- **Stocks/ETFs**: Direct ticker (e.g., `AAPL`, `SPY`, `QQQ`)
- **Cryptocurrencies**: `{CRYPTO}-USD` (e.g., `BTC-USD`, `ETH-USD`)

**Example API calls**:

- EUR to USD: `/prices/current?tickers=EURUSD%3DX&currency=EUR`
- Apple stock: `/prices/current?tickers=AAPL&currency=USD`
- Bitcoin: `/prices/current?tickers=BTC-USD&currency=USD`
- S&P 500 ETF: `/prices/current?tickers=SPY&currency=USD`

### 5. Set up the database

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-schema.sql` into the editor
4. Run the SQL to create all necessary tables, policies, and functions

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Schema

The app uses four main tables:

- **profiles**: User profile information (nickname, main currency)
- **accounts**: Bank accounts (name, user reference)
- **account_balances**: Asset balances per account (currency, category, current_balance)
- **transactions**: Income, expense, and transfer records linked to specific asset balances

**Key Features**:

- **Multi-Asset Support**: Each balance has a category (currency, stock, etf, crypto) and ticker
- **Automatic Balance Creation**: Balances are created automatically when adding income/transfer transactions
- **No Initial Amounts**: Balances start at 0 and are updated through transactions
- **Row Level Security**: All tables include RLS policies to ensure users can only access their own data

## Features Overview

### Authentication Flow

1. User signs up with email/password
2. Automatic profile creation
3. Onboarding flow to set nickname, main currency, and bank accounts
4. Redirect to dashboard

### Dashboard

- Total balance across all accounts (converted to user's main currency)
- Recent income, expenses, and transfers
- Account overview with converted totals for all asset types
- Recent transactions with asset symbols and formatting

### Account Management

- Add multiple bank accounts
- View all asset balances per account (currencies, stocks, ETFs, crypto)
- Real-time asset price conversion to user's main currency
- Edit account details
- Delete accounts (with confirmation)
- **Note**: Asset balances are created automatically through transactions, not manually

### Cashflow Tracking

- **Income Transactions**: Choose any supported asset (currencies, stocks, ETFs, crypto)
- **Expense Transactions**: Use existing asset balances only
- **Transfer Transactions**: From existing balances to any supported asset
- Categorize transactions
- Automatic balance creation and updates
- Multi-asset transaction support with real-time pricing

### Settings

- Update profile information
- Change password
- View account information

## Customization

### Theme Colors

The app uses a custom theme defined in `tailwind.config.ts`. You can modify the color palette by updating the CSS variables in `src/app/globals.css`.

### Asset Support

The app supports a comprehensive range of assets with real-time pricing:

**Currencies (20+)**: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, and more
**Stocks (25)**: Major companies like Apple, Microsoft, Google, Tesla, Amazon, Meta, NVIDIA, and more
**ETFs (20)**: Broad market (SPY, QQQ), international (VEA, VWO), bonds (BND, TLT), commodities (GLD, SLV), and sector-specific funds
**Cryptocurrencies (25)**: Bitcoin, Ethereum, Solana, Cardano, Polkadot, stablecoins (USDC, USDT), and more

**Smart Features**:

- **Optimized API Usage**: Only fetches prices for assets you actually own
- **Automatic Asset Creation**: New assets are added to your portfolio when you receive income or transfers
- **Real-Time Conversion**: All assets are converted to your main currency for portfolio overview
- **Cached Pricing**: Asset prices are cached for 24 hours to minimize API usage

You can add more assets by updating the `ASSETS` object in `src/lib/assets.ts`.

### Categories

Transaction categories can be customized by updating the `CATEGORIES` array in `src/app/cashflow/page.tsx`.

## Recent Updates

### Multi-Asset Support (v2.0)

- **Expanded Asset Types**: Added support for stocks, ETFs, and cryptocurrencies alongside currencies
- **Smart Transaction Flow**:
  - Income transactions can use any supported asset
  - Expense transactions use existing asset balances only
  - Transfer transactions allow moving between any assets
- **Automatic Balance Management**: Asset balances are created automatically when needed
- **Optimized API Usage**: Only fetches prices for assets you actually own
- **Enhanced UI**: Asset-specific formatting and symbols throughout the interface

### Database Improvements

- **New Schema**: Added `category` field to `account_balances` table
- **Removed Initial Amounts**: Balances now start at 0 and are updated through transactions
- **Better Constraints**: Unique constraints now include asset category for proper organization

### Performance Optimizations

- **Selective Rate Fetching**: API calls only for assets with existing balances
- **Improved Caching**: 24-hour cache with smart invalidation
- **Reduced API Load**: Significant reduction in unnecessary API calls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
