import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProjectFinancials {
  project_id: string;
  project_code: string;
  project_name: string;
  client_name: string;
  revenue: number;
  internal_cost: number;
  subcontractor_cost: number;
  total_cost: number;
  margin: number;
  margin_percent: number;
}

interface PhasingRow {
  id: string;
  project_id: string;
  year: number;
  month: number;
  revenue_amount: number;
  actual_revenue: number | null;
  invoice_status: string | null;
  invoice_ref: string | null;
  invoice_date: string | null;
}

interface ToInvoiceItem {
  project_id: string;
  project_code: string;
  project_name: string;
  client_name: string;
  year: number;
  month: number;
  actual_revenue: number;
  phasing_id: string;
}

function FinancialsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [revenueMode, setRevenueMode] = useState<"forecast" | "actual">("forecast");
  const [activeTab, setActiveTab] = useState("overview");
  
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalInternalCost, setTotalInternalCost] = useState(0);
  const [totalSubcontractorCost, setTotalSubcontractorCost] = useState(0);
  const [budgetRevenue, setBudgetRevenue] = useState<number | null>(null);
  const [budgetCost, setBudgetCost] = useState<number | null>(null);
  
  const [projectFinancials, setProjectFinancials] = useState<ProjectFinancials[]>([]);
  const [toInvoiceItems, setToInvoiceItems] = useState<ToInvoiceItem[]>([]);
  
  // Invoice marking dialog state
  const [markingInvoice, setMarkingInvoice] = useState<ToInvoiceItem | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_ref: "",
    invoice_date: new Date().toISOString().split("T")[0],
  });

  // Everyone can mark invoices, only directors/admins can modify financial data
  const canModifyFinancials = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchFinancials();
  }, [selectedYear, selectedMonth, revenueMode]);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch budget for selected month
      const { data: budgetData, error: budgetError } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .maybeSingle();

      if (budgetError) throw budgetError;

      setBudgetRevenue(budgetData?.budget_revenue || null);
      setBudgetCost(budgetData?.budget_cost || null);

      // Fetch all projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(`
          id,
          code,
          name,
          status,
          start_date,
          end_date,
          agreed_fee_value,
          client_company_id,
          companies!projects_client_company_id_fkey (
            name
          )
        `)
        .in("status", ["live", "pipeline"]);

      if (projectsError) throw projectsError;

      if (!projectsData) {
        setLoading(false);
        return;
      }

      // Fetch all phasing data for these projects
      const projectIds = projectsData.map(p => p.id);
      const { data: phasingData, error: phasingError } = await supabase
        .from("project_monthly_phasing")
        .select("*")
        .in("project_id", projectIds);

      if (phasingError) throw phasingError;

      const phasingMap = new Map<string, PhasingRow[]>();
      (phasingData || []).forEach((row) => {
        const key = row.project_id;
        if (!phasingMap.has(key)) {
          phasingMap.set(key, []);
        }
        phasingMap.get(key)!.push(row as unknown as PhasingRow);
      });

      // Fetch timesheets for internal cost
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0);

      const { data: timesheetsData, error: timesheetsError } = await supabase
        .from("timesheets")
        .select(`
          hours,
          project_id,
          profiles!timesheets_user_id_fkey (
            default_hourly_cost_rate
          )
        `)
        .in("project_id", projectIds)
        .gte("date", startOfMonth.toISOString().split("T")[0])
        .lte("date", endOfMonth.toISOString().split("T")[0]);

      if (timesheetsError) throw timesheetsError;

      const timesheetsByProject = new Map<string, number>();
      (timesheetsData || []).forEach((ts: any) => {
        const cost = ts.hours * (ts.profiles?.default_hourly_cost_rate || 0);
        timesheetsByProject.set(
          ts.project_id,
          (timesheetsByProject.get(ts.project_id) || 0) + cost
        );
      });

      // Fetch subcontractor costs
      const { data: costsData, error: costsError } = await supabase
        .from("subcontractor_costs")
        .select("project_id, cost_amount")
        .in("project_id", projectIds)
        .gte("cost_date", startOfMonth.toISOString().split("T")[0])
        .lte("cost_date", endOfMonth.toISOString().split("T")[0]);

      if (costsError) throw costsError;

      const subcontractorByProject = new Map<string, number>();
      (costsData || []).forEach((cost) => {
        subcontractorByProject.set(
          cost.project_id,
          (subcontractorByProject.get(cost.project_id) || 0) + cost.cost_amount
        );
      });

      // Calculate revenue for each project based on mode
      const breakdown: ProjectFinancials[] = [];
      let totalRev = 0;
      let totalIntCost = 0;
      let totalSubCost = 0;
      const toInvoice: ToInvoiceItem[] = [];

      for (const project of projectsData) {
        const phasingRows = phasingMap.get(project.id) || [];
        const phasingRow = phasingRows.find(
          (p) => p.year === selectedYear && p.month === selectedMonth
        );

        let projectRevenue = 0;

        if (revenueMode === "forecast") {
          // Forecast mode
          if (phasingRow) {
            projectRevenue = phasingRow.revenue_amount || 0;
          } else {
            // Fallback to automatic spread
            projectRevenue = calculateAutoSpread(project, selectedYear, selectedMonth);
          }
        } else {
          // Actual mode
          if (phasingRow && phasingRow.actual_revenue !== null) {
            projectRevenue = phasingRow.actual_revenue;
          } else {
            projectRevenue = 0;
          }
        }

        const internalCost = timesheetsByProject.get(project.id) || 0;
        const subcontractorCost = subcontractorByProject.get(project.id) || 0;
        const totalCost = internalCost + subcontractorCost;
        const margin = projectRevenue - totalCost;
        const marginPercent = projectRevenue > 0 ? (margin / projectRevenue) * 100 : 0;

        breakdown.push({
          project_id: project.id,
          project_code: project.code,
          project_name: project.name,
          client_name: project.companies?.name || "—",
          revenue: projectRevenue,
          internal_cost: internalCost,
          subcontractor_cost: subcontractorCost,
          total_cost: totalCost,
          margin,
          margin_percent: marginPercent,
        });

        totalRev += projectRevenue;
        totalIntCost += internalCost;
        totalSubCost += subcontractorCost;

        // Check for to_invoice items
        if (
          phasingRow &&
          phasingRow.actual_revenue !== null &&
          phasingRow.actual_revenue > 0 &&
          phasingRow.invoice_status === "to_invoice"
        ) {
          toInvoice.push({
            project_id: project.id,
            project_code: project.code,
            project_name: project.name,
            client_name: project.companies?.name || "—",
            year: selectedYear,
            month: selectedMonth,
            actual_revenue: phasingRow.actual_revenue,
            phasing_id: phasingRow.id,
          });
        }
      }

      setTotalRevenue(totalRev);
      setTotalInternalCost(totalIntCost);
      setTotalSubcontractorCost(totalSubCost);
      setProjectFinancials(breakdown);
      setToInvoiceItems(toInvoice);
    } catch (err) {
      console.error("Failed to load financials data", err);
      setError("Failed to load financial data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const calculateAutoSpread = (project: any, year: number, month: number): number => {
    if (!project.start_date || !project.end_date) return 0;

    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    const targetMonth = new Date(year, month - 1, 1);
    const targetMonthEnd = new Date(year, month, 0);

    if (targetMonth > endDate || targetMonthEnd < startDate) return 0;

    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const monthStart = targetMonth < startDate ? startDate : targetMonth;
    const monthEnd = targetMonthEnd > endDate ? endDate : targetMonthEnd;

    const daysInMonth = Math.ceil(
      (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const totalFee = project.agreed_fee_value || 0;
    return (totalFee / totalDays) * daysInMonth;
  };

  const handleMarkInvoiced = async (item?: ToInvoiceItem) => {
    // If called with an item, open dialog
    if (item) {
      setMarkingInvoice(item);
      return;
    }

    // If called without item, it's the confirm action
    if (!markingInvoice) return;

    const { error } = await supabase
      .from("project_monthly_phasing")
      .update({
        invoice_status: "invoiced",
        invoice_ref: invoiceForm.invoice_ref,
        invoice_date: invoiceForm.invoice_date,
      } as any)
      .eq("id", markingInvoice.phasing_id);

    if (error) {
      alert("Error marking as invoiced: " + error.message);
      return;
    }

    setMarkingInvoice(null);
    setInvoiceForm({
      invoice_ref: "",
      invoice_date: new Date().toISOString().split("T")[0],
    });
    await fetchFinancials();
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleDateString("en-GB", { month: "long" });
  };

  const totalCost = totalInternalCost + totalSubcontractorCost;
  const margin = totalRevenue - totalCost;
  
  const budget = {
    budget_revenue: budgetRevenue,
    budget_cost: budgetCost
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Financials</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Monthly financial overview</p>
          </div>
        </div>

        {/* Month/Year Selector - Stack on mobile */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="month" className="text-xs sm:text-sm">Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger id="month" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date(2000, i, 1);
                      return (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {date.toLocaleDateString("en-GB", { month: "long" })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <Label htmlFor="year" className="text-xs sm:text-sm">Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger id="year" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Forecast/Actual Toggle - Mobile friendly */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50">
            <button
              onClick={() => setRevenueMode("forecast")}
              className={`px-4 sm:px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                revenueMode === "forecast"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Forecast
            </button>
            <button
              onClick={() => setRevenueMode("actual")}
              className={`px-4 sm:px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                revenueMode === "actual"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Actual
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-slate-600">Loading financial data...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Alert variant="destructive" className="max-w-md mx-auto">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={fetchFinancials} 
              variant="outline" 
              size="sm" 
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Summary Cards - Stack on mobile, grid on tablet/desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm text-slate-600">
                      Total Revenue ({revenueMode === "forecast" ? "Forecast" : "Actual"})
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(totalRevenue)}
                    </div>
                    {budget.budget_revenue && (
                      <div className="text-xs text-slate-500">
                        vs Budget: {formatCurrency(budget.budget_revenue)}
                        <span className={totalRevenue >= budget.budget_revenue ? "text-green-600 ml-1" : "text-red-600 ml-1"}>
                          ({totalRevenue >= budget.budget_revenue ? "+" : ""}
                          {(((totalRevenue - budget.budget_revenue) / budget.budget_revenue) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm text-slate-600">Internal Cost</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(totalInternalCost)}
                    </div>
                    {budget.budget_cost && (
                      <div className="text-xs text-slate-500">
                        vs Budget: {formatCurrency(budget.budget_cost)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm text-slate-600">Subcontractor Cost</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(totalSubcontractorCost)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm text-slate-600">Margin</div>
                    <div className={`text-xl sm:text-2xl font-bold ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(margin)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {totalRevenue > 0 ? `${((margin / totalRevenue) * 100).toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for Overview and To Invoice - Mobile friendly */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="overview" className="text-sm sm:text-base">Overview</TabsTrigger>
                <TabsTrigger value="to_invoice" className="text-sm sm:text-base">To Invoice</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                {/* Project Breakdown - Cards on mobile, table on desktop */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Project Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {projectFinancials.length === 0 ? (
                      <div className="text-center py-8 text-slate-600 text-sm">
                        No project data for this month
                      </div>
                    ) : (
                      <>
                        {/* Mobile: Card View */}
                        <div className="block lg:hidden space-y-3">
                          {projectFinancials.map((pf) => (
                            <Card 
                              key={pf.project_id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => router.push(`/projects/${pf.project_id}`)}
                            >
                              <CardContent className="p-4">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-mono text-xs text-slate-500 mb-1">
                                        {pf.project_code}
                                      </div>
                                      <div className="font-semibold text-sm text-slate-900 truncate">
                                        {pf.project_name}
                                      </div>
                                      <div className="text-xs text-slate-600 truncate">
                                        {pf.client_name}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                                    <div>
                                      <span className="text-slate-500">Revenue:</span>
                                      <div className="font-semibold text-slate-900">
                                        {formatCurrency(pf.revenue)}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Cost:</span>
                                      <div className="font-semibold text-slate-900">
                                        {formatCurrency(pf.total_cost)}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Margin:</span>
                                      <div className={`font-semibold ${pf.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {formatCurrency(pf.margin)}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Margin %:</span>
                                      <div className={`font-semibold ${pf.margin_percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {pf.margin_percent.toFixed(1)}%
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {/* Desktop: Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Code</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Project</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Client</th>
                                <th className="text-right p-3 text-sm font-medium text-slate-600">Revenue</th>
                                <th className="text-right p-3 text-sm font-medium text-slate-600">Internal Cost</th>
                                <th className="text-right p-3 text-sm font-medium text-slate-600">Subbie Cost</th>
                                <th className="text-right p-3 text-sm font-medium text-slate-600">Total Cost</th>
                                <th className="text-right p-3 text-sm font-medium text-slate-600">Margin</th>
                                <th className="text-right p-3 text-sm font-medium text-slate-600">Margin %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {projectFinancials.map((pf) => (
                                <tr
                                  key={pf.project_id}
                                  className="border-b hover:bg-slate-50 cursor-pointer"
                                  onClick={() => router.push(`/projects/${pf.project_id}`)}
                                >
                                  <td className="p-3 text-sm font-mono text-slate-600">{pf.project_code}</td>
                                  <td className="p-3 text-sm font-medium text-slate-900">{pf.project_name}</td>
                                  <td className="p-3 text-sm text-slate-600">{pf.client_name}</td>
                                  <td className="p-3 text-sm text-right font-medium">{formatCurrency(pf.revenue)}</td>
                                  <td className="p-3 text-sm text-right">{formatCurrency(pf.internal_cost)}</td>
                                  <td className="p-3 text-sm text-right">{formatCurrency(pf.subcontractor_cost)}</td>
                                  <td className="p-3 text-sm text-right font-medium">{formatCurrency(pf.total_cost)}</td>
                                  <td className={`p-3 text-sm text-right font-semibold ${pf.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {formatCurrency(pf.margin)}
                                  </td>
                                  <td className={`p-3 text-sm text-right font-semibold ${pf.margin_percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {pf.margin_percent.toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="to_invoice" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">
                      To Invoice - {getMonthName(selectedMonth)} {selectedYear}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {toInvoiceItems.length === 0 ? (
                      <div className="text-center py-8 text-slate-600 text-sm">
                        No items ready to invoice for this month
                      </div>
                    ) : (
                      <>
                        {/* Mobile: Card View */}
                        <div className="block lg:hidden space-y-3">
                          {toInvoiceItems.map((item) => (
                            <Card key={item.phasing_id} className="border-orange-200 bg-orange-50">
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div>
                                    <div className="font-mono text-xs text-slate-500 mb-1">
                                      {item.project_code}
                                    </div>
                                    <div className="font-semibold text-sm text-slate-900">
                                      {item.project_name}
                                    </div>
                                    <div className="text-xs text-slate-600 mt-1">
                                      {item.client_name}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t">
                                    <div>
                                      <div className="text-xs text-slate-500">Actual Revenue</div>
                                      <div className="text-lg font-bold text-slate-900">
                                        {formatCurrency(item.actual_revenue)}
                                      </div>
                                    </div>
                                    <Badge className="bg-orange-100 text-orange-800">
                                      To Invoice
                                    </Badge>
                                  </div>

                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkInvoiced(item)}
                                    className="w-full"
                                  >
                                    Mark as Invoiced
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {/* Desktop: Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Code</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Project</th>
                                <th className="text-left p-3 text-sm font-medium text-slate-600">Client</th>
                                <th className="text-right p-3 text-sm font-medium text-slate-600">Actual Revenue</th>
                                <th className="text-center p-3 text-sm font-medium text-slate-600">Status</th>
                                <th className="text-center p-3 text-sm font-medium text-slate-600">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {toInvoiceItems.map((item) => (
                                <tr key={item.phasing_id} className="border-b bg-orange-50">
                                  <td className="p-3 text-sm font-mono text-slate-600">{item.project_code}</td>
                                  <td className="p-3 text-sm font-medium text-slate-900">{item.project_name}</td>
                                  <td className="p-3 text-sm text-slate-600">{item.client_name}</td>
                                  <td className="p-3 text-sm text-right font-semibold">{formatCurrency(item.actual_revenue)}</td>
                                  <td className="p-3 text-center">
                                    <Badge className="bg-orange-100 text-orange-800">To Invoice</Badge>
                                  </td>
                                  <td className="p-3 text-center">
                                    <Button size="sm" onClick={() => handleMarkInvoiced(item)}>
                                      Mark as Invoiced
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-600">Total To Invoice:</span>
                            <span className="text-xl font-bold text-slate-900">
                              {formatCurrency(toInvoiceItems.reduce((sum, item) => sum + item.actual_revenue, 0))}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Mark Invoiced Dialog - Full screen on mobile */}
            <Dialog open={!!markingInvoice} onOpenChange={(open) => !open && setMarkingInvoice(null)}>
              <DialogContent className="w-[95vw] max-w-md">
                <DialogHeader>
                  <DialogTitle>Mark as Invoiced</DialogTitle>
                </DialogHeader>
                {markingInvoice && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-slate-600 mb-2">
                        {markingInvoice.project_code} - {markingInvoice.project_name}
                      </div>
                      <div className="text-lg font-semibold">
                        {formatCurrency(markingInvoice.actual_revenue)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoice_ref">Invoice Reference *</Label>
                      <Input
                        id="invoice_ref"
                        value={invoiceForm.invoice_ref}
                        onChange={(e) =>
                          setInvoiceForm({ ...invoiceForm, invoice_ref: e.target.value })
                        }
                        placeholder="INV-2025-001"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoice_date">Invoice Date *</Label>
                      <Input
                        id="invoice_date"
                        type="date"
                        value={invoiceForm.invoice_date}
                        onChange={(e) =>
                          setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button onClick={() => handleMarkInvoiced()}>Confirm</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMarkingInvoice(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
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