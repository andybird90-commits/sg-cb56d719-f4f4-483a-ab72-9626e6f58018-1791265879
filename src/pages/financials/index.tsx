import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  type: "project" | "opportunity";
  stage: string;
}

function FinancialsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalInternalCost, setTotalInternalCost] = useState(0);
  const [totalSubcontractorCost, setTotalSubcontractorCost] = useState(0);
  const [overhead, setOverhead] = useState(0);
  const [totalStaffCost, setTotalStaffCost] = useState(0);
  const [staffSuspenseCost, setStaffSuspenseCost] = useState(0);
  const [budgetRevenue, setBudgetRevenue] = useState<number | null>(null);
  const [budgetCost, setBudgetCost] = useState<number | null>(null);
  
  const [projectFinancials, setProjectFinancials] = useState<ProjectFinancials[]>([]);

  // Check user role - only directors and admins can access
  useEffect(() => {
    if (profile && profile.role !== "director" && profile.role !== "admin") {
      router.push("/dashboard");
    }
  }, [profile, router]);

  useEffect(() => {
    fetchFinancials();
  }, [selectedYear, selectedMonth]);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch budget data including overhead and total staff cost
      const { data: budgetData, error: budgetError } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .maybeSingle();

      if (budgetError) throw budgetError;

      setBudgetRevenue(budgetData?.budget_revenue || null);
      setBudgetCost(budgetData?.budget_cost || null);
      setOverhead(budgetData?.overhead || 0);
      setTotalStaffCost(budgetData?.total_staff_cost || 0);

      // Define the target month date range
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0);

      // Fetch all LIVE projects
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
        .eq("status", "live")
        .eq("archived", false);

      if (projectsError) throw projectsError;

      // Fetch all SECURED opportunities (matches pipeline logic)
      const { data: opportunitiesData, error: opportunitiesError } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          stage,
          expected_start_date,
          expected_end_date,
          expected_fee_value,
          company_id,
          companies (
            name
          )
        `)
        .eq("stage", "secured")
        .eq("archived", false);

      if (opportunitiesError) throw opportunitiesError;

      // Fetch manual phasing for projects - FOR SELECTED MONTH
      const projectIds = (projectsData || []).map(p => p.id);
      const { data: projPhasingData, error: projPhasingError } = await supabase
        .from("project_monthly_phasing")
        .select("project_id, revenue_amount")
        .in("project_id", projectIds)
        .eq("year", selectedYear)
        .eq("month", selectedMonth);

      if (projPhasingError) throw projPhasingError;

      // Check which projects have ANY manual phasing (to handle 0s correctly)
      const { data: allPhasedProjects, error: allPhasedProjError } = await supabase
        .from("project_monthly_phasing")
        .select("project_id")
        .in("project_id", projectIds);
      
      if (allPhasedProjError) throw allPhasedProjError;
      
      const manuallyPhasedProjectSet = new Set(allPhasedProjects?.map(p => p.project_id));

      // Fetch manual phasing for opportunities - FOR SELECTED MONTH
      const opportunityIds = (opportunitiesData || []).map(o => o.id);
      const { data: oppPhasingData, error: oppPhasingError } = await supabase
        .from("opportunity_monthly_phasing")
        .select("opportunity_id, revenue_amount")
        .in("opportunity_id", opportunityIds)
        .eq("year", selectedYear)
        .eq("month", selectedMonth);

      if (oppPhasingError) throw oppPhasingError;

      // Check which opportunities have ANY manual phasing
      const { data: allPhasedOpps, error: allPhasedOppsError } = await supabase
        .from("opportunity_monthly_phasing")
        .select("opportunity_id")
        .in("opportunity_id", opportunityIds);
        
      if (allPhasedOppsError) throw allPhasedOppsError;
      
      const manuallyPhasedOppSet = new Set(allPhasedOpps?.map(o => o.opportunity_id));

      // Create phasing lookup maps for CURRENT MONTH values
      const projPhasingMap = new Map<string, number>();
      projPhasingData?.forEach(p => {
        projPhasingMap.set(p.project_id, p.revenue_amount || 0);
      });

      const oppPhasingMap = new Map<string, number>();
      oppPhasingData?.forEach(p => {
        oppPhasingMap.set(p.opportunity_id, p.revenue_amount || 0);
      });

      // Combine projects and secured opportunities (same as pipeline)
      const allRevenueItems = [
        ...(projectsData || []).map(p => ({
          id: p.id,
          code: p.code || "—",
          name: p.name,
          client_name: p.companies?.name || "—",
          start_date: p.start_date,
          end_date: p.end_date,
          total_value: p.agreed_fee_value || 0,
          type: "project" as const,
          stage: "secured",
        })),
        ...(opportunitiesData || []).map(o => ({
          id: o.id,
          code: "OPP",
          name: o.name,
          client_name: o.companies?.name || "—",
          start_date: o.expected_start_date,
          end_date: o.expected_end_date,
          total_value: o.expected_fee_value || 0,
          type: "opportunity" as const,
          stage: o.stage,
        }))
      ];

      // Fetch timesheets for internal cost (only for projects)
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

      // Fetch subcontractor costs (only for projects)
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

      // Calculate revenue for each item using date-based distribution (same logic as pipeline)
      const breakdown: ProjectFinancials[] = [];
      let totalRev = 0;
      let totalIntCost = 0;
      let totalSubCost = 0;

      for (const item of allRevenueItems) {
        if (!item.start_date || !item.end_date) continue;

        const startDate = new Date(item.start_date);
        const endDate = new Date(item.end_date);

        // Check if this item overlaps with the selected month (same as pipeline)
        if (endDate < startOfMonth || startDate > endOfMonth) continue;

        // Determine revenue
        let monthlyRevenue: number;
        
        // Check if item has manual phasing enabled (exists in ANY month)
        const isManuallyPhased = item.type === "project" 
          ? manuallyPhasedProjectSet.has(item.id)
          : manuallyPhasedOppSet.has(item.id);
          
        if (isManuallyPhased) {
          // If manually phased, use the value for THIS month (or 0 if not set for this month)
          if (item.type === "project") {
            monthlyRevenue = projPhasingMap.get(item.id) ?? 0;
          } else {
            monthlyRevenue = oppPhasingMap.get(item.id) ?? 0;
          }
        } else {
          // No manual phasing at all - use default calculation
          const durationMonths = Math.max(
            1,
            (endDate.getFullYear() - startDate.getFullYear()) * 12 +
              (endDate.getMonth() - startDate.getMonth()) + 1
          );
          monthlyRevenue = item.total_value / durationMonths;
        }

        // Get costs (only for projects, not opportunities)
        const internalCost = item.type === "project" ? (timesheetsByProject.get(item.id) || 0) : 0;
        const subcontractorCost = item.type === "project" ? (subcontractorByProject.get(item.id) || 0) : 0;
        const totalCost = internalCost + subcontractorCost;
        const margin = monthlyRevenue - totalCost;
        const marginPercent = monthlyRevenue > 0 ? (margin / monthlyRevenue) * 100 : 0;

        breakdown.push({
          project_id: item.id,
          project_code: item.code,
          project_name: item.name,
          client_name: item.client_name,
          revenue: monthlyRevenue,
          internal_cost: internalCost,
          subcontractor_cost: subcontractorCost,
          total_cost: totalCost,
          margin,
          margin_percent: marginPercent,
          type: item.type,
          stage: item.stage,
        });

        totalRev += monthlyRevenue;
        totalIntCost += internalCost;
        totalSubCost += subcontractorCost;
      }

      setTotalRevenue(totalRev);
      setTotalInternalCost(totalIntCost);
      setTotalSubcontractorCost(totalSubCost);
      
      // Calculate staff suspense cost
      const suspense = Math.max(0, (budgetData?.total_staff_cost || 0) - totalIntCost);
      setStaffSuspenseCost(suspense);
      
      setProjectFinancials(breakdown);
    } catch (err) {
      console.error("Failed to load financials data", err);
      setError("Failed to load financial data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatStage = (stage: string) => {
    switch (stage) {
      case "secured":
        return "Secured";
      case "high_potential":
        return "High Potential";
      case "bid":
        return "Bid";
      default:
        return stage;
    }
  };

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case "secured":
        return "bg-green-100 text-green-700";
      case "high_potential":
        return "bg-orange-100 text-orange-700";
      case "bid":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  // Calculate total cost including suspense and overhead
  const totalProjectCost = totalInternalCost + totalSubcontractorCost;
  const totalCostWithOverhead = totalProjectCost + staffSuspenseCost + overhead;
  const margin = totalRevenue - totalCostWithOverhead;
  
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm text-slate-600">
                      Total Revenue
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
                    <div className="text-xs sm:text-sm text-slate-600">Allocated Staff Cost</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(totalInternalCost)}
                    </div>
                    {totalStaffCost > 0 && (
                      <div className="text-xs text-slate-500">
                        of {formatCurrency(totalStaffCost)} total
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm text-slate-600">Staff Suspense Cost</div>
                    <div className="text-xl sm:text-2xl font-bold text-orange-600">
                      {formatCurrency(staffSuspenseCost)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Unallocated staff time
                    </div>
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
                    <div className="text-xs sm:text-sm text-slate-600">Overhead</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(overhead)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Fixed monthly costs
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm text-slate-600">Net Margin</div>
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

            {/* Cost Breakdown Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-slate-600">Allocated Staff Cost</span>
                    <span className="font-semibold">{formatCurrency(totalInternalCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-slate-600">Staff Suspense Cost</span>
                    <span className="font-semibold text-orange-600">{formatCurrency(staffSuspenseCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-slate-600">Subcontractor Cost</span>
                    <span className="font-semibold">{formatCurrency(totalSubcontractorCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-slate-600">Overhead</span>
                    <span className="font-semibold">{formatCurrency(overhead)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-slate-50 px-3 rounded">
                    <span className="text-base font-medium text-slate-900">Total Cost</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(totalCostWithOverhead)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                          onClick={() => {
                            if (pf.type === "project") {
                              router.push(`/projects/${pf.project_id}`);
                            } else {
                              router.push(`/opportunities/${pf.project_id}`);
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="font-mono text-xs text-slate-500">
                                      {pf.project_code}
                                    </div>
                                    <Badge className={`text-[10px] px-1.5 py-0.5 ${getStageBadgeColor(pf.stage)}`}>
                                      {pf.type === "opportunity" ? "Opp" : "Project"}
                                    </Badge>
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
                            <th className="text-center p-3 text-sm font-medium text-slate-600">Type</th>
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
                              onClick={() => {
                                if (pf.type === "project") {
                                  router.push(`/projects/${pf.project_id}`);
                                } else {
                                  router.push(`/opportunities/${pf.project_id}`);
                                }
                              }}
                            >
                              <td className="p-3 text-sm font-mono text-slate-600">{pf.project_code}</td>
                              <td className="p-3 text-sm font-medium text-slate-900">{pf.project_name}</td>
                              <td className="p-3 text-sm text-slate-600">{pf.client_name}</td>
                              <td className="p-3 text-center">
                                <Badge className={`text-[10px] px-2 py-0.5 ${getStageBadgeColor(pf.stage)}`}>
                                  {pf.type === "opportunity" ? "Opp" : "Project"}
                                </Badge>
                              </td>
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