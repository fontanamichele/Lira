# Lira - Cashflow Tracking App

A modern Next.js application for tracking personal cashflow with Supabase integration. Built with TypeScript, Tailwind CSS, and a beautiful theme with dark mode support.

## Features

- 🔐 **Authentication**: Secure login/signup with Supabase Auth
- 📊 **Dashboard**: Overview of your financial situation with key metrics
- 💳 **Account Management**: Add, edit, and manage multiple bank accounts with multi-currency support
- 💰 **Cashflow Tracking**: Record income and expenses with categories
- 🌍 **Multi-Currency Support**: Track accounts in multiple currencies with real-time conversion

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS with custom theme
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Currency API**: [FreecurrencyAPI](https://freecurrencyapi.com/) for real-time exchange rates
- **Icons**: Lucide React
- **UI Components**: Radix UI primitives

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- [FreecurrencyAPI](https://freecurrencyapi.com/) account (free tier available)

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

### 4. Set up Currency API

1. Sign up for a free account at [FreecurrencyAPI](https://freecurrencyapi.com/)
2. Get your API key from the dashboard
3. Add the API key to your `.env.local` file:

```env
NEXT_PUBLIC_CURRENCY_API_KEY=your_currency_api_key
```

**Note**: The free tier provides 5,000 requests per month, which is sufficient for most personal use cases.

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

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── dashboard/         # Dashboard page
│   ├── accounts/          # Accounts management
│   ├── cashflow/          # Transaction management
│   ├── settings/          # User settings
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   └── onboarding/        # Account setup flow
├── components/            # Reusable components
│   └── layout/           # Layout components
├── lib/                  # Utility libraries
│   ├── supabase/         # Supabase client configuration
│   └── utils.ts          # Utility functions
└── types/                # TypeScript type definitions
    └── database.ts       # Database types
```

## Database Schema

The app uses three main tables:

- **profiles**: User profile information (nickname, main currency)
- **accounts**: Bank accounts (name, user reference)
- **transactions**: Income and expense records linked to specific currency balances

All tables include Row Level Security (RLS) policies to ensure users can only access their own data.

## Features Overview

### Authentication Flow
1. User signs up with email/password
2. Automatic profile creation
3. Onboarding flow to set nickname, currency, and bank accounts
4. Redirect to dashboard

### Dashboard
- Total balance across all accounts (converted to user's main currency)
- Recent income and expenses
- Account overview with converted totals
- Recent transactions

### Account Management
- Add multiple bank accounts with multiple currencies per account
- Set initial amounts for each currency
- Real-time currency conversion to user's main currency
- Edit account details and currencies
- Delete accounts (with confirmation)

### Cashflow Tracking
- Add income and expense transactions
- Categorize transactions
- Link transactions to specific accounts and currencies
- Automatic balance updates
- Multi-currency transaction support

### Settings
- Update profile information
- Change password
- View account information

## Customization

### Theme Colors
The app uses a custom theme defined in `tailwind.config.ts`. You can modify the color palette by updating the CSS variables in `src/app/globals.css`.

### Currency Support
The app supports 20+ major currencies with real-time exchange rate conversion. You can add more currencies by updating the `CURRENCIES` arrays in the relevant components. Exchange rates are automatically fetched from [FreecurrencyAPI](https://freecurrencyapi.com/) and cached for 24 hours to minimize API usage.

### Categories
Transaction categories can be customized by updating the `CATEGORIES` array in `src/app/cashflow/page.tsx`.

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