import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, Building2, Briefcase, Target, Calendar } from "lucide-react";
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

function AdminDashboardContent() {
  const [financialData, setFinancialData] = useState<MonthlyData[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [yearEndRevenue, setYearEndRevenue] = useState(0);
  const [yearEndCosts, setYearEndCosts] = useState(0);
  const [yearEndMargin, setYearEndMargin] = useState(0);
  const [marginPercent, setMarginPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialTrends();
    fetchConversionData();
  }, []);

  const fetchFinancialTrends = async () => {
    try {
      // Fetch manually phased project revenue for 2026
      const { data: phasingData, error: phasingError } = await supabase
        .from("project_monthly_phasing")
        .select(`
          month,
          revenue_amount,
          projects (
            code,
            name
          )
        `)
        .eq("year", 2026);

      if (phasingError) throw phasingError;

      console.log("Manual phasing data for 2026:", phasingData);

      // Group by month and sum revenue
      const monthlyRevenue: { [key: number]: number } = {};
      
      phasingData?.forEach((entry) => {
        const month = entry.month;
        if (!monthlyRevenue[month]) {
          monthlyRevenue[month] = 0;
        }
        monthlyRevenue[month] += entry.revenue_amount || 0;
      });

      console.log("Monthly revenue totals:", monthlyRevenue);

      // Calculate total year revenue from manual phasing only
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
      const { data: projects, error } = await supabase
        .from("projects")
        .select("created_at, agreed_fee_value, converted_from_opportunity_id")
        .not("converted_from_opportunity_id", "is", null)
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