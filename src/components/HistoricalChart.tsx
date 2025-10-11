/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import { TrendingUp, Calendar, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import {
  calculateHistoricalHoldings,
  formatHistoricalDataForChart,
  HistoricalDataPoint,
  HistoricalCalculationOptions,
  getDefaultHistoricalOptions,
} from "@/lib/historicalData";
import { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type AccountBalance = Database["public"]["Tables"]["account_balances"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

interface HistoricalChartProps {
  accounts: AccountWithBalances[];
  transactions: Transaction[];
  mainCurrency: string;
  className?: string;
}

export default function HistoricalChart({
  accounts,
  transactions,
  mainCurrency,
  className = "",
}: HistoricalChartProps) {
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartKey, setChartKey] = useState(0);
  const [options, setOptions] = useState<HistoricalCalculationOptions>(() => ({
    ...getDefaultHistoricalOptions(),
    mainCurrency,
  }));

  // Use ref to track parameters to prevent double fetches
  const lastParamsRef = useRef<string>("");

  useEffect(() => {
    // Create a unique key for the current parameters
    const paramsKey = JSON.stringify({
      accountsLength: accounts.length,
      transactionsLength: transactions.length,
      period: options.period,
      interval: options.interval,
      mainCurrency: options.mainCurrency,
    });

    // Only fetch if we have data and parameters have actually changed
    if (
      accounts.length > 0 &&
      transactions.length > 0 &&
      paramsKey !== lastParamsRef.current
    ) {
      lastParamsRef.current = paramsKey;

      // Fetch data directly in useEffect
      const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
          const data = await calculateHistoricalHoldings(
            accounts,
            transactions,
            options
          );
          setHistoricalData(data);
          // Force chart re-render to trigger animation
          setChartKey((prev) => prev + 1);
        } catch (err) {
          setError(
            `Failed to load historical data: ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [accounts, transactions, options]);

  const fetchHistoricalData = useCallback(async () => {
    if (accounts.length === 0 || transactions.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await calculateHistoricalHoldings(
        accounts,
        transactions,
        options
      );
      setHistoricalData(data);
      // Force chart re-render to trigger animation
      setChartKey((prev) => prev + 1);
    } catch (err) {
      setError(
        `Failed to load historical data: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  }, [accounts, transactions, options]);

  const chartData = formatHistoricalDataForChart(historicalData);

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value, mainCurrency);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      // Only show the Line component's data (Portfolio Value)
      const linePayload = payload.find(
        (item: any) => item.name === "Portfolio Value"
      );
      if (linePayload) {
        return (
          <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
            <p className="text-sm text-muted-foreground mb-1">
              {new Date(label).toLocaleDateString()}
            </p>
            <p className="text-sm font-medium">
              Portfolio Value: {formatTooltipValue(linePayload.value)}
            </p>
          </div>
        );
      }
    }
    return null;
  };

  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const periodOptions = [
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
    { value: "1y", label: "1 Year" },
  ];

  const handlePeriodChange = (period: "7d" | "30d" | "90d" | "1y") => {
    setOptions((prev) => ({
      ...prev,
      period,
      interval: period === "7d" ? "4h" : "1d",
    }));
  };

  // Don't return early for loading - we'll handle it in the render

  if (error) {
    return (
      <div className={`card-elevated p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Portfolio History
          </h2>
        </div>
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">{error}</p>
          <button
            onClick={fetchHistoricalData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (chartData.length === 0 && !loading) {
    return (
      <div className={`card-elevated p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Portfolio History
          </h2>
        </div>
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No historical data available. Add some transactions to see your
            portfolio history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-elevated p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          Portfolio History
        </h2>

        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex space-x-1">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  handlePeriodChange(
                    option.value as "7d" | "30d" | "90d" | "1y"
                  )
                }
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  options.period === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              key={`chart-${chartKey}-${chartData.length}-${options.period}`}
            >
              <defs>
                <linearGradient
                  id="portfolioGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxisLabel}
                className="text-xs"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value, mainCurrency)}
                className="text-xs"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                fill="url(#portfolioGradient)"
                stroke="none"
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={false}
                name="Portfolio Value"
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
                activeDot={{
                  r: 8,
                  stroke: "hsl(var(--primary))",
                  strokeWidth: 3,
                  fill: "hsl(var(--background))",
                  style: {
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                  },
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
