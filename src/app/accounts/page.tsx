'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import MainLayout from '@/components/layout/MainLayout'
import { Plus, Edit, Trash2, CreditCard, Wallet } from 'lucide-react'
import { getExchangeRates, convertCurrency, formatCurrency, ExchangeRates } from '@/lib/currency'

type Account = Database['public']['Tables']['accounts']['Row']
type AccountBalance = Database['public']['Tables']['account_balances']['Row']

interface AccountWithBalances extends Account {
  balances: AccountBalance[]
}

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK',
  'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'BRL', 'INR', 'KRW', 'SGD', 'HKD'
]

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithBalances[]>([])
  const [loading, setLoading] = useState(true)
  const [animationsReady, setAnimationsReady] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountWithBalances | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    currencies: [{ currency: 'USD', amount: 0 }]
  })
  const [existingCurrencyIds, setExistingCurrencyIds] = useState<string[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null)
  const [ratesLoading, setRatesLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<{ main_currency: string } | null>(null)
  const [showCurrencyRemovalWarning, setShowCurrencyRemovalWarning] = useState(false)
  const [currencyToRemove, setCurrencyToRemove] = useState<{
    index: number
    currency: string
    transactionCount: number
  } | null>(null)
  const supabase = createClient()

  const fetchAccounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch user profile to get main currency
      const { data: profileData } = await supabase
        .from('profiles')
        .select('main_currency')
        .eq('id', user.id)
        .single()

      setUserProfile(profileData)

      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          balances:account_balances(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
      // Delay animations to ensure smooth transition
      setTimeout(() => {
        setAnimationsReady(true)
        document.body.classList.add('animations-complete')
      }, 100)
    }
  }, [supabase])

  const fetchExchangeRates = useCallback(async () => {
    if (!userProfile?.main_currency) return

    setRatesLoading(true)
    try {
      const rates = await getExchangeRates(userProfile.main_currency)
      setExchangeRates(rates)
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    } finally {
      setRatesLoading(false)
    }
  }, [userProfile?.main_currency])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    if (userProfile?.main_currency) {
      fetchExchangeRates()
    }
  }, [userProfile, fetchExchangeRates])

  const countTransactionsForAccountBalance = async (accountBalanceId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('account_balance_id', accountBalanceId)

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error('Error counting transactions:', error)
      return 0
    }
  }

  const calculateAccountTotal = (account: AccountWithBalances): number => {
    if (!exchangeRates || !userProfile?.main_currency) return 0
    
    return account.balances.reduce((total, balance) => {
      const convertedAmount = convertCurrency(
        balance.current_balance,
        balance.currency,
        userProfile.main_currency,
        exchangeRates
      )
      return total + convertedAmount
    }, 0)
  }

  const calculateTotalPortfolioValue = (): number => {
    if (!exchangeRates || !userProfile?.main_currency) return 0
    
    return accounts.reduce((total, account) => {
      return total + calculateAccountTotal(account)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (editingAccount) {
        // Update existing account
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('accounts')
          .update({ name: formData.name })
          .eq('id', editingAccount.id)

        if (error) throw error

        // First, delete any account balances that were removed
        const removedBalanceIds = existingCurrencyIds.slice(formData.currencies.length)
        if (removedBalanceIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('account_balances')
            .delete()
            .in('id', removedBalanceIds)

          if (deleteError) throw deleteError
        }

        // Update account balances
        for (let i = 0; i < formData.currencies.length; i++) {
          const currency = formData.currencies[i]
          const isExistingCurrency = i < existingCurrencyIds.length
          
          if (isExistingCurrency) {
            // For existing currencies, only update if currency changed (not amount)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: balanceError } = await (supabase as any)
              .from('account_balances')
              .update({ currency: currency.currency })
              .eq('id', existingCurrencyIds[i])

            if (balanceError) throw balanceError
          } else {
            // For new currencies, create new balance record
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: balanceError } = await (supabase as any)
              .from('account_balances')
              .insert({
                account_id: editingAccount.id,
                currency: currency.currency,
                initial_amount: currency.amount,
                current_balance: currency.amount,
              })

            if (balanceError) throw balanceError
          }
        }
      } else {
        // Create new account
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: accountData, error: accountError } = await (supabase as any)
          .from('accounts')
          .insert({
            user_id: user.id,
            name: formData.name,
          })
          .select()
          .single()

        if (accountError) throw accountError

        // Create account balances
        const balancesToInsert = formData.currencies.map(currency => ({
          account_id: accountData.id,
          currency: currency.currency,
          initial_amount: currency.amount,
          current_balance: currency.amount,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: balancesError } = await (supabase as any)
          .from('account_balances')
          .insert(balancesToInsert)

        if (balancesError) throw balancesError
      }

      setFormData({ name: '', currencies: [{ currency: 'USD', amount: 0 }] })
      setShowAddForm(false)
      setEditingAccount(null)
      fetchAccounts()
    } catch (error) {
      console.error('Error saving account:', error)
    }
  }

  const handleEdit = (account: AccountWithBalances) => {
    setEditingAccount(account)
    setFormData({
      name: account.name,
      currencies: account.balances.map(balance => ({
        currency: balance.currency,
        amount: balance.initial_amount
      }))
    })
    setExistingCurrencyIds(account.balances.map(balance => balance.id))
    setShowAddForm(true)
  }

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)

      if (error) throw error
      fetchAccounts()
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', currencies: [{ currency: 'USD', amount: 0 }] })
    setExistingCurrencyIds([])
    setShowAddForm(false)
    setEditingAccount(null)
  }

  const addCurrencyToForm = () => {
    setFormData({
      ...formData,
      currencies: [...formData.currencies, { currency: 'USD', amount: 0 }]
    })
  }

  const removeCurrencyFromForm = async (index: number) => {
    if (formData.currencies.length > 1) {
      // Check if this is an existing currency (editing mode)
      if (editingAccount && index < existingCurrencyIds.length) {
        const accountBalanceId = existingCurrencyIds[index]
        const transactionCount = await countTransactionsForAccountBalance(accountBalanceId)
        
        if (transactionCount > 0) {
          // Show warning dialog
          setCurrencyToRemove({
            index,
            currency: formData.currencies[index].currency,
            transactionCount
          })
          setShowCurrencyRemovalWarning(true)
          return
        }
      }
      
      // If no transactions or not editing, proceed with removal
      setFormData({
        ...formData,
        currencies: formData.currencies.filter((_, i) => i !== index)
      })
    }
  }

  const updateCurrencyInForm = (index: number, field: 'currency' | 'amount', value: string | number) => {
    setFormData({
      ...formData,
      currencies: formData.currencies.map((curr, i) =>
        i === index ? { ...curr, [field]: value } : curr
      )
    })
  }

  const confirmCurrencyRemoval = () => {
    if (currencyToRemove) {
      setFormData({
        ...formData,
        currencies: formData.currencies.filter((_, i) => i !== currencyToRemove.index)
      })
    }
    setShowCurrencyRemovalWarning(false)
    setCurrencyToRemove(null)
  }

  const cancelCurrencyRemoval = () => {
    setShowCurrencyRemovalWarning(false)
    setCurrencyToRemove(null)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div 
          className={`flex justify-between items-center transition-opacity duration-500 ${animationsReady ? 'opacity-100' : 'opacity-0'}`}
          style={{ 
            transform: animationsReady ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease'
          }}
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
            <p className="text-muted-foreground mt-1">
              Manage your bank accounts and track balances
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </button>
        </div>

        {/* Portfolio Summary */}
        {userProfile?.main_currency && accounts.length > 0 && (
          <div className={`bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 transition-all duration-300 ${animationsReady ? 'animate-bounce-in' : 'opacity-0'}`} style={{ animationDelay: animationsReady ? '0.1s' : '0s' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/20 rounded-xl shadow-lg">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Total Portfolio Value</h3>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  {ratesLoading ? (
                    <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-3xl font-bold text-primary">
                      {formatCurrency(calculateTotalPortfolioValue(), userProfile.main_currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-card border border-border rounded-lg p-6 animate-scale-in">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                  Account Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground  bg-background text-foreground"
                  placeholder="e.g., Checking Account, Savings"
                  required
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Currencies & Initial Amounts
                  </label>
                  {editingAccount && (
                    <p className="text-xs text-muted-foreground mb-3">
                      Note: Existing currencies show only the currency selector. Initial amounts can only be set when adding new currencies.
                    </p>
                  )}
                  {formData.currencies.map((currency, index) => {
                    const isExistingCurrency = editingAccount && index < existingCurrencyIds.length
                    return (
                      <div key={index} className="flex gap-2 mb-2">
                        <select
                          value={currency.currency}
                          onChange={(e) => updateCurrencyInForm(index, 'currency', e.target.value)}
                          className="flex-1 px-3 py-2 border border-input rounded-md shadow-sm  bg-background text-foreground"
                          disabled={!!isExistingCurrency}
                        >
                          {CURRENCIES.map(curr => (
                            <option key={curr} value={curr}>{curr}</option>
                          ))}
                        </select>
                        {!isExistingCurrency && (
                          <input
                            type="number"
                            step="0.01"
                            value={currency.amount || ''}
                            onChange={(e) => updateCurrencyInForm(index, 'amount', parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 border border-input rounded-md shadow-sm bg-background text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        )}
                        {formData.currencies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCurrencyFromForm(index)}
                            className="px-3 py-2 text-destructive hover:text-destructive/80 text-sm border border-destructive/20 rounded-md hover:border-destructive/40"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={addCurrencyToForm}
                    className="w-full py-2 px-4 border-2 border-dashed border-border rounded-md text-muted-foreground hover:text-foreground hover:border-primary transition-colors text-sm"
                  >
                    + Add Another Currency
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {editingAccount ? 'Update Account' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Accounts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account, index) => (
            <div key={account.id} className="bg-card border border-border rounded-lg p-6 animate-bounce-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-foreground">{account.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {account.balances.length} {account.balances.length === 1 ? 'currency' : 'currencies'}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(account)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Current Balances</span>
                  <div className="mt-1 space-y-1">
                    {account.balances.map((balance, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-sm text-foreground">{balance.currency}</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(balance.current_balance, balance.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Total in user's main currency */}
                {userProfile?.main_currency && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">
                        Total ({userProfile.main_currency})
                      </span>
                      <div className="flex items-center space-x-2">
                        {ratesLoading ? (
                          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="font-bold text-primary">
                            {formatCurrency(calculateAccountTotal(account), userProfile.main_currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm text-foreground">
                    {new Date(account.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No accounts yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first bank account to start tracking your cashflow
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 mx-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </button>
          </div>
        )}

        {/* Currency Removal Warning Dialog */}
        {showCurrencyRemovalWarning && currencyToRemove && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 animate-scale-in">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-destructive/10 rounded-lg mr-3">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Remove Currency
                </h3>
              </div>
              
              <div className="mb-6">
                <p className="text-foreground mb-2">
                  You are about to remove <strong>{currencyToRemove.currency}</strong> from this account.
                </p>
                <p className="text-destructive font-medium">
                  This will permanently delete <strong>{currencyToRemove.transactionCount}</strong> transaction{currencyToRemove.transactionCount !== 1 ? 's' : ''} related to this currency balance.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelCurrencyRemoval}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:border-foreground/20"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCurrencyRemoval}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
                >
                  Remove Currency
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
