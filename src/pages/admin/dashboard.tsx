import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";
import { useRouter } from "next/router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  month: string;
  revenue: number;
  cost: number;
  margin: number;
}

interface ConversionData {
  month: string;
  count: number;
  value: number;
}

function AdminDashboardContent() {
  const router = useRouter();
  const [financialData, setFinancialData] = useState<MonthlyData[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearEndRevenue, setYearEndRevenue] = useState(0);
  const [yearEndCosts, setYearEndCosts] = useState(0);
  const [yearEndMargin, setYearEndMargin] = useState(0);
  const [marginPercent, setMarginPercent] = useState(0);

  useEffect(() => {
    fetchFinancialTrends();
    fetchConversionData();
  }, []);

  const fetchFinancialTrends = async () => {
    try {
      setLoading(true);
      setError(null);

      const targetYear = 2026;
      const monthlyData: MonthlyData[] = [];

      // Fixed cost per month
      const monthlyCost = 160000;

      // Fetch all projects with dates and turnover
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(`
          id,
          code,
          name,
          start_date,
          end_date,
          agreed_fee_value,
          companies!projects_client_company_id_fkey (
            short_name,
            name
          )
        `)
        .eq("archived", false)
        .not("agreed_fee_value", "is", null)
        .gte("end_date", `${targetYear}-01-01`)
        .lte("start_date", `${targetYear}-12-31`);

      if (projectsError) throw projectsError;

      // Fetch all opportunities with dates and turnover
      const { data: oppsData, error: oppsError } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          stage,
          expected_start_date,
          expected_end_date,
          tender_due_date,
          expected_fee_value,
          companies (
            short_name,
            name
          )
        `)
        .eq("archived", false)
        .eq("stage", "secured")
        .neq("status", "closed_won")
        .neq("status", "closed_lost")
        .not("expected_fee_value", "is", null);

      if (oppsError) throw oppsError;

      // Fetch all manual phasing for projects
      const { data: projPhasingData, error: projPhasingError } = await supabase
        .from("project_monthly_phasing")
        .select("project_id, year, month, revenue_amount")
        .eq("year", targetYear);

      if (projPhasingError) throw projPhasingError;

      // Fetch all manual phasing for opportunities
      const { data: oppPhasingData, error: oppPhasingError } = await supabase
        .from("opportunity_monthly_phasing")
        .select("opportunity_id, year, month, revenue_amount")
        .eq("year", targetYear);

      if (oppPhasingError) throw oppPhasingError;

      // Get projects/opportunities that have ANY manual phasing
      const { data: projectsWithAnyPhasing } = await supabase
        .from("project_monthly_phasing")
        .select("project_id")
        .not("revenue_amount", "is", null);

      const { data: oppsWithAnyPhasing } = await supabase
        .from("opportunity_monthly_phasing")
        .select("opportunity_id")
        .not("revenue_amount", "is", null);

      // Create phasing lookup maps
      const projPhasingMap = new Map<string, Map<string, number>>();
      projPhasingData?.forEach((p) => {
        if (!projPhasingMap.has(p.project_id)) {
          projPhasingMap.set(p.project_id, new Map());
        }
        const key = `${p.year}-${p.month}`;
        projPhasingMap.get(p.project_id)!.set(key, p.revenue_amount || 0);
      });

      const oppPhasingMap = new Map<string, Map<string, number>>();
      oppPhasingData?.forEach((p) => {
        if (!oppPhasingMap.has(p.opportunity_id)) {
          oppPhasingMap.set(p.opportunity_id, new Map());
        }
        const key = `${p.year}-${p.month}`;
        oppPhasingMap.get(p.opportunity_id)!.set(key, p.revenue_amount || 0);
      });

      // Create sets of projects/opportunities with ANY manual phasing
      const projectsWithAnyPhasingSet = new Set(
        projectsWithAnyPhasing?.map((p) => p.project_id) || []
      );

      const oppsWithAnyPhasingSet = new Set(
        oppsWithAnyPhasing?.map((o) => o.opportunity_id) || []
      );

      // Calculate revenue for each month in 2026
      let totalYearRevenue = 0;

      for (let month = 1; month <= 12; month++) {
        let monthRevenue = 0;
        const monthStart = new Date(targetYear, month - 1, 1);
        const monthEnd = new Date(targetYear, month, 0);

        // Add project revenue for this month
        if (projectsData) {
          projectsData.forEach((proj) => {
            const startDate = new Date(proj.start_date || "");
            const endDate = new Date(proj.end_date || "");

            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              // Check if project overlaps with this month
              if (startDate <= monthEnd && endDate >= monthStart) {
                const hasManualPhasing = projectsWithAnyPhasingSet.has(proj.id);
                const phasingKey = `${targetYear}-${month}`;
                const manualPhasing = projPhasingMap.get(proj.id);

                if (hasManualPhasing) {
                  // Use manual phasing value (or 0 if not set for this month)
                  monthRevenue += manualPhasing?.get(phasingKey) || 0;
                } else {
                  // Calculate default monthly turnover
                  const durationMonths = Math.max(
                    1,
                    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth()) +
                      1
                  );
                  const defaultMonthlyTurnover = (proj.agreed_fee_value || 0) / durationMonths;
                  monthRevenue += defaultMonthlyTurnover;
                }
              }
            }
          });
        }

        // Add secured opportunity revenue for this month
        if (oppsData) {
          oppsData.forEach((opp) => {
            const startDate = new Date(opp.expected_start_date || opp.tender_due_date || "");
            const endDate = opp.expected_end_date ? new Date(opp.expected_end_date) : null;

            // For opportunities without end date, spread across remaining months of year
            if (!isNaN(startDate.getTime())) {
              const hasManualPhasing = oppsWithAnyPhasingSet.has(opp.id);
              const phasingKey = `${targetYear}-${month}`;
              const manualPhasing = oppPhasingMap.get(opp.id);

              if (hasManualPhasing) {
                // Use manual phasing value (or 0 if not set for this month)
                monthRevenue += manualPhasing?.get(phasingKey) || 0;
              } else {
                // Handle opportunities without end dates
                if (!endDate) {
                  // If no end date, spread from start month to end of year
                  const yearEnd = new Date(targetYear, 11, 31);
                  if (startDate <= monthEnd && startDate.getFullYear() === targetYear) {
                    // Calculate months from start to end of year
                    const remainingMonths = Math.max(
                      1,
                      12 - startDate.getMonth()
                    );
                    const defaultMonthlyTurnover = (opp.expected_fee_value || 0) / remainingMonths;
                    
                    // Only add if this month is after or equal to start month
                    if (month >= startDate.getMonth() + 1) {
                      monthRevenue += defaultMonthlyTurnover;
                    }
                  }
                } else {
                  // Has end date - check if overlaps with this month
                  if (startDate <= monthEnd && endDate >= monthStart) {
                    const durationMonths = Math.max(
                      1,
                      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                        (endDate.getMonth() - startDate.getMonth()) +
                        1
                    );
                    const defaultMonthlyTurnover = (opp.expected_fee_value || 0) / durationMonths;
                    monthRevenue += defaultMonthlyTurnover;
                  }
                }
              }
            }
          });
        }

        totalYearRevenue += monthRevenue;

        monthlyData.push({
          month: new Date(targetYear, month - 1).toLocaleDateString("en-GB", {
            month: "short",
            year: "2-digit",
          }),
          revenue: monthRevenue,
          cost: monthlyCost,
          margin: monthRevenue - monthlyCost,
        });
      }

      const totalYearCosts = monthlyCost * 12;
      const totalYearMargin = totalYearRevenue - totalYearCosts;
      const marginPct = totalYearRevenue > 0 ? (totalYearMargin / totalYearRevenue) * 100 : 0;

      console.log("2026 Year-End Calculation:");
      console.log("Total Revenue:", totalYearRevenue);
      console.log("Total Costs:", totalYearCosts);
      console.log("Total Margin:", totalYearMargin);
      console.log("Margin %:", marginPct);

      setYearEndRevenue(totalYearRevenue);
      setYearEndCosts(totalYearCosts);
      setYearEndMargin(totalYearMargin);
      setMarginPercent(marginPct);
      setFinancialData(monthlyData);
    } catch (err) {
      console.error("Failed to load financial trends", err);
      setError("Failed to load financial trends. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchConversionData = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select("created_at, expected_fee_value, status")
        .eq("status", "closed_won")
        .gte("created_at", "2026-01-01")
        .lte("created_at", "2026-12-31");

      if (error) throw error;

      const monthlyConversions: { [key: string]: { count: number; value: number } } = {};

      data?.forEach((opp) => {
        const month = new Date(opp.created_at).toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        });
        if (!monthlyConversions[month]) {
          monthlyConversions[month] = { count: 0, value: 0 };
        }
        monthlyConversions[month].count += 1;
        monthlyConversions[month].value += opp.expected_fee_value || 0;
      });

      const conversions = Object.entries(monthlyConversions).map(([month, data]) => ({
        month,
        count: data.count,
        value: data.value,
      }));

      setConversionData(conversions);
    } catch (err) {
      console.error("Failed to load conversion data", err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/admin")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Financial overview and key metrics
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-600">Loading dashboard data...</div>
          </div>
        ) : (
          <>
            {/* Financial Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Trends (2026)</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Revenue, costs, and margin over time
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={financialData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Revenue"
                      dot={{ fill: "#10b981", r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="#ef4444"
                      strokeWidth={2}
                      name="Cost"
                      dot={{ fill: "#ef4444", r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="margin"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Margin"
                      dot={{ fill: "#3b82f6", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Year-End Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900 dark:text-green-100">
                        Year-End Revenue
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(yearEndRevenue)}
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Secured work + manual phasing
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-900 dark:text-red-100">
                        Year-End Costs
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {formatCurrency(yearEndCosts)}
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      £160k/month × 12 months
                    </p>
                  </div>

                  <div
                    className={`bg-gradient-to-br rounded-xl p-4 border ${
                      yearEndMargin >= 0
                        ? "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800"
                        : "from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {yearEndMargin >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-orange-600" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          yearEndMargin >= 0
                            ? "text-blue-900 dark:text-blue-100"
                            : "text-orange-900 dark:text-orange-100"
                        }`}
                      >
                        Year-End Margin
                      </span>
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        yearEndMargin >= 0
                          ? "text-blue-900 dark:text-blue-100"
                          : "text-orange-900 dark:text-orange-100"
                      }`}
                    >
                      {formatCurrency(yearEndMargin)}
                    </div>
                    <p
                      className={`text-xs mt-1 ${
                        yearEndMargin >= 0
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-orange-700 dark:text-orange-300"
                      }`}
                    >
                      Revenue - Costs
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Percent className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                        Margin %
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {marginPercent >= 0 ? "" : "-"}
                      {Math.abs(marginPercent).toFixed(1)}%
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Profit margin
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opportunities Converted to Projects */}
            <Card>
              <CardHeader>
                <CardTitle>Opportunities Converted to Projects</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Monthly conversion count and total value
                </p>
              </CardHeader>
              <CardContent>
                {conversionData.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    No conversions recorded for 2026 yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={conversionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="Count"
                        dot={{ fill: "#f59e0b", r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        name="Value"
                        dot={{ fill: "#8b5cf6", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

export default function AdminDashboardPage() {
  return (
    <RequireAuth>
      <AdminDashboardContent />
    </RequireAuth>
  );
}