/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { formatCurrency, convertCurrency, AssetRates } from "@/lib/currency";
import { Database } from "@/types/database";

type AccountBalance = Database["public"]["Tables"]["account_balances"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

interface PieChartProps {
  accounts: AccountWithBalances[];
  exchangeRates: AssetRates | null;
  mainCurrency: string;
  className?: string;
}

interface PieChartData {
  name: string;
  value: number;
  originalValue: number;
  originalCurrency: string;
  color: string;
  percentage: number;
  [key: string]: any;
}

type ViewMode = "assets" | "categories";

// Color palette using theme chart colors
const ASSET_COLORS = [
  "hsl(var(--chart-1))", // Primary orange
  "hsl(var(--chart-2))", // Teal green
  "hsl(var(--chart-3))", // Orange/yellow
  "hsl(var(--chart-4))", // Purple
  "hsl(var(--chart-5))", // Pink/red
  "hsl(var(--primary))", // Primary color
  "hsl(var(--accent))", // Accent color
  "hsl(var(--secondary))", // Secondary color
  "hsl(var(--muted-foreground))", // Muted foreground
  "hsl(var(--border))", // Border color
];

export default function PieChart({
  accounts,
  exchangeRates,
  mainCurrency,
  className = "",
}: PieChartProps) {
  const [chartData, setChartData] = useState<PieChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("assets");

  const processData = useCallback(async () => {
    // If we don't have exchange rates yet, keep loading state
    if (!exchangeRates) {
      return;
    }

    // If we have exchange rates but no accounts, that's a real "no data" state
    if (accounts.length === 0) {
      setLoading(false);
      setChartData([]);
      return;
    }

    setLoading(true);

    try {
      // Aggregate all balances by currency or category based on view mode
      const balanceMap = new Map<
        string,
        {
          value: number;
          originalValue: number;
          originalCurrency: string;
          count: number;
        }
      >();

      accounts.forEach((account) => {
        account.balances.forEach((balance) => {
          if (balance.current_balance > 0) {
            // Use currency for assets view, category for categories view
            const key =
              viewMode === "assets" ? balance.currency : balance.category;
            const convertedValue = convertCurrency(
              balance.current_balance,
              balance.currency,
              mainCurrency,
              exchangeRates
            );

            if (balanceMap.has(key)) {
              const existing = balanceMap.get(key)!;
              existing.value += convertedValue;
              existing.originalValue += balance.current_balance;
              existing.count += 1;
            } else {
              balanceMap.set(key, {
                value: convertedValue,
                originalValue: balance.current_balance,
                originalCurrency: balance.currency,
                count: 1,
              });
            }
          }
        });
      });

      // Convert to array and sort by value
      let data: PieChartData[] = Array.from(balanceMap.entries())
        .map(([key, data]) => ({
          name:
            viewMode === "assets"
              ? data.originalCurrency.toUpperCase()
              : key.charAt(0).toUpperCase() + key.slice(1), // Capitalize category name
          value: data.value,
          originalValue: data.originalValue,
          originalCurrency: data.originalCurrency,
          color: "#6b7280", // Will be assigned later
          percentage: 0, // Will be calculated later
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);

      // Calculate total value for percentages
      const totalValue = data.reduce((sum, item) => sum + item.value, 0);

      // Group smaller assets into "Others" if more than 5 assets
      if (data.length > 5) {
        const topAssets = data.slice(0, 4);
        const othersAssets = data.slice(4);
        const othersValue = othersAssets.reduce(
          (sum, item) => sum + item.value,
          0
        );
        const othersOriginalValue = othersAssets.reduce(
          (sum, item) => sum + item.originalValue,
          0
        );

        data = [
          ...topAssets,
          {
            name: "Others",
            value: othersValue,
            originalValue: othersOriginalValue,
            originalCurrency: "MIXED",
            color: "#6b7280",
            percentage: 0,
          },
        ];
      }

      // Assign colors and calculate percentages
      data.forEach((item, index) => {
        item.color = ASSET_COLORS[index % ASSET_COLORS.length];
        item.percentage = (item.value / totalValue) * 100;
      });

      setChartData(data);
    } catch (error) {
      console.error("Error processing pie chart data:", error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [accounts, exchangeRates, mainCurrency, viewMode]);

  useEffect(() => {
    processData();
  }, [processData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as PieChartData;

      return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-1">
            {data.name}
          </p>
          <p className="text-sm text-muted-foreground mb-1">
            {formatCurrency(data.value, mainCurrency)} (
            {data.percentage.toFixed(1)}%)
          </p>
          {viewMode === "assets" && data.originalCurrency !== "MIXED" && (
            <p className="text-xs text-muted-foreground">
              Original:{" "}
              {formatCurrency(data.originalValue, data.originalCurrency)}
            </p>
          )}
          {viewMode === "categories" && (
            <p className="text-xs text-muted-foreground">
              Category: {data.name}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    if (!payload || payload.length === 0) return null;

    // Sort legend items by percentage (highest to lowest), with "Others" always last
    const sortedPayload = payload
      .map((entry: any) => {
        const data = chartData.find((item) => item.name === entry.value);
        return { ...entry, percentage: data?.percentage || 0 };
      })
      .sort((a: any, b: any) => {
        // If one is "Others", it goes last
        if (a.value === "Others") return 1;
        if (b.value === "Others") return -1;
        // Otherwise sort by percentage (highest to lowest)
        return b.percentage - a.percentage;
      });

    return (
      <div className="flex flex-wrap gap-3 mt-4">
        {sortedPayload.map((entry: any, index: number) => {
          const data = chartData.find((item) => item.name === entry.value);
          return (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-foreground font-medium">
                {entry.value}
              </span>
              <span className="text-xs text-muted-foreground">
                ({data?.percentage.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Don't return early for loading - we'll handle it in the render

  if (chartData.length === 0 && !loading) {
    return (
      <div className={`card-elevated p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground flex items-center">
            <PieChartIcon className="h-5 w-5 mr-2 text-primary" />
            Asset Distribution
          </h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <PieChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No asset balances found. Add some transactions to see your asset
              distribution.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-elevated p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center">
          <PieChartIcon className="h-5 w-5 mr-2 text-primary" />
          Asset Distribution
        </h2>

        <div className="flex items-center">
          <div className="flex bg-muted rounded-md p-0.5">
            <button
              onClick={() => setViewMode("assets")}
              className={`px-2 py-1 text-xs rounded-sm transition-colors ${
                viewMode === "assets"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Assets
            </button>
            <button
              onClick={() => setViewMode("categories")}
              className={`px-2 py-1 text-xs rounded-sm transition-colors ${
                viewMode === "categories"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Categories
            </button>
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
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={80}
                stroke="none"
                dataKey="value"
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </RechartsPieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
