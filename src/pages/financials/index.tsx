import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Project, Timesheet, SubcontractorCost, MonthlyBudget, Profile } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, Users as UsersIcon, Package } from "lucide-react";

interface ProjectFinancials {
  project: Project;
  revenue: number;
  internalCost: number;
  subcontractorCost: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
}

export default function FinancialsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [projectFinancials, setProjectFinancials] = useState<ProjectFinancials[]>([]);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [totals, setTotals] = useState({
    revenue: 0,
    internalCost: 0,
    subcontractorCost: 0,
    totalCost: 0,
    margin: 0,
    marginPercent: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    } else if (user) {
      fetchFinancials();
    }
  }, [user, authLoading, router, selectedYear, selectedMonth]);

  const fetchFinancials = async () => {
    setLoading(true);

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch all live/secured projects
    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .in("status", ["live", "pipeline"]);

    if (!projects) {
      setLoading(false);
      return;
    }

    // Fetch timesheets for the month
    const { data: timesheets } = await supabase
      .from("timesheets")
      .select(`
        *,
        profiles!timesheets_user_id_fkey (
          default_hourly_cost_rate
        )
      `)
      .gte("date", startDateStr)
      .lte("date", endDateStr);

    // Fetch subcontractor costs for the month
    const { data: costs } = await supabase
      .from("subcontractor_costs")
      .select("*")
      .gte("cost_date", startDateStr)
      .lte("cost_date", endDateStr);

    // Fetch budget for the month
    const { data: budgetData } = await supabase
      .from("monthly_budgets")
      .select("*")
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .single();

    setBudget(budgetData);

    // Calculate financials per project
    const financials: ProjectFinancials[] = projects.map((project) => {
      // Revenue: agreed fee allocated to start month (simple v1)
      let revenue = 0;
      if (project.start_date) {
        const projectStartDate = new Date(project.start_date);
        if (
          projectStartDate.getFullYear() === selectedYear &&
          projectStartDate.getMonth() + 1 === selectedMonth
        ) {
          revenue = project.agreed_fee_value || 0;
        }
      }

      // Internal cost from timesheets
      const projectTimesheets = (timesheets || []).filter(
        (ts: any) => ts.project_id === project.id
      );
      const internalCost = projectTimesheets.reduce((sum: number, ts: any) => {
        const rate = ts.profiles?.default_hourly_cost_rate || 0;
        return sum + (ts.hours * rate);
      }, 0);

      // Subcontractor cost
      const projectCosts = (costs || []).filter(
        (c) => c.project_id === project.id
      );
      const subcontractorCost = projectCosts.reduce(
        (sum, c) => sum + c.cost_amount,
        0
      );

      const totalCost = internalCost + subcontractorCost;
      const margin = revenue - totalCost;
      const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

      return {
        project,
        revenue,
        internalCost,
        subcontractorCost,
        totalCost,
        margin,
        marginPercent,
      };
    });

    // Calculate totals
    const totalRevenue = financials.reduce((sum, f) => sum + f.revenue, 0);
    const totalInternalCost = financials.reduce((sum, f) => sum + f.internalCost, 0);
    const totalSubcontractorCost = financials.reduce((sum, f) => sum + f.subcontractorCost, 0);
    const totalCostSum = totalInternalCost + totalSubcontractorCost;
    const totalMargin = totalRevenue - totalCostSum;
    const totalMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    setTotals({
      revenue: totalRevenue,
      internalCost: totalInternalCost,
      subcontractorCost: totalSubcontractorCost,
      totalCost: totalCostSum,
      margin: totalMargin,
      marginPercent: totalMarginPercent,
    });

    setProjectFinancials(financials);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  if (authLoading || loading) {
    return <Layout>Loading...</Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Financial Dashboard</h1>
            <p className="text-slate-600 mt-1">Monthly revenue, costs, and margins</p>
          </div>
          <div className="flex gap-2">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]">
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

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totals.revenue)}
              </div>
              {budget && (
                <p className="text-xs text-slate-500 mt-1">
                  Budget: {formatCurrency(budget.budget_revenue)} (
                  {((totals.revenue / budget.budget_revenue) * 100).toFixed(0)}%)
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Internal Cost</CardTitle>
              <UsersIcon className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(totals.internalCost)}
              </div>
              {budget && budget.budget_cost && (
                <p className="text-xs text-slate-500 mt-1">
                  Budget: {formatCurrency(budget.budget_cost)} (
                  {((totals.internalCost / budget.budget_cost) * 100).toFixed(0)}%)
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Subcontractor Cost</CardTitle>
              <Package className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(totals.subcontractorCost)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Margin</CardTitle>
              {totals.margin >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  totals.margin >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(totals.margin)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totals.marginPercent.toFixed(1)}% margin
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Project Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Project Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {projectFinancials.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No financial data for selected month
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Internal Cost</TableHead>
                    <TableHead className="text-right">Subbie Cost</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectFinancials
                    .filter((f) => f.revenue > 0 || f.totalCost > 0)
                    .map((f) => (
                      <TableRow key={f.project.id}>
                        <TableCell className="font-medium">
                          <div>{f.project.name}</div>
                          <div className="text-xs text-slate-500">{f.project.code}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(f.revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(f.internalCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(f.subcontractorCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(f.totalCost)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            f.margin >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(f.margin)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            f.marginPercent >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {f.marginPercent.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="font-bold bg-slate-50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.internalCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.subcontractorCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.totalCost)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        totals.margin >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(totals.margin)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        totals.marginPercent >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {totals.marginPercent.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}