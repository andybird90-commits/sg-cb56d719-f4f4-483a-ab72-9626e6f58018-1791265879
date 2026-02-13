import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Percent, PoundSterling } from "lucide-react";
import Link from "next/link";

interface MonthlyFinancials {
  month: string;
  revenue: number;
  cost: number;
  margin: number;
}

interface YearEndForecast {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercent: number;
}

interface ConversionData {
  month: string;
  count: number;
  value: number;
}

interface TeamMemberStats {
  userId: string | null;
  userName: string;
  projectCount: number;
  totalValue: number;
}

function AdminDashboardContent() {
  const [financials, setFinancials] = useState<MonthlyFinancials[]>([]);
  const [yearEndForecast, setYearEndForecast] = useState<YearEndForecast | null>(null);
  const [conversions, setConversions] = useState<ConversionData[]>([]);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchFinancialTrends(),
        fetchConversions(),
        fetchTeamStats()
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFinancialTrends() {
    const startMonth = new Date(2026, 0, 1);
    const endMonth = new Date(2026, 11, 31);

    const months = eachMonthOfInterval({
      start: startMonth,
      end: endMonth
    });

    const monthlyData: MonthlyFinancials[] = [];
    const today = new Date();
    
    const FIXED_MONTHLY_COST = 160000;
    let totalYearRevenue = 0;

    console.log("=== REVENUE CALCULATION START (PHASING-ONLY) ===");

    // Get ALL manual phasing data for 2026 in one query
    const { data: allPhasing, error: phasingError } = await supabase
      .from("project_monthly_phasing")
      .select("project_id, year, month, revenue_amount, projects!project_monthly_phasing_project_id_fkey(code, name)")
      .eq("year", 2026);

    if (phasingError) {
      console.error("Phasing query error:", phasingError);
      return;
    }

    // Group phasing by month
    const phasingByMonth = new Map<number, number>();
    allPhasing?.forEach((p: any) => {
      const month = p.month;
      const revenue = Number(p.revenue_amount) || 0;
      phasingByMonth.set(month, (phasingByMonth.get(month) || 0) + revenue);
    });

    for (const month of months) {
      const year = month.getFullYear();
      const monthNum = month.getMonth() + 1;
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const isPastMonth = monthEnd < today;

      let totalRevenue = 0;
      let totalCost = 0;

      console.log(`\n--- ${format(month, "MMM yyyy")} ---`);

      // Use ONLY manually phased revenue from project_monthly_phasing table
      totalRevenue = phasingByMonth.get(monthNum) || 0;
      console.log(`Month ${monthNum} phased revenue: £${totalRevenue.toLocaleString()}`);

      totalYearRevenue += totalRevenue;

      // Cost calculation
      if (isPastMonth) {
        const { data: timesheets } = await supabase
          .from("timesheets")
          .select("hours, profiles!timesheets_user_id_fkey(default_hourly_cost_rate)")
          .gte("date", format(monthStart, "yyyy-MM-dd"))
          .lte("date", format(monthEnd, "yyyy-MM-dd"));

        const { data: subcontractors } = await supabase
          .from("subcontractor_costs")
          .select("cost_amount")
          .gte("cost_date", format(monthStart, "yyyy-MM-dd"))
          .lte("cost_date", format(monthEnd, "yyyy-MM-dd"));

        const { data: budget } = await supabase
          .from("monthly_budgets")
          .select("overhead, total_staff_cost")
          .eq("year", year)
          .eq("month", monthNum)
          .maybeSingle();

        let internalCost = 0;
        timesheets?.forEach(ts => {
          const rate = ts.profiles?.default_hourly_cost_rate || 0;
          internalCost += Number(ts.hours) * Number(rate);
        });

        const subcontractorCost = subcontractors?.reduce((sum, sc) => sum + Number(sc.cost_amount), 0) || 0;
        const overhead = Number(budget?.overhead) || 0;
        const totalStaffCost = Number(budget?.total_staff_cost) || 0;
        const staffSuspense = Math.max(0, totalStaffCost - internalCost);

        totalCost = internalCost + subcontractorCost + staffSuspense + overhead;
        console.log(`Actual cost: £${totalCost.toLocaleString()}`);
      } else {
        totalCost = FIXED_MONTHLY_COST;
        console.log(`Forecast cost: £${FIXED_MONTHLY_COST.toLocaleString()}`);
      }

      monthlyData.push({
        month: format(month, "MMM yy"),
        revenue: totalRevenue,
        cost: totalCost,
        margin: totalRevenue - totalCost
      });
    }

    console.log(`\n=== YEAR-END TOTALS (PHASING-ONLY) ===`);
    console.log(`Total Revenue: £${totalYearRevenue.toLocaleString()}`);
    console.log(`Total Costs: £${(FIXED_MONTHLY_COST * 12).toLocaleString()}`);
    console.log(`=== CALCULATION END ===\n`);

    const forecastTotalCost = FIXED_MONTHLY_COST * 12;
    const forecastMargin = totalYearRevenue - forecastTotalCost;
    const forecastMarginPercent = totalYearRevenue > 0 
      ? (forecastMargin / totalYearRevenue) * 100 
      : 0;

    setYearEndForecast({
      totalRevenue: totalYearRevenue,
      totalCost: forecastTotalCost,
      totalMargin: forecastMargin,
      marginPercent: forecastMarginPercent
    });

    setFinancials(monthlyData);
  }

  async function fetchConversions() {
    const startMonth = new Date(2026, 0, 1);
    const endMonth = new Date();
    if (endMonth.getTime() < new Date(2026, 11, 31).getTime()) {
      endMonth.setTime(new Date(2026, 11, 31).getTime());
    }

    const months = eachMonthOfInterval({
      start: startMonth,
      end: endMonth
    });

    const conversionData: ConversionData[] = [];

    for (const month of months) {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const { data: projects } = await supabase
        .from("projects")
        .select("id, agreed_fee_value, opportunity_id, opportunities!projects_opportunity_id_fkey!inner(stage)")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .not("opportunity_id", "is", null);

      const count = projects?.length || 0;
      const value = projects?.reduce((sum, p) => sum + (Number(p.agreed_fee_value) || 0), 0) || 0;

      conversionData.push({
        month: format(month, "MMM yy"),
        count,
        value
      });
    }

    setConversions(conversionData);
  }

  async function fetchTeamStats() {
    const startDate = "2026-01-01";

    const { data: projects } = await supabase
      .from("projects")
      .select(`
        id,
        agreed_fee_value,
        opportunity_id,
        opportunities!projects_opportunity_id_fkey(added_by_user_id, profiles!opportunities_added_by_user_id_fkey(full_name))
      `)
      .gte("created_at", startDate)
      .not("opportunity_id", "is", null);

    const userMap = new Map<string, TeamMemberStats>();

    projects?.forEach(project => {
      const opp = project.opportunities as any;
      const userId = opp?.added_by_user_id || null;
      const userName = userId ? opp?.profiles?.full_name || "Unknown" : "Anonymous";
      const key = userId || "anonymous";

      if (!userMap.has(key)) {
        userMap.set(key, {
          userId,
          userName,
          projectCount: 0,
          totalValue: 0
        });
      }

      const stats = userMap.get(key)!;
      stats.projectCount += 1;
      stats.totalValue += Number(project.agreed_fee_value) || 0;
    });

    const { data: orphanProjects } = await supabase
      .from("projects")
      .select("id, agreed_fee_value")
      .gte("created_at", startDate)
      .is("opportunity_id", null);

    if (orphanProjects && orphanProjects.length > 0) {
      if (!userMap.has("anonymous")) {
        userMap.set("anonymous", {
          userId: null,
          userName: "Anonymous",
          projectCount: 0,
          totalValue: 0
        });
      }

      const anonymousStats = userMap.get("anonymous")!;
      orphanProjects.forEach(project => {
        anonymousStats.projectCount += 1;
        anonymousStats.totalValue += Number(project.agreed_fee_value) || 0;
      });
    }

    const stats = Array.from(userMap.values()).sort((a, b) => b.totalValue - a.totalValue);
    setTeamStats(stats);
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Trends (2026)</CardTitle>
              <CardDescription>Revenue, costs, and margin over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={financials}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                    domain={[0, 250000]}
                    ticks={[0, 50000, 100000, 150000, 200000, 250000]}
                    tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Cost"
                  />
                  <Line
                    type="monotone"
                    dataKey="margin"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Margin"
                  />
                </LineChart>
              </ResponsiveContainer>

              {yearEndForecast && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Year-End Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(yearEndForecast.totalRevenue)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Manually phased projects only
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <PoundSterling className="h-4 w-4 text-red-600" />
                        Year-End Costs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(yearEndForecast.totalCost)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        £160k/month × 12 months
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {yearEndForecast.totalMargin >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        Year-End Margin
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${yearEndForecast.totalMargin >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {formatCurrency(yearEndForecast.totalMargin)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Revenue - Costs
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Percent className="h-4 w-4 text-purple-600" />
                        Margin %
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${yearEndForecast.marginPercent >= 0 ? "text-purple-600" : "text-red-600"}`}>
                        {yearEndForecast.marginPercent.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Profit margin
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opportunities Converted to Projects</CardTitle>
              <CardDescription>Monthly conversion count and total value</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={conversions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "Value") return formatCurrency(value);
                      return value;
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Count"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="value"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Value"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work Secured by Team Member</CardTitle>
              <CardDescription>
                Cumulative since January 2026 - Projects converted from opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamStats.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No projects converted from opportunities since Jan 2026
                </p>
              ) : (
                <div className="space-y-4">
                  {teamStats.map((member, index) => (
                    <div
                      key={member.userId || "anonymous"}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {member.userName === "Anonymous"
                              ? "?"
                              : member.userName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.projectCount} {member.projectCount === 1 ? "project" : "projects"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          {formatCurrency(member.totalValue)}
                        </p>
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          {index === 0 ? "Top Performer" : `#${index + 1}`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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