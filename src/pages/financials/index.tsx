import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useRouter } from "next/router";

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

function FinancialsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [financials, setFinancials] = useState<FinancialSummary>({
    total_revenue: 0,
    total_internal_cost: 0,
    total_subcontractor_cost: 0,
    total_margin_value: 0,
    total_margin_percent: 0,
    budget_revenue: null,
    projects: [],
  });

  const isAdmin = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchFinancials();
  }, [selectedYear, selectedMonth]);

  const fetchFinancials = async () => {
    setLoading(true);

    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const monthEnd = new Date(selectedYear, selectedMonth, 0);
    const monthStartStr = monthStart.toISOString().split("T")[0];
    const monthEndStr = monthEnd.toISOString().split("T")[0];

    const projectFinancials: Map<string, ProjectFinancials> = new Map();

    // =====================================================
    // 1. REVENUE PER PROJECT (Pro-rated allocation)
    // =====================================================

    // Fetch all projects
    const { data: projectsData } = await supabase
      .from("projects")
      .select(`
        id,
        code,
        name,
        agreed_fee_value,
        start_date,
        end_date,
        companies!projects_client_company_id_fkey (
          name
        )
      `);

    if (projectsData) {
      for (const project of projectsData) {
        if (!project.start_date || !project.end_date) continue;

        const projectStart = new Date(project.start_date);
        const projectEnd = new Date(project.end_date);

        // Check if project overlaps with selected month
        if (projectEnd < monthStart || projectStart > monthEnd) {
          continue; // No overlap
        }

        // Calculate overlap
        const effectiveStart = projectStart < monthStart ? monthStart : projectStart;
        const effectiveEnd = projectEnd > monthEnd ? monthEnd : projectEnd;

        const totalProjectDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const overlapDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Base fee value
        let totalFee = project.agreed_fee_value || 0;

        // Add accepted variations
        const { data: variationsData } = await supabase
          .from("variations")
          .select("value")
          .eq("project_id", project.id)
          .eq("status", "accepted");

        if (variationsData) {
          totalFee += variationsData.reduce((sum, v) => sum + v.value, 0);
        }

        // Pro-rate revenue for this month
        const monthRevenue = totalFee * (overlapDays / totalProjectDays);

        projectFinancials.set(project.id, {
          project_id: project.id,
          project_code: project.code,
          project_name: project.name,
          client_name: project.companies?.name || "Unknown",
          revenue: monthRevenue,
          internal_cost: 0,
          subcontractor_cost: 0,
          margin_value: 0,
          margin_percent: 0,
        });
      }
    }

    // =====================================================
    // 2. INTERNAL COST PER PROJECT (from timesheets)
    // =====================================================

    const { data: timesheetsData } = await supabase
      .from("timesheets")
      .select(`
        project_id,
        hours,
        profiles (
          default_hourly_cost_rate
        )
      `)
      .gte("date", monthStartStr)
      .lte("date", monthEndStr);

    if (timesheetsData) {
      timesheetsData.forEach((ts) => {
        const rate = ts.profiles?.default_hourly_cost_rate || 0;
        const cost = ts.hours * rate;

        const existing = projectFinancials.get(ts.project_id);
        if (existing) {
          existing.internal_cost += cost;
        } else {
          // Project exists but has no revenue (not in date range)
          // We still want to show costs for projects with activity this month
          projectFinancials.set(ts.project_id, {
            project_id: ts.project_id,
            project_code: "UNKNOWN",
            project_name: "Unknown Project",
            client_name: "Unknown",
            revenue: 0,
            internal_cost: cost,
            subcontractor_cost: 0,
            margin_value: 0,
            margin_percent: 0,
          });
        }
      });
    }

    // Fetch project details for projects that only have costs
    for (const [projectId, projectData] of projectFinancials.entries()) {
      if (projectData.project_code === "UNKNOWN") {
        const { data: projectDetails } = await supabase
          .from("projects")
          .select(`
            code,
            name,
            companies!projects_client_company_id_fkey (
              name
            )
          `)
          .eq("id", projectId)
          .single();

        if (projectDetails) {
          projectData.project_code = projectDetails.code;
          projectData.project_name = projectDetails.name;
          projectData.client_name = projectDetails.companies?.name || "Unknown";
        }
      }
    }

    // =====================================================
    // 3. SUBCONTRACTOR COST PER PROJECT
    // =====================================================

    const { data: costsData } = await supabase
      .from("subcontractor_costs")
      .select("project_id, cost_amount")
      .gte("cost_date", monthStartStr)
      .lte("cost_date", monthEndStr);

    if (costsData) {
      costsData.forEach((cost) => {
        const existing = projectFinancials.get(cost.project_id);
        if (existing) {
          existing.subcontractor_cost += cost.cost_amount;
        } else {
          // Project exists but has no revenue
          projectFinancials.set(cost.project_id, {
            project_id: cost.project_id,
            project_code: "UNKNOWN",
            project_name: "Unknown Project",
            client_name: "Unknown",
            revenue: 0,
            internal_cost: 0,
            subcontractor_cost: cost.cost_amount,
            margin_value: 0,
            margin_percent: 0,
          });
        }
      });
    }

    // Fetch project details for projects that only have subcontractor costs
    for (const [projectId, projectData] of projectFinancials.entries()) {
      if (projectData.project_code === "UNKNOWN") {
        const { data: projectDetails } = await supabase
          .from("projects")
          .select(`
            code,
            name,
            companies!projects_client_company_id_fkey (
              name
            )
          `)
          .eq("id", projectId)
          .single();

        if (projectDetails) {
          projectData.project_code = projectDetails.code;
          projectData.project_name = projectDetails.name;
          projectData.client_name = projectDetails.companies?.name || "Unknown";
        }
      }
    }

    // =====================================================
    // 4. CALCULATE MARGINS PER PROJECT
    // =====================================================

    const projectsArray: ProjectFinancials[] = [];
    let totalRevenue = 0;
    let totalInternalCost = 0;
    let totalSubcontractorCost = 0;

    projectFinancials.forEach((project) => {
      const totalCost = project.internal_cost + project.subcontractor_cost;
      project.margin_value = project.revenue - totalCost;
      project.margin_percent = project.revenue > 0 
        ? (project.margin_value / project.revenue) * 100 
        : 0;

      totalRevenue += project.revenue;
      totalInternalCost += project.internal_cost;
      totalSubcontractorCost += project.subcontractor_cost;

      projectsArray.push(project);
    });

    // Sort by revenue descending
    projectsArray.sort((a, b) => b.revenue - a.revenue);

    // =====================================================
    // 5. FETCH BUDGET
    // =====================================================

    const { data: budgetData } = await supabase
      .from("monthly_budgets")
      .select("budget_revenue")
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .maybeSingle();

    // =====================================================
    // 6. CALCULATE TOTALS
    // =====================================================

    const totalCost = totalInternalCost + totalSubcontractorCost;
    const totalMarginValue = totalRevenue - totalCost;
    const totalMarginPercent = totalRevenue > 0 
      ? (totalMarginValue / totalRevenue) * 100 
      : 0;

    setFinancials({
      total_revenue: totalRevenue,
      total_internal_cost: totalInternalCost,
      total_subcontractor_cost: totalSubcontractorCost,
      total_margin_value: totalMarginValue,
      total_margin_percent: totalMarginPercent,
      budget_revenue: budgetData?.budget_revenue || null,
      projects: projectsArray,
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

  const revenueVariance = financials.budget_revenue 
    ? financials.total_revenue - financials.budget_revenue 
    : null;
  const revenueVariancePercent = financials.budget_revenue && financials.budget_revenue > 0
    ? (revenueVariance! / financials.budget_revenue) * 100
    : null;

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

        {/* Monthly Performance Cards */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Monthly Performance</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(financials.total_revenue)}
                </div>
                {financials.budget_revenue && (
                  <div className="text-xs text-slate-500 mt-1">
                    Budget: {formatCurrency(financials.budget_revenue)}
                    {financials.total_revenue >= financials.budget_revenue ? (
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
                  {formatCurrency(financials.total_internal_cost)}
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
                  {formatCurrency(financials.total_subcontractor_cost)}
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
                <div className={`text-2xl font-bold ${financials.total_margin_value >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(financials.total_margin_value)}
                </div>
                <div className={`text-xs font-medium mt-1 ${financials.total_margin_percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {financials.total_margin_percent.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Revenue vs Budget */}
        {financials.budget_revenue && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue vs Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Actual Revenue</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {formatCurrency(financials.total_revenue)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Budget Revenue</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {formatCurrency(financials.budget_revenue)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Variance</div>
                  <div className={`text-lg font-semibold ${
                    revenueVariance && revenueVariance >= 0 
                      ? "text-green-600" 
                      : "text-red-600"
                  }`}>
                    {revenueVariance !== null && formatCurrency(revenueVariance)}
                    {revenueVariancePercent !== null && (
                      <span className="text-sm ml-2">
                        ({revenueVariancePercent >= 0 ? "+" : ""}{revenueVariancePercent.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
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
            {financials.projects.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                No project activity for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-slate-600">Project</th>
                      <th className="text-left p-3 text-sm font-medium text-slate-600">Client</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-600">Revenue</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-600">Internal Cost</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-600">Subcon Cost</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-600">Margin £</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-600">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financials.projects.map((project) => (
                      <tr 
                        key={project.project_id} 
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.project_id}`)}
                      >
                        <td className="p-3">
                          <div className="font-medium text-slate-900">{project.project_code}</div>
                          <div className="text-sm text-slate-600">{project.project_name}</div>
                        </td>
                        <td className="p-3 text-sm text-slate-700">{project.client_name}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(project.revenue)}</td>
                        <td className="p-3 text-right text-slate-700">{formatCurrency(project.internal_cost)}</td>
                        <td className="p-3 text-right text-slate-700">{formatCurrency(project.subcontractor_cost)}</td>
                        <td className={`p-3 text-right font-medium ${
                          project.margin_value >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {formatCurrency(project.margin_value)}
                        </td>
                        <td className={`p-3 text-right font-medium ${
                          project.margin_percent >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {project.margin_percent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="border-t-2 bg-slate-50 font-semibold">
                      <td className="p-3 text-slate-900" colSpan={2}>TOTALS</td>
                      <td className="p-3 text-right text-slate-900">{formatCurrency(financials.total_revenue)}</td>
                      <td className="p-3 text-right text-slate-900">{formatCurrency(financials.total_internal_cost)}</td>
                      <td className="p-3 text-right text-slate-900">{formatCurrency(financials.total_subcontractor_cost)}</td>
                      <td className={`p-3 text-right ${
                        financials.total_margin_value >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {formatCurrency(financials.total_margin_value)}
                      </td>
                      <td className={`p-3 text-right ${
                        financials.total_margin_percent >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {financials.total_margin_percent.toFixed(1)}%
                      </td>
                    </tr>
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