import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface MonthlyFinancials {
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

interface TeamMemberStats {
  userId: string | null;
  userName: string;
  projectCount: number;
  totalValue: number;
}

function AdminDashboardContent() {
  const [financials, setFinancials] = useState<MonthlyFinancials[]>([]);
  const [conversions, setConversions] = useState<ConversionData[]>([]);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth]);

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
    const months = eachMonthOfInterval({
      start: new Date(2026, 0, 1), // January 2026
      end: new Date()
    });

    const monthlyData: MonthlyFinancials[] = [];

    for (const month of months) {
      const year = month.getFullYear();
      const monthNum = month.getMonth() + 1;
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Get revenue from live projects and secured opportunities
      const { data: projects } = await supabase
        .from("projects")
        .select("id, agreed_fee_value, start_date, end_date, project_monthly_phasing(revenue_amount, year, month)")
        .eq("status", "live")
        .or(`and(start_date.lte.${format(monthEnd, "yyyy-MM-dd")},end_date.gte.${format(monthStart, "yyyy-MM-dd")}),start_date.is.null,end_date.is.null`);

      const { data: opportunities } = await supabase
        .from("opportunities")
        .select("id, expected_fee_value, expected_start_date, expected_end_date, opportunity_monthly_phasing(revenue_amount, year, month)")
        .eq("stage", "secured")
        .or(`and(expected_start_date.lte.${format(monthEnd, "yyyy-MM-dd")},expected_end_date.gte.${format(monthStart, "yyyy-MM-dd")}),expected_start_date.is.null,expected_end_date.is.null`);

      let totalRevenue = 0;

      // Calculate project revenue
      projects?.forEach(project => {
        const phasing = Array.isArray(project.project_monthly_phasing) ? project.project_monthly_phasing : [];
        const monthPhasing = phasing.find((p: any) => p.year === year && p.month === monthNum);
        
        if (monthPhasing) {
          totalRevenue += Number(monthPhasing.revenue_amount) || 0;
        } else if (project.agreed_fee_value && project.start_date && project.end_date) {
          const start = new Date(project.start_date);
          const end = new Date(project.end_date);
          const durationMonths = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
          totalRevenue += Number(project.agreed_fee_value) / durationMonths;
        }
      });

      // Calculate opportunity revenue
      opportunities?.forEach(opp => {
        const phasing = Array.isArray(opp.opportunity_monthly_phasing) ? opp.opportunity_monthly_phasing : [];
        const monthPhasing = phasing.find((p: any) => p.year === year && p.month === monthNum);
        
        if (monthPhasing) {
          totalRevenue += Number(monthPhasing.revenue_amount) || 0;
        } else if (opp.expected_fee_value && opp.expected_start_date && opp.expected_end_date) {
          const start = new Date(opp.expected_start_date);
          const end = new Date(opp.expected_end_date);
          const durationMonths = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
          totalRevenue += Number(opp.expected_fee_value) / durationMonths;
        }
      });

      // Get costs
      const { data: timesheets } = await supabase
        .from("timesheets")
        .select("hours, profiles!inner(default_hourly_cost_rate)")
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

      const totalCost = internalCost + subcontractorCost + staffSuspense + overhead;

      monthlyData.push({
        month: format(month, "MMM yy"),
        revenue: totalRevenue,
        cost: totalCost,
        margin: totalRevenue - totalCost
      });
    }

    setFinancials(monthlyData);
  }

  async function fetchConversions() {
    const months = eachMonthOfInterval({
      start: new Date(2026, 0, 1), // January 2026
      end: new Date()
    });

    const conversionData: ConversionData[] = [];

    for (const month of months) {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Find projects created in this month that are linked to opportunities
      const { data: projects } = await supabase
        .from("projects")
        .select("id, agreed_fee_value, opportunity_id, opportunities!inner(stage)")
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
    const year = selectedMonth.getFullYear();
    const monthNum = selectedMonth.getMonth() + 1;
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    // Get projects created this month with their opportunities
    const { data: projects } = await supabase
      .from("projects")
      .select(`
        id,
        agreed_fee_value,
        opportunity_id,
        opportunities!projects_opportunity_id_fkey(added_by_user_id, profiles!inner(full_name))
      `)
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString())
      .not("opportunity_id", "is", null);

    // Group by user
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

    // Get projects without opportunities (anonymous)
    const { data: orphanProjects } = await supabase
      .from("projects")
      .select("id, agreed_fee_value")
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString())
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
          {/* Financial Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Trends (Last 12 Months)</CardTitle>
              <CardDescription>Revenue, costs, and margin over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={financials}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
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
            </CardContent>
          </Card>

          {/* Opportunity Conversions */}
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

          {/* Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Work Secured by Team Member</CardTitle>
              <CardDescription>
                {format(selectedMonth, "MMMM yyyy")} - Projects converted from opportunities
              </CardDescription>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                >
                  Previous Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                  disabled={format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM")}
                >
                  Current Month
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {teamStats.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No projects converted from opportunities this month
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