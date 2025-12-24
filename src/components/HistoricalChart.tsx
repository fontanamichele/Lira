/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { LineChart, Calendar, BarChart3 } from "lucide-react";
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

  // Cache for historical data by period and data hash
  const dataCacheRef = useRef<
    Map<
      string,
      {
        data: HistoricalDataPoint[];
        dataHash: string;
      }
    >
  >(new Map());

  // Create a hash of accounts and transactions to detect changes
  const createDataHash = useCallback(() => {
    return JSON.stringify({
      accountsLength: accounts.length,
      transactionsLength: transactions.length,
      accountsHash: accounts.map((a) => a.id).sort().join(","),
      transactionsHash: transactions
        .map((t) => `${t.id}-${t.date}`)
        .sort()
        .join(","),
      mainCurrency,
    });
  }, [accounts, transactions, mainCurrency]);

  // Use ref to track parameters to prevent double fetches
  const lastParamsRef = useRef<string>("");

  useEffect(() => {
    // Only proceed if we have data
    if (accounts.length === 0 || transactions.length === 0) {
      return;
    }

    const dataHash = createDataHash();
    const cacheKey = `${options.period}-${options.interval}-${mainCurrency}`;
    const cached = dataCacheRef.current.get(cacheKey);

    // Check if we have cached data for this period with the same data hash
    if (cached && cached.dataHash === dataHash) {
      // Use cached data
      setHistoricalData(cached.data);
      setError(null);
      setLoading(false);
      return;
    }

    // Create a unique key for the current parameters
    const paramsKey = JSON.stringify({
      accountsLength: accounts.length,
      transactionsLength: transactions.length,
      period: options.period,
      interval: options.interval,
      mainCurrency: options.mainCurrency,
    });

    // Only fetch if parameters have actually changed
    if (paramsKey !== lastParamsRef.current) {
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
          
          // Store in cache
          dataCacheRef.current.set(cacheKey, {
            data,
            dataHash,
          });
          
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
  }, [accounts, transactions, options, mainCurrency, createDataHash]);

  const fetchHistoricalData = useCallback(async () => {
    if (accounts.length === 0 || transactions.length === 0) {
      return;
    }

    const dataHash = createDataHash();
    const cacheKey = `${options.period}-${options.interval}-${mainCurrency}`;
    const cached = dataCacheRef.current.get(cacheKey);

    // Check if we have cached data for this period with the same data hash
    if (cached && cached.dataHash === dataHash) {
      // Use cached data
      setHistoricalData(cached.data);
      setError(null);
      setLoading(false);
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
      
      // Store in cache
      dataCacheRef.current.set(cacheKey, {
        data,
        dataHash,
      });
      
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
  }, [accounts, transactions, options, mainCurrency, createDataHash]);

  const chartData = formatHistoricalDataForChart(historicalData);

  const { yMin, yMax } = useMemo(() => {
    if (!chartData.length) {
      return { yMin: 0, yMax: 1 };
    }

    let min = chartData[0].value;
    let max = chartData[0].value;

    for (const point of chartData) {
      if (typeof point.value === "number") {
        min = Math.min(min, point.value);
        max = Math.max(max, point.value);
      }
    }

    const range = max - min;
    const padding = (range || Math.max(max, 1)) * 0.1; // add 10% headroom
    const lowerBound = Math.max(min - padding, 0); // never go below zero
    const upperBound = max + padding || 1;

    return { yMin: lowerBound, yMax: upperBound };
  }, [chartData]);

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value, mainCurrency);
  };

  // Compact formatter for Y-axis labels to prevent cutoff
  const formatYAxisLabel = useMemo(() => {
    // Get currency symbol from formatCurrency
    const sampleFormatted = formatCurrency(1000, mainCurrency);
    const currencyMatch = sampleFormatted.match(/^[^\d\s.,]+/);
    const currencySymbol = currencyMatch ? currencyMatch[0] : "$";

    return (value: number) => {
      const absValue = Math.abs(value);

      // Use abbreviated format for large values
      if (absValue >= 1000000) {
        return `${currencySymbol}${(value / 1000000).toFixed(1)}M`;
      } else if (absValue >= 1000) {
        return `${currencySymbol}${(value / 1000).toFixed(1)}K`;
      } else if (absValue >= 1) {
        return `${currencySymbol}${value.toFixed(0)}`;
      } else {
        // For very small values, show more precision
        return `${currencySymbol}${value.toFixed(2)}`;
      }
    };
  }, [mainCurrency]);

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

  const periodOptions: { value: HistoricalCalculationOptions["period"]; label: string }[] =
    [
      { value: "30d", label: "30D" },
      { value: "180d", label: "6M" },
      { value: "ytd", label: "YTD" },
      { value: "1y", label: "1Y" },
      { value: "5y", label: "5Y" },
      { value: "all", label: "ALL" },
    ];

  const handlePeriodChange = (
    period: HistoricalCalculationOptions["period"]
  ) => {
    setOptions((prev) => ({
      ...prev,
      period,
      // Use daily interval for all current ranges
      interval: "1d",
    }));
  };

  // Don't return early for loading - we'll handle it in the render

  if (error) {
    return (
      <div className={`card-elevated p-6 flex flex-col h-full ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground flex items-center">
            <LineChart className="h-5 w-5 mr-2 text-primary" />
            Portfolio History
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="text-center">
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
      </div>
    );
  }

  if (chartData.length === 0 && !loading) {
    return (
      <div className={`card-elevated p-6 flex flex-col h-full ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground flex items-center">
            <LineChart className="h-5 w-5 mr-2 text-primary" />
            Portfolio History
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No historical data available. Add some transactions to see your
              portfolio history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-elevated p-6 flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center">
          <LineChart className="h-5 w-5 mr-2 text-primary" />
          Portfolio History
        </h2>

        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex space-x-1">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  handlePeriodChange(option.value)
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

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
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
                tickFormatter={formatYAxisLabel}
                className="text-xs"
                axisLine={false}
                tickLine={false}
                domain={[yMin, yMax]}
                width={60}
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
