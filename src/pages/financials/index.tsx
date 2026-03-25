import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { format } from "date-fns";
import { FileText, ChevronRight, ChevronDown } from "lucide-react";

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

interface ProjectDailyEntry {
  id: string;
  date: string;
  hours: number;
  cost: number;
}

interface UserProjectBreakdown {
  project_id: string;
  project_code: string;
  project_name: string;
  hours: number;
  cost: number;
  dailyEntries: ProjectDailyEntry[];
}

interface UserTimeBreakdown {
  user_id: string;
  user_name: string;
  hourly_rate: number;
  total_hours: number;
  total_cost: number;
  projects: UserProjectBreakdown[];
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
  const [userTimesheetBreakdown, setUserTimesheetBreakdown] = useState<UserTimeBreakdown[]>([]);
  const [allSubcontractorCosts, setAllSubcontractorCosts] = useState<any[]>([]);
  const [actualSubcontractorTotal, setActualSubcontractorTotal] = useState(0);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

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
          *,
          companies!client_company_id (
            id,
            name
          )
        `)
        .not("status", "eq", "archived")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch manual phasing for projects - FOR SELECTED MONTH
      const projectIds = (projectsData || []).map(p => p.id);
      let projPhasingData: any[] = [];
      let allPhasedProjects: any[] = [];
      
      if (projectIds.length > 0) {
        const { data, error } = await supabase
          .from("project_monthly_phasing")
          .select("project_id, revenue_amount")
          .in("project_id", projectIds)
          .eq("year", selectedYear)
          .eq("month", selectedMonth);
        if (error) throw error;
        projPhasingData = data || [];

        // Check which projects have ANY manual phasing (to handle 0s correctly)
        const { data: all, error: err } = await supabase
          .from("project_monthly_phasing")
          .select("project_id")
          .in("project_id", projectIds)
          .not("revenue_amount", "is", null);
        if (err) throw err;
        allPhasedProjects = all || [];
      }
      
      const manuallyPhasedProjectSet = new Set(allPhasedProjects.map(p => p.project_id));

      // Create phasing lookup maps for CURRENT MONTH values
      const projPhasingMap = new Map<string, number>();
      projPhasingData.forEach(p => {
        projPhasingMap.set(p.project_id, p.revenue_amount || 0);
      });

      // Combine projects
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
        }))
      ];

      // Fetch timesheets for internal cost (only for projects)
      let timesheetsData: any[] = [];
      if (projectIds.length > 0) {
        const { data, error } = await supabase
          .from("timesheets")
          .select(`
            id,
            date,
            hours,
            project_id,
            user_id,
            profiles!timesheets_user_id_fkey (
              id,
              full_name,
              default_hourly_cost_rate
            )
          `)
          .in("project_id", projectIds)
          .gte("date", startOfMonth.toISOString().split("T")[0])
          .lte("date", endOfMonth.toISOString().split("T")[0]);

        if (error) throw error;
        timesheetsData = data || [];
      }

      const timesheetsByProject = new Map<string, number>();
      timesheetsData.forEach((ts: any) => {
        const cost = ts.hours * (ts.profiles?.default_hourly_cost_rate || 0);
        timesheetsByProject.set(
          ts.project_id,
          (timesheetsByProject.get(ts.project_id) || 0) + cost
        );
      });

      // Build user time breakdown with per-day entries
      const userTimeMap = new Map<string, UserTimeBreakdown>();
      timesheetsData.forEach((ts: any) => {
        const userId = ts.user_id as string;
        const userName = ts.profiles?.full_name || "Unknown User";
        const hourlyRate = ts.profiles?.default_hourly_cost_rate || 0;
        const cost = ts.hours * hourlyRate;
        const date = ts.date as string;

        const project = projectsData?.find((p) => p.id === ts.project_id);
        const projectCode = project?.code || "—";
        const projectName = project?.name || "Unknown Project";

        if (!userTimeMap.has(userId)) {
          userTimeMap.set(userId, {
            user_id: userId,
            user_name: userName,
            hourly_rate: hourlyRate,
            total_hours: 0,
            total_cost: 0,
            projects: [],
          });
        }

        const userBreakdown = userTimeMap.get(userId)!;
        userBreakdown.total_hours += ts.hours;
        userBreakdown.total_cost += cost;

        const existingProject = userBreakdown.projects.find(
          (p) => p.project_id === ts.project_id
        );

        const dailyEntry: ProjectDailyEntry = {
          id: ts.id as string,
          date,
          hours: ts.hours,
          cost,
        };

        if (existingProject) {
          existingProject.hours += ts.hours;
          existingProject.cost += cost;
          existingProject.dailyEntries.push(dailyEntry);
        } else {
          userBreakdown.projects.push({
            project_id: ts.project_id,
            project_code: projectCode,
            project_name: projectName,
            hours: ts.hours,
            cost,
            dailyEntries: [dailyEntry],
          });
        }
      });

      setUserTimesheetBreakdown(Array.from(userTimeMap.values()));

      // Fetch subcontractor costs (only for projects)
      let costsData: any[] = [];
      if (projectIds.length > 0) {
        const { data, error } = await supabase
          .from("subcontractor_costs")
          .select("project_id, cost_amount")
          .in("project_id", projectIds)
          .gte("cost_date", startOfMonth.toISOString().split("T")[0])
          .lte("cost_date", endOfMonth.toISOString().split("T")[0]);

        if (error) throw error;
        costsData = data || [];
      }

      const subcontractorByProject = new Map<string, number>();
      costsData.forEach((cost) => {
        subcontractorByProject.set(
          cost.project_id,
          (subcontractorByProject.get(cost.project_id) || 0) + cost.cost_amount
        );
      });

      // CRITICAL FIX: Also fetch ALL subcontractor costs for the month (including projects outside date range)
      // This gives accurate cash flow view - costs incurred in this month regardless of project timing
      const { data: allCostsData, error: allCostsError } = await supabase
        .from("subcontractor_costs")
        .select(`
          cost_amount,
          cost_date,
          supplier_name,
          description,
          projects!inner (
            id,
            code,
            name,
            status,
            companies!client_company_id (
              name
            )
          )
        `)
        .gte("cost_date", startOfMonth.toISOString().split("T")[0])
        .lte("cost_date", endOfMonth.toISOString().split("T")[0])
        .not("projects.status", "eq", "archived");

      if (allCostsError) throw allCostsError;

      // Calculate total subcontractor costs for the month (actual cash flow)
      const actualSubcontractorCosts = (allCostsData || []).reduce((sum, cost) => sum + cost.cost_amount, 0);

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
        const isManuallyPhased = manuallyPhasedProjectSet.has(item.id);
          
        if (isManuallyPhased) {
          // If manually phased, use the value for THIS month (or 0 if not set for this month)
          monthlyRevenue = projPhasingMap.get(item.id) ?? 0;
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
        const internalCost = timesheetsByProject.get(item.id) || 0;
        const subcontractorCost = subcontractorByProject.get(item.id) || 0;
        const totalCost = internalCost + subcontractorCost;
        
        // Skip items that have exactly £0 revenue and £0 costs to avoid cluttering the table
        if (monthlyRevenue === 0 && totalCost === 0) continue;

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
      setAllSubcontractorCosts(allCostsData || []);
      setActualSubcontractorTotal(actualSubcontractorCosts);
    } catch (err) {
      console.error("Failed to load financials data", err);
      setError("Failed to load financial data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const exportUserTimeBreakdownToPDF = () => {
    const doc = new jsPDF();
    
    const selectedDate = new Date(selectedYear, selectedMonth - 1);
    
    doc.setFontSize(16);
    doc.text("User Time Breakdown - Detailed", 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${format(selectedDate, "MMMM yyyy")}`, 14, 22);

    const tableData: any[] = [];

    userTimesheetBreakdown.forEach((user) => {
      tableData.push([
        user.user_name,
        `£${user.hourly_rate.toFixed(2)}`,
        "",
        "User total",
        "",
        user.total_hours.toFixed(1),
        `£${user.total_cost.toFixed(2)}`
      ]);

      user.projects.forEach((project) => {
        tableData.push([
          "",
          "",
          project.project_code,
          project.project_name,
          "Project total",
          project.hours.toFixed(1),
          `£${project.cost.toFixed(2)}`
        ]);

        const sortedEntries = project.dailyEntries
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date));

        sortedEntries.forEach((entry) => {
          tableData.push([
            "",
            "",
            "",
            "",
            format(new Date(entry.date), "dd/MM/yyyy"),
            entry.hours.toFixed(1),
            `£${entry.cost.toFixed(2)}`
          ]);
        });
      });

      tableData.push(["", "", "", "", "", "", ""]);
    });

    autoTable(doc, {
      startY: 28,
      head: [["User", "Hourly Rate", "Project Code", "Project / Note", "Date", "Hours", "Cost"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 22 },
        3: { cellWidth: 55 },
        4: { cellWidth: 20 },
        5: { cellWidth: 16, halign: "right" },
        6: { cellWidth: 25, halign: "right" }
      }
    });

    doc.save(`user-time-breakdown-detailed-${selectedMonth}-${selectedYear}.pdf`);
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

  const toggleProjectExpansion = (key: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
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
          <Button
            onClick={() => router.push("/finance/intake-invoices")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Intake Invoices
          </Button>
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
                      {formatCurrency(actualSubcontractorTotal)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Costs incurred this month
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
                    <span className="text-sm text-slate-600">Subcontractor Cost (Allocated)</span>
                    <span className="font-semibold">{formatCurrency(totalSubcontractorCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-slate-600">Subcontractor Cost (Actual Incurred)</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(actualSubcontractorTotal)}</span>
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
                                    {formatCurrency(pf.internal_cost)}
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">Code</TableHead>
                            <TableHead className="text-left">Project</TableHead>
                            <TableHead className="text-left">Client</TableHead>
                            <TableHead className="text-center">Type</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Internal Cost</TableHead>
                            <TableHead className="text-right">Subbie Cost</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                            <TableHead className="text-right">Margin %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectFinancials.map((pf) => (
                            <TableRow
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
                              <TableCell className="font-mono text-slate-600">{pf.project_code}</TableCell>
                              <TableCell className="font-medium text-slate-900">{pf.project_name}</TableCell>
                              <TableCell className="text-slate-600">{pf.client_name}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`text-[10px] px-2 py-0.5 ${getStageBadgeColor(pf.stage)}`}>
                                  {pf.type === "opportunity" ? "Opp" : "Project"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(pf.revenue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(pf.internal_cost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(pf.subcontractor_cost)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(pf.total_cost)}</TableCell>
                              <TableCell className={`text-right font-semibold ${pf.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(pf.margin)}
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${pf.margin_percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {pf.margin_percent.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-slate-50 font-semibold">
                            <TableCell colSpan={4} className="text-right">TOTAL</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalInternalCost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalSubcontractorCost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalProjectCost)}</TableCell>
                            <TableCell className={`text-right ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(margin)}
                            </TableCell>
                            <TableCell className={`text-right ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {totalRevenue > 0 ? `${((margin / totalRevenue) * 100).toFixed(1)}%` : "—"}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* User Time Breakdown */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base sm:text-lg">User Time Breakdown</CardTitle>
                  </div>
                  <Button
                    onClick={exportUserTimeBreakdownToPDF}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {userTimesheetBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-sm">
                    No timesheet data for this month
                  </div>
                ) : (
                  <>
                    {/* Mobile: Card View */}
                    <div className="block lg:hidden space-y-4">
                      {userTimesheetBreakdown.map((user) => (
                        <Card key={user.user_id}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="border-b pb-2">
                                <div className="font-semibold text-slate-900">{user.user_name}</div>
                                <div className="text-xs text-slate-500">
                                  {formatCurrency(user.hourly_rate)}/hour
                                </div>
                                <div className="text-sm font-medium text-slate-700 mt-1">
                                  {user.total_hours.toFixed(1)} hrs • {formatCurrency(user.total_cost)}
                                </div>
                              </div>
                              <div className="space-y-2">
                                {user.projects.map((proj) => (
                                  <div key={proj.project_id} className="flex justify-between items-center text-xs">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-mono text-slate-500">{proj.project_code}</div>
                                      <div className="text-slate-700 truncate">{proj.project_name}</div>
                                    </div>
                                    <div className="text-right ml-2">
                                      <div className="font-medium">{proj.hours.toFixed(1)} hrs</div>
                                      <div className="text-slate-600">{formatCurrency(proj.cost)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Desktop: Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">User</TableHead>
                            <TableHead className="text-right">Hourly Rate</TableHead>
                            <TableHead className="text-left">Project Code</TableHead>
                            <TableHead className="text-left">Project Name</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userTimesheetBreakdown.map((user) => {
                            const expandedRowCount = user.projects.reduce(
                              (count, proj) =>
                                count +
                                (expandedProjects[
                                  `${user.user_id}-${proj.project_id}`
                                ]
                                  ? 1
                                  : 0),
                              0
                            );
                            const rowSpan = user.projects.length + expandedRowCount;

                            return (
                              <React.Fragment key={user.user_id}>
                                {user.projects.map((proj, idx) => {
                                  const rowKey = `${user.user_id}-${proj.project_id}`;
                                  const isExpanded = !!expandedProjects[rowKey];

                                  return (
                                    <React.Fragment key={rowKey}>
                                      <TableRow className="hover:bg-slate-50">
                                        {idx === 0 && (
                                          <>
                                            <TableCell
                                              className="font-medium text-slate-900"
                                              rowSpan={rowSpan}
                                            >
                                              {user.user_name}
                                            </TableCell>
                                            <TableCell
                                              className="text-right text-slate-600"
                                              rowSpan={rowSpan}
                                            >
                                              {formatCurrency(user.hourly_rate)}
                                            </TableCell>
                                          </>
                                        )}
                                        <TableCell className="font-mono text-slate-600">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleProjectExpansion(rowKey);
                                            }}
                                            className="mr-2 inline-flex items-center justify-center w-4 h-4 text-slate-500 hover:text-slate-700"
                                            aria-label={
                                              isExpanded
                                                ? "Hide daily breakdown"
                                                : "Show daily breakdown"
                                            }
                                          >
                                            {isExpanded ? (
                                              <ChevronDown className="w-4 h-4" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4" />
                                            )}
                                          </button>
                                          {proj.project_code}
                                        </TableCell>
                                        <TableCell className="text-slate-700">
                                          {proj.project_name}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          {proj.hours.toFixed(1)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          {formatCurrency(proj.cost)}
                                        </TableCell>
                                      </TableRow>
                                      {isExpanded && proj.dailyEntries.length > 0 && (
                                        <TableRow className="bg-slate-50">
                                          <TableCell colSpan={4}>
                                            <div className="px-6 py-3">
                                              <div className="text-xs font-semibold text-slate-600 mb-2">
                                                Daily breakdown
                                              </div>
                                              <div className="grid grid-cols-3 text-xs font-medium text-slate-500 mb-1">
                                                <div>Date</div>
                                                <div className="text-right">
                                                  Hours
                                                </div>
                                                <div className="text-right">
                                                  Cost
                                                </div>
                                              </div>
                                              <div className="space-y-1 text-xs text-slate-700">
                                                {proj.dailyEntries
                                                  .slice()
                                                  .sort((a, b) =>
                                                    a.date.localeCompare(
                                                      b.date
                                                    )
                                                  )
                                                  .map((entry) => (
                                                    <div
                                                      key={entry.id}
                                                      className="grid grid-cols-3"
                                                    >
                                                      <div>
                                                        {new Date(
                                                          entry.date
                                                        ).toLocaleDateString(
                                                          "en-GB"
                                                        )}
                                                      </div>
                                                      <div className="text-right">
                                                        {entry.hours.toFixed(1)}
                                                      </div>
                                                      <div className="text-right">
                                                        {formatCurrency(
                                                          entry.cost
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}
                                              </div>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                                <TableRow className="bg-slate-50">
                                  <TableCell
                                    colSpan={4}
                                    className="text-right font-semibold text-slate-700"
                                  >
                                    {user.user_name} Total
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {user.total_hours.toFixed(1)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatCurrency(user.total_cost)}
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* NEW: Actual Subcontractor Costs Incurred This Month */}
            {allSubcontractorCosts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">
                    Subcontractor Costs Incurred This Month
                  </CardTitle>
                  <CardDescription>
                    All subcontractor costs with dates in this month (regardless of project timing)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Mobile: Card View */}
                  <div className="block lg:hidden space-y-3">
                    {allSubcontractorCosts.map((cost, idx) => (
                      <Card key={idx} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-xs text-slate-500 mb-1">
                                  {cost.projects?.code || "—"}
                                </div>
                                <div className="font-semibold text-sm text-slate-900 truncate">
                                  {cost.projects?.name || "Unknown Project"}
                                </div>
                                <div className="text-xs text-slate-600 truncate">
                                  {cost.projects?.companies?.name || "—"}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                              <div>
                                <span className="text-slate-500">Supplier:</span>
                                <div className="font-semibold text-slate-900 truncate">
                                  {cost.supplier_name}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500">Date:</span>
                                <div className="font-semibold text-slate-900">
                                  {new Date(cost.cost_date).toLocaleDateString("en-GB")}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-500">Amount:</span>
                                <div className="font-bold text-lg text-blue-600">
                                  {formatCurrency(cost.cost_amount)}
                                </div>
                              </div>
                              {cost.description && (
                                <div className="col-span-2">
                                  <span className="text-slate-500">Description:</span>
                                  <div className="text-slate-700 text-xs">
                                    {cost.description}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop: Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">Project Code</TableHead>
                          <TableHead className="text-left">Project Name</TableHead>
                          <TableHead className="text-left">Client</TableHead>
                          <TableHead className="text-left">Supplier</TableHead>
                          <TableHead className="text-left">Date</TableHead>
                          <TableHead className="text-left">Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allSubcontractorCosts.map((cost, idx) => (
                          <TableRow key={idx} className="border-b hover:bg-slate-50">
                            <TableCell className="font-mono text-slate-600">
                              {cost.projects?.code || "—"}
                            </TableCell>
                            <TableCell className="font-medium text-slate-900">
                              {cost.projects?.name || "Unknown Project"}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {cost.projects?.companies?.name || "—"}
                            </TableCell>
                            <TableCell className="font-medium text-slate-700">
                              {cost.supplier_name}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {new Date(cost.cost_date).toLocaleDateString("en-GB")}
                            </TableCell>
                            <TableCell className="text-slate-600 max-w-xs truncate">
                              {cost.description || "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">
                              {formatCurrency(cost.cost_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-blue-50 font-semibold">
                          <TableCell colSpan={6} className="text-right">
                            TOTAL ACTUAL COSTS INCURRED
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            {formatCurrency(actualSubcontractorTotal)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
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