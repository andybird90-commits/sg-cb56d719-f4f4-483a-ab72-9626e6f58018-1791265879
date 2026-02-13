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

function AdminDashboardContent() {
  const [financialData, setFinancialData] = useState<MonthlyData[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [yearEndRevenue, setYearEndRevenue] = useState(0);
  const [yearEndCosts, setYearEndCosts] = useState(0);
  const [yearEndMargin, setYearEndMargin] = useState(0);
  const [marginPercent, setMarginPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialTrends();
    fetchConversionData();
    fetchLeaderboardData();
  }, []);

  const fetchFinancialTrends = async () => {
    try {
      // 1. Fetch manually phased project revenue for 2026
      const { data: projectPhasing, error: projectError } = await supabase
        .from("project_monthly_phasing")
        .select(`
          month,
          revenue_amount
        `)
        .eq("year", 2026);

      if (projectError) throw projectError;

      // 2. Fetch secured opportunities (WIP) that overlap with 2026
      // Logic mirrors the pipeline monthly view
      const { data: opportunities, error: oppsError } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          expected_fee_value,
          expected_start_date,
          expected_end_date,
          stage
        `)
        .eq("stage", "secured")
        .is("archived", false);

      if (oppsError) throw oppsError;

      // Initialize monthly totals
      const monthlyRevenue: { [key: number]: number } = {};
      for (let i = 1; i <= 12; i++) {
        monthlyRevenue[i] = 0;
      }
      
      // Add project phasing (Delivered + Phased WIP)
      projectPhasing?.forEach((entry) => {
        if (entry.revenue_amount) {
          monthlyRevenue[entry.month] += Number(entry.revenue_amount);
        }
      });

      // Add opportunity revenue (Unphased WIP)
      // Only include opportunities that don't have project phasing (to avoid double counting)
      // Note: In a perfect world we'd check if a linked project exists and has phasing,
      // but for now we'll assume opportunities in 'secured' stage are pre-project or unphased
      opportunities?.forEach((opp) => {
        // Skip if no value
        if (!opp.expected_fee_value) return;

        const value = Number(opp.expected_fee_value);
        let startDate = opp.expected_start_date ? new Date(opp.expected_start_date) : new Date(2026, 0, 1);
        
        // If no end date, default to spreading over remainder of year or fixed period
        // For secured opps without dates, spread from Start Date to Dec 2026
        const endDate = opp.expected_end_date ? new Date(opp.expected_end_date) : new Date(2026, 11, 31);
        
        // If start date is before 2026, clamp to Jan 1 2026 for calculation
        if (startDate.getFullYear() < 2026) startDate = new Date(2026, 0, 1);
        
        // If end date is after 2026, clamp to Dec 31 2026 for calculation
        
        const startMonth = startDate.getMonth() + 1; // 1-12
        const endMonth = endDate.getFullYear() > 2026 ? 12 : endDate.getMonth() + 1;
        
        // Only process if overlaps with 2026
        if (startDate.getFullYear() <= 2026 && (endDate.getFullYear() >= 2026)) {
          // Simple distribution: Value / Duration in months
          // Calculate total duration in months (including cross-year)
          const trueStartDate = opp.expected_start_date ? new Date(opp.expected_start_date) : new Date(2026, 0, 1);
          const trueEndDate = opp.expected_end_date ? new Date(opp.expected_end_date) : new Date(2026, 11, 31);
          
          const totalMonths = (trueEndDate.getFullYear() - trueStartDate.getFullYear()) * 12 + 
                             (trueEndDate.getMonth() - trueStartDate.getMonth()) + 1;
          
          const monthlyAmount = value / Math.max(1, totalMonths);
          
          // Add to 2026 months
          for (let m = Math.max(1, startMonth); m <= Math.min(12, endMonth); m++) {
             monthlyRevenue[m] += monthlyAmount;
          }
        }
      });

      console.log("Monthly revenue totals (Projects + Opportunities):", monthlyRevenue);

      // Calculate total year revenue
      let totalYearRevenue = 0;
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const chartData: MonthlyData[] = [];

      for (let i = 0; i < 12; i++) {
        const monthNum = i + 1;
        const revenue = monthlyRevenue[monthNum] || 0;
        totalYearRevenue += revenue;

        chartData.push({
          month: `${monthNames[i]} 26`,
          revenue: revenue,
          costs: 160000, // £160k/month
          margin: revenue - 160000,
        });
      }

      console.log("Total year revenue:", totalYearRevenue);

      setFinancialData(chartData);
      setYearEndRevenue(totalYearRevenue);
      setYearEndCosts(160000 * 12);
      setYearEndMargin(totalYearRevenue - (160000 * 12));
      setMarginPercent(totalYearRevenue > 0 ? ((totalYearRevenue - (160000 * 12)) / totalYearRevenue) * 100 : 0);
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
                £160k/month × 12 months
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