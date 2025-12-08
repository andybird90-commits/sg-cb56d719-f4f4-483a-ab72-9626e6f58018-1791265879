import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useRouter } from "next/router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectFinancials {
  project_id: string;
  project_code: string;
  project_name: string;
  client_name: string;
  revenue: number;
  internal_cost: number;
  subcontractor_cost: number;
  margin_value: number;
  margin_percent: number;
}

interface FinancialSummary {
  total_revenue: number;
  total_internal_cost: number;
  total_subcontractor_cost: number;
  total_margin_value: number;
  total_margin_percent: number;
  budget_revenue: number | null;
  projects: ProjectFinancials[];
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [revenueMode, setRevenueMode] = useState<"forecast" | "actual">("forecast");
  
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalInternalCost, setTotalInternalCost] = useState(0);
  const [totalSubcontractorCost, setTotalSubcontractorCost] = useState(0);
  const [budgetRevenue, setBudgetRevenue] = useState<number | null>(null);
  const [budgetCost, setBudgetCost] = useState<number | null>(null);
  
  const [projectBreakdown, setProjectBreakdown] = useState<any[]>([]);
  const [toInvoiceItems, setToInvoiceItems] = useState<ToInvoiceItem[]>([]);
  
  // Invoice marking dialog state
  const [markingInvoice, setMarkingInvoice] = useState<ToInvoiceItem | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_ref: "",
    invoice_date: new Date().toISOString().split("T")[0],
  });

  const canEdit = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchFinancials();
  }, [selectedYear, selectedMonth, revenueMode]);

  const fetchFinancials = async () => {
    setLoading(true);

    // Fetch budget for selected month
    const { data: budgetData } = await supabase
      .from("monthly_budgets")
      .select("*")
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .maybeSingle();

    setBudgetRevenue(budgetData?.budget_revenue || null);
    setBudgetCost(budgetData?.budget_cost || null);

    // Fetch all projects
    const { data: projectsData } = await supabase
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

    if (!projectsData) {
      setLoading(false);
      return;
    }

    // Fetch all phasing data for these projects
    const projectIds = projectsData.map(p => p.id);
    const { data: phasingData } = await supabase
      .from("project_monthly_phasing")
      .select("*")
      .in("project_id", projectIds);

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

    const { data: timesheetsData } = await supabase
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

    const timesheetsByProject = new Map<string, number>();
    (timesheetsData || []).forEach((ts: any) => {
      const cost = ts.hours * (ts.profiles?.default_hourly_cost_rate || 0);
      timesheetsByProject.set(
        ts.project_id,
        (timesheetsByProject.get(ts.project_id) || 0) + cost
      );
    });

    // Fetch subcontractor costs
    const { data: costsData } = await supabase
      .from("subcontractor_costs")
      .select("project_id, cost_amount")
      .in("project_id", projectIds)
      .gte("cost_date", startOfMonth.toISOString().split("T")[0])
      .lte("cost_date", endOfMonth.toISOString().split("T")[0]);

    const subcontractorByProject = new Map<string, number>();
    (costsData || []).forEach((cost) => {
      subcontractorByProject.set(
        cost.project_id,
        (subcontractorByProject.get(cost.project_id) || 0) + cost.cost_amount
      );
    });

    // Calculate revenue for each project based on mode
    const breakdown: any[] = [];
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
    setProjectBreakdown(breakdown);
    setToInvoiceItems(toInvoice);
    setLoading(false);
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

  const handleMarkInvoiced = async () => {
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
  const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

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
            <p className="text-slate-600 mt-1">Monthly financial analysis</p>
          </div>
        </div>

        {/* Month/Year Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>Year:</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label>Month:</Label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => setSelectedMonth(parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {getMonthName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Label>Revenue Mode:</Label>
                <Tabs value={revenueMode} onValueChange={(value) => setRevenueMode(value as "forecast" | "actual")}>
                  <TabsList>
                    <TabsTrigger value="forecast">Forecast</TabsTrigger>
                    <TabsTrigger value="actual">Actual</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Revenue ({revenueMode === "forecast" ? "Forecast" : "Actual"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              {budgetRevenue && (
                <div className="text-xs text-slate-500 mt-1">
                  Budget: {formatCurrency(budgetRevenue)} (
                  {((totalRevenue / budgetRevenue) * 100).toFixed(0)}%)
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Internal Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalInternalCost)}</div>
              {budgetCost && (
                <div className="text-xs text-slate-500 mt-1">
                  Budget: {formatCurrency(budgetCost)} (
                  {((totalInternalCost / budgetCost) * 100).toFixed(0)}%)
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Subcontractor Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSubcontractorCost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(margin)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {marginPercent.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* To Invoice Section */}
        {revenueMode === "actual" && toInvoiceItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>To Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {toInvoiceItems.map((item) => (
                  <div key={item.phasing_id} className="flex items-center justify-between p-4 border rounded-lg bg-orange-50">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {item.project_code} - {item.project_name}
                      </div>
                      <div className="text-sm text-slate-600">{item.client_name}</div>
                      <div className="text-sm text-slate-500 mt-1">
                        {getMonthName(item.month)} {item.year}
                      </div>
                    </div>
                    <div className="text-right mr-4">
                      <div className="text-lg font-semibold text-slate-900">
                        {formatCurrency(item.actual_revenue)}
                      </div>
                      <Badge variant="outline" className="mt-1 text-orange-600 border-orange-300">
                        To Invoice
                      </Badge>
                    </div>
                    {canEdit && (
                      <Dialog
                        open={markingInvoice?.phasing_id === item.phasing_id}
                        onOpenChange={(open) => {
                          if (open) {
                            setMarkingInvoice(item);
                            setInvoiceForm({
                              invoice_ref: "",
                              invoice_date: new Date().toISOString().split("T")[0],
                            });
                          } else {
                            setMarkingInvoice(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm">Mark Invoiced</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Mark as Invoiced</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <div className="text-sm text-slate-600 mb-2">
                                {item.project_code} - {item.project_name}
                              </div>
                              <div className="text-lg font-semibold">
                                {formatCurrency(item.actual_revenue)}
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
                              <Button onClick={handleMarkInvoiced}>Confirm</Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setMarkingInvoice(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Project Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {projectBreakdown.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No projects with activity in {getMonthName(selectedMonth)} {selectedYear}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium text-slate-600">Project</th>
                      <th className="text-left p-2 font-medium text-slate-600">Client</th>
                      <th className="text-right p-2 font-medium text-slate-600">
                        Revenue ({revenueMode === "forecast" ? "Forecast" : "Actual"})
                      </th>
                      <th className="text-right p-2 font-medium text-slate-600">Internal Cost</th>
                      <th className="text-right p-2 font-medium text-slate-600">Subcon Cost</th>
                      <th className="text-right p-2 font-medium text-slate-600">Total Cost</th>
                      <th className="text-right p-2 font-medium text-slate-600">Margin</th>
                      <th className="text-right p-2 font-medium text-slate-600">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectBreakdown.map((row) => (
                      <tr
                        key={row.project_id}
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => router.push(`/projects/${row.project_id}`)}
                      >
                        <td className="p-2">
                          <div className="font-medium text-slate-900">{row.project_code}</div>
                          <div className="text-xs text-slate-600">{row.project_name}</div>
                        </td>
                        <td className="p-2 text-slate-700">{row.client_name}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(row.revenue)}</td>
                        <td className="p-2 text-right">{formatCurrency(row.internal_cost)}</td>
                        <td className="p-2 text-right">{formatCurrency(row.subcontractor_cost)}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(row.total_cost)}</td>
                        <td className={`p-2 text-right font-medium ${row.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(row.margin)}
                        </td>
                        <td className="p-2 text-right">{row.margin_percent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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