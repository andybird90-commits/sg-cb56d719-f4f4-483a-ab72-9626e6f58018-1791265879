import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown } from "lucide-react";

interface FinancialData {
  revenue: number;
  internalCost: number;
  subcontractorCost: number;
  margin: number;
  marginPercent: number;
  budgetRevenue: number | null;
  budgetCost: number | null;
}

function FinancialsContent() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [financials, setFinancials] = useState<FinancialData>({
    revenue: 0,
    internalCost: 0,
    subcontractorCost: 0,
    margin: 0,
    marginPercent: 0,
    budgetRevenue: null,
    budgetCost: null,
  });

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchFinancials();
  }, [selectedYear, selectedMonth]);

  const fetchFinancials = async () => {
    setLoading(true);

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Calculate Revenue
    let revenue = 0;

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, agreed_fee_value, start_date")
      .gte("start_date", startDateStr)
      .lte("start_date", endDateStr);

    if (projectsData) {
      revenue = projectsData.reduce((sum, p) => sum + (p.agreed_fee_value || 0), 0);

      const projectIds = projectsData.map(p => p.id);
      if (projectIds.length > 0) {
        const { data: variationsData } = await supabase
          .from("variations")
          .select("value, status")
          .in("project_id", projectIds)
          .eq("status", "accepted");

        if (variationsData) {
          revenue += variationsData.reduce((sum, v) => sum + v.value, 0);
        }
      }
    }

    // Calculate Internal Cost
    let internalCost = 0;

    const { data: timesheetsData } = await supabase
      .from("timesheets")
      .select(`
        hours,
        profiles (
          default_hourly_cost_rate
        )
      `)
      .gte("date", startDateStr)
      .lte("date", endDateStr);

    if (timesheetsData) {
      internalCost = timesheetsData.reduce((sum, t) => {
        const rate = t.profiles?.default_hourly_cost_rate || 0;
        return sum + (t.hours * rate);
      }, 0);
    }

    // Calculate Subcontractor Cost
    let subcontractorCost = 0;

    const { data: costsData } = await supabase
      .from("subcontractor_costs")
      .select("cost_amount")
      .gte("cost_date", startDateStr)
      .lte("cost_date", endDateStr);

    if (costsData) {
      subcontractorCost = costsData.reduce((sum, c) => sum + c.cost_amount, 0);
    }

    // Get Budget
    const { data: budgetData } = await supabase
      .from("monthly_budgets")
      .select("budget_revenue, budget_cost")
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .maybeSingle();

    const totalCost = internalCost + subcontractorCost;
    const margin = revenue - totalCost;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

    setFinancials({
      revenue,
      internalCost,
      subcontractorCost,
      margin,
      marginPercent,
      budgetRevenue: budgetData?.budget_revenue || null,
      budgetCost: budgetData?.budget_cost || null,
    });

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleDateString("en-GB", { month: "long" });
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Financial Dashboard</h1>
            <p className="text-slate-600 mt-1">Monthly revenue, costs, and margins</p>
          </div>
          <div className="flex gap-3">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {getMonthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(financials.revenue)}
              </div>
              {financials.budgetRevenue && (
                <div className="text-xs text-slate-500 mt-1">
                  Budget: {formatCurrency(financials.budgetRevenue)}
                  {financials.revenue >= financials.budgetRevenue ? (
                    <TrendingUp className="inline w-3 h-3 ml-1 text-green-600" />
                  ) : (
                    <TrendingDown className="inline w-3 h-3 ml-1 text-red-600" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Internal Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(financials.internalCost)}
              </div>
              {isAdmin && (
                <div className="text-xs text-slate-500 mt-1">
                  From timesheet hours
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Subcontractor Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(financials.subcontractorCost)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                External suppliers
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${financials.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(financials.margin)}
              </div>
              <div className={`text-xs font-medium mt-1 ${financials.marginPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                {financials.marginPercent.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {financials.budgetCost && (
          <Card>
            <CardHeader>
              <CardTitle>Budget Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Total Cost vs Budget</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {formatCurrency(financials.internalCost + financials.subcontractorCost)}
                  </div>
                  <div className="text-sm text-slate-500">
                    Budget: {formatCurrency(financials.budgetCost)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Variance</div>
                  <div className={`text-lg font-semibold ${
                    (financials.internalCost + financials.subcontractorCost) <= financials.budgetCost 
                      ? "text-green-600" 
                      : "text-red-600"
                  }`}>
                    {formatCurrency(financials.budgetCost - (financials.internalCost + financials.subcontractorCost))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export default function FinancialsPage() {
  return (
    <RequireAuth>
      <FinancialsContent />
    </RequireAuth>
  );
}