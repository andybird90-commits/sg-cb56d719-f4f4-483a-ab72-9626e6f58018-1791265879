import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, Building2, Briefcase, Target, Calendar, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface MonthlyData {
  month: string;
  revenue: number;
  costs: number;
  margin: number;
}

interface ConversionData {
  month: string;
  count: number;
  value: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  opportunitiesWon: number;
  totalValue: number;
  conversionRate: number;
}

interface CashWaterfallEntry {
  month: string;
  openingCash: number;
  revenue: number;
  outgoings: number;
  vatPayment: number;
  closingCash: number;
}

function AdminDashboardContent() {
  const [financialData, setFinancialData] = useState<MonthlyData[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [yearEndRevenue, setYearEndRevenue] = useState(0);
  const [yearEndCosts, setYearEndCosts] = useState(0);
  const [yearEndMargin, setYearEndMargin] = useState(0);
  const [marginPercent, setMarginPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cashWaterfallData, setCashWaterfallData] = useState<CashWaterfallEntry[]>([]);

  useEffect(() => {
    fetchFinancialTrends();
    fetchConversionData();
    fetchLeaderboardData();
  }, []);

  const fetchFinancialTrends = async () => {
    try {
      const monthlyOutgoings = 165000;

      // Fetch manually phased project revenue for Feb-Dec 2026 (months 2-12)
      const { data: phasing2026, error: phasing2026Error } = await supabase
        .from("project_monthly_phasing")
        .select("month, revenue_amount")
        .eq("year", 2026)
        .gte("month", 2)
        .lte("month", 12);

      if (phasing2026Error) throw phasing2026Error;

      // Fetch manually phased project revenue for Jan 2027 (month 1)
      const { data: phasingJan2027, error: phasingJan2027Error } = await supabase
        .from("project_monthly_phasing")
        .select("month, revenue_amount")
        .eq("year", 2027)
        .eq("month", 1);

      if (phasingJan2027Error) throw phasingJan2027Error;

      // Initialize monthly totals for financial year (Feb 26 - Jan 27)
      const monthlyRevenue: { [key: string]: number } = {};
      const monthNames = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
      
      // Initialize all months to 0
      monthNames.forEach(month => {
        monthlyRevenue[month] = 0;
      });

      // Add Feb-Dec 2026 phasing
      phasing2026?.forEach((entry) => {
        if (entry.revenue_amount && entry.month >= 2 && entry.month <= 12) {
          const monthName = monthNames[entry.month - 2]; // Feb=0, Mar=1, etc.
          monthlyRevenue[monthName] += Number(entry.revenue_amount);
        }
      });

      // Add Jan 2027 phasing
      phasingJan2027?.forEach((entry) => {
        if (entry.revenue_amount) {
          monthlyRevenue["Jan"] += Number(entry.revenue_amount);
        }
      });

      console.log("Monthly revenue totals (Feb 26 - Jan 27):", monthlyRevenue);

      // Calculate total year revenue
      let totalYearRevenue = 0;
      const chartData: MonthlyData[] = [];

      monthNames.forEach((monthName) => {
        const revenue = monthlyRevenue[monthName] || 0;
        totalYearRevenue += revenue;

        chartData.push({
          month: `${monthName} 26`,
          revenue: revenue,
          costs: monthlyOutgoings,
          margin: revenue - monthlyOutgoings,
        });
      });

      console.log("Total year revenue (Feb 26 - Jan 27):", totalYearRevenue);

      // Build cash waterfall starting from £100k opening cash
      const waterfallData: CashWaterfallEntry[] = [];
      let openingCash = 100000;
      let quarterRevenueAccumulator = 0;

      monthNames.forEach((monthName) => {
        const revenue = monthlyRevenue[monthName] || 0;
        quarterRevenueAccumulator += revenue;

        const isQuarterEnd = ["Mar", "Jun", "Sep", "Dec"].includes(monthName);
        let vatPayment = 0;

        if (isQuarterEnd) {
          vatPayment = quarterRevenueAccumulator * 0.2;
          quarterRevenueAccumulator = 0;
        }

        const closingCash = openingCash + revenue - monthlyOutgoings - vatPayment;

        waterfallData.push({
          month: `${monthName} 26`,
          openingCash,
          revenue,
          outgoings: monthlyOutgoings,
          vatPayment,
          closingCash,
        });

        openingCash = closingCash;
      });

      setFinancialData(chartData);
      setYearEndRevenue(totalYearRevenue);
      setYearEndCosts(monthlyOutgoings * 12);
      setYearEndMargin(totalYearRevenue - monthlyOutgoings * 12);
      setMarginPercent(
        totalYearRevenue > 0
          ? ((totalYearRevenue - monthlyOutgoings * 12) / totalYearRevenue) * 100
          : 0
      );
      setCashWaterfallData(waterfallData);
    } catch (error) {
      console.error("Error fetching financial trends:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversionData = async () => {
    try {
      // Fixed: Use opportunity_id instead of converted_from_opportunity_id
      const { data: projects, error } = await supabase
        .from("projects")
        .select("created_at, agreed_fee_value, opportunity_id")
        .not("opportunity_id", "is", null)
        .gte("created_at", "2026-01-01")
        .lt("created_at", "2027-01-01")
        .order("created_at");

      if (error) throw error;

      const monthlyConversions: { [key: string]: { count: number; value: number } } = {};
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      projects?.forEach((project) => {
        const date = new Date(project.created_at);
        const monthKey = `${monthNames[date.getMonth()]} 26`;
        
        if (!monthlyConversions[monthKey]) {
          monthlyConversions[monthKey] = { count: 0, value: 0 };
        }
        
        monthlyConversions[monthKey].count += 1;
        monthlyConversions[monthKey].value += project.agreed_fee_value || 0;
      });

      const chartData: ConversionData[] = monthNames.map((month) => {
        const monthKey = `${month} 26`;
        return {
          month: monthKey,
          count: monthlyConversions[monthKey]?.count || 0,
          value: monthlyConversions[monthKey]?.value || 0,
        };
      });

      setConversionData(chartData);
    } catch (error) {
      console.error("Error fetching conversion data:", error);
    }
  };

  const fetchLeaderboardData = async () => {
    try {
      // Fetch all opportunities with their creators
      const { data: opportunities, error: oppsError } = await supabase
        .from("opportunities")
        .select(`
          id,
          added_by_user_id,
          expected_fee_value,
          stage
        `)
        .not("added_by_user_id", "is", null);

      if (oppsError) throw oppsError;

      // Fetch all projects with their linked opportunities
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select(`
          id,
          opportunity_id,
          agreed_fee_value
        `)
        .not("opportunity_id", "is", null);

      if (projectsError) throw projectsError;

      // Fetch all users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (profilesError) throw profilesError;

      // Create a map of opportunity_id to project
      const projectsByOppId = new Map();
      projects?.forEach((project) => {
        if (project.opportunity_id) {
          projectsByOppId.set(project.opportunity_id, project);
        }
      });

      // Calculate stats by user
      const userStats = new Map<string, {
        userName: string;
        totalOpportunities: number;
        opportunitiesWon: number;
        totalValue: number;
      }>();

      opportunities?.forEach((opp) => {
        const userId = opp.added_by_user_id;
        if (!userId) return;

        const profile = profiles?.find((p) => p.id === userId);
        if (!profile) return;

        if (!userStats.has(userId)) {
          userStats.set(userId, {
            userName: profile.full_name,
            totalOpportunities: 0,
            opportunitiesWon: 0,
            totalValue: 0,
          });
        }

        const stats = userStats.get(userId)!;
        stats.totalOpportunities += 1;

        // Check if this opportunity was converted to a project
        const project = projectsByOppId.get(opp.id);
        if (project) {
          stats.opportunitiesWon += 1;
          stats.totalValue += Number(project.agreed_fee_value || 0);
        }
      });

      // Convert to array and calculate conversion rates
      const leaderboard: LeaderboardEntry[] = Array.from(userStats.entries()).map(
        ([userId, stats]) => ({
          userId,
          userName: stats.userName,
          opportunitiesWon: stats.opportunitiesWon,
          totalValue: stats.totalValue,
          conversionRate:
            stats.totalOpportunities > 0
              ? (stats.opportunitiesWon / stats.totalOpportunities) * 100
              : 0,
        })
      );

      // Sort by total value (descending)
      leaderboard.sort((a, b) => b.totalValue - a.totalValue);

      setLeaderboardData(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard data:", error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Financial overview and business metrics</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">
              <Target className="mr-2 h-4 w-4" />
              Back to Admin
            </Link>
          </Button>
        </div>

        {/* Financial Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Trends (2026)</CardTitle>
            <CardDescription>Revenue, costs, and margin over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={financialData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `£${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="costs" stroke="#ef4444" name="Cost" />
                  <Line type="monotone" dataKey="margin" stroke="#3b82f6" name="Margin" />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Year-End Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-green-600 inline mr-2" />
                Year-End Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                £{yearEndRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Manually phased projects only
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <TrendingDown className="h-4 w-4 text-red-600 inline mr-2" />
                Year-End Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                £{yearEndCosts.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                £165k/month × 12 months
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <DollarSign className="h-4 w-4 text-red-600 inline mr-2" />
                Year-End Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {yearEndMargin >= 0 ? "" : "-"}£{Math.abs(yearEndMargin).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Revenue - Costs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <Target className="h-4 w-4 text-blue-600 inline mr-2" />
                Margin %
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {marginPercent >= 0 ? "" : "-"}{Math.abs(marginPercent).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Profit margin
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cash Waterfall */}
        <Card>
          <CardHeader>
            <CardTitle>Cash Waterfall</CardTitle>
            <CardDescription>
              Opening cash £100,000, secured turnover only, fixed outgoings £165k/month, VAT 20% paid quarterly on turnover.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashWaterfallData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => {
                      if (typeof value !== "number") return value;
                      return `£${value.toLocaleString()}`;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="closingCash"
                    stroke="#2563eb"
                    name="Closing Cash"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Month</th>
                    <th className="text-right py-2 px-3 font-medium">Opening Cash</th>
                    <th className="text-right py-2 px-3 font-medium">Turnover</th>
                    <th className="text-right py-2 px-3 font-medium">Outgoings</th>
                    <th className="text-right py-2 px-3 font-medium">VAT Payment</th>
                    <th className="text-right py-2 px-3 font-medium">Closing Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {cashWaterfallData.map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2 px-3">{row.month}</td>
                      <td className="py-2 px-3 text-right">
                        £{row.openingCash.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        £{row.revenue.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        £{row.outgoings.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        £{row.vatPayment.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        £{row.closingCash.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Opportunities Converted to Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Opportunities Converted to Projects</CardTitle>
            <CardDescription>Monthly conversion count and total value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === "value") return `£${Number(value).toLocaleString()}`;
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Count" />
                  <Bar yAxisId="right" dataKey="value" fill="#f59e0b" name="Value (£)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Leader Board */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Work Winning Leader Board
            </CardTitle>
            <CardDescription>Team performance in converting opportunities to projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Rank</th>
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-right py-3 px-4 font-medium">Opportunities Won</th>
                    <th className="text-right py-3 px-4 font-medium">Total Value</th>
                    <th className="text-right py-3 px-4 font-medium">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    leaderboardData.map((entry, index) => (
                      <tr key={entry.userId} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          {index === 0 && (
                            <span className="text-amber-500 font-bold">🥇</span>
                          )}
                          {index === 1 && (
                            <span className="text-gray-400 font-bold">🥈</span>
                          )}
                          {index === 2 && (
                            <span className="text-orange-600 font-bold">🥉</span>
                          )}
                          {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                        </td>
                        <td className="py-3 px-4 font-medium">{entry.userName}</td>
                        <td className="py-3 px-4 text-right">{entry.opportunitiesWon}</td>
                        <td className="py-3 px-4 text-right font-medium">
                          £{entry.totalValue.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            entry.conversionRate >= 50
                              ? "bg-green-100 text-green-800"
                              : entry.conversionRate >= 25
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {entry.conversionRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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