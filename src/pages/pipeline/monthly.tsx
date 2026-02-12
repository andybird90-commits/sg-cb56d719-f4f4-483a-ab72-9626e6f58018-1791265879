import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import jsPDF from "jspdf";
import { useRouter } from "next/router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Interfaces ---

interface MonthlyProject {
  id: string;
  code: string;
  name: string;
  companyShortName: string;
  stage: string;
  turnover: number;
  month: Date;
  type: "project" | "opportunity";
  start_date: string;
  end_date: string;
  hasManualPhasing: boolean;
}

interface MonthData {
  month: Date;
  projects: MonthlyProject[];
  totalTurnover: number;
}

interface ProjectCardProps {
  project: MonthlyProject;
  monthIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onShift: (project: MonthlyProject, direction: "left" | "right") => void;
  onClick: (project: MonthlyProject) => void;
}

// --- Helper Functions ---

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatMonth = (date: Date) => {
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
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

// --- Sub-Components ---

function ProjectCard({ project, monthIndex, isFirst, isLast, onShift, onClick }: ProjectCardProps) {
  return (
    <div
      className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onClick(project)}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs font-mono text-slate-600">
          {project.code}
        </div>
        <div className="flex items-center gap-1">
          <Badge className={`text-[10px] px-1.5 py-0.5 ${getStageBadgeColor(project.stage)}`}>
            {formatStage(project.stage)}
          </Badge>
          {project.hasManualPhasing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">M</span>
                </TooltipTrigger>
                <TooltipContent>Manual phasing active</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div className="font-medium text-sm mb-1 line-clamp-2 text-slate-900 dark:text-slate-100">
        {project.name}
      </div>
      <div className="text-xs text-slate-600 mb-2">
        {project.companyShortName}
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {formatCurrency(project.turnover)}
      </div>

      {/* Arrow Navigation */}
      <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShift(project, "left");
                }}
                disabled={isFirst}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500 hover:text-slate-900"
                aria-label="Move back 1 month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Move back 1 month</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShift(project, "right");
                }}
                disabled={isLast}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-500 hover:text-slate-900"
                aria-label="Move forward 1 month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Move forward 1 month</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// --- Main Component ---

function PipelineMonthlyContent() {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchMonthlyData();
  }, []);

  // Sync scrollbars
  useEffect(() => {
    const topScrollContainer = document.getElementById("top-scroll-container");
    const bottomScrollContainer = document.getElementById("bottom-scroll-container");

    if (!topScrollContainer || !bottomScrollContainer) return;

    const syncTopToBottom = () => {
      bottomScrollContainer.scrollLeft = topScrollContainer.scrollLeft;
    };

    const syncBottomToTop = () => {
      topScrollContainer.scrollLeft = bottomScrollContainer.scrollLeft;
    };

    topScrollContainer.addEventListener("scroll", syncTopToBottom);
    bottomScrollContainer.addEventListener("scroll", syncBottomToTop);

    return () => {
      topScrollContainer.removeEventListener("scroll", syncTopToBottom);
      bottomScrollContainer.removeEventListener("scroll", syncBottomToTop);
    };
  }, [monthsData]);

  const fetchMonthlyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current date and calculate 12 months range
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch all opportunities with dates and turnover
      const { data: oppsData, error: oppsError } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          stage,
          expected_start_date,
          expected_end_date,
          tender_due_date,
          expected_fee_value,
          companies (
            short_name,
            name
          )
        `)
        .eq("archived", false)
        .neq("status", "closed_won")
        .neq("status", "closed_lost")
        .not("expected_fee_value", "is", null)
        .gte("expected_end_date", startOfCurrentMonth.toISOString());

      if (oppsError) throw oppsError;

      // Fetch all projects with dates and turnover
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
          companies!projects_client_company_id_fkey (
            short_name,
            name
          )
        `)
        .eq("archived", false)
        .not("agreed_fee_value", "is", null)
        .gte("end_date", startOfCurrentMonth.toISOString());

      if (projectsError) throw projectsError;

      // Fetch all manual phasing for opportunities
      const { data: oppPhasingData, error: oppPhasingError } = await supabase
        .from("opportunity_monthly_phasing")
        .select("opportunity_id, year, month, revenue_amount")
        .gte("year", now.getFullYear())
        .lte("year", now.getFullYear() + 1);

      if (oppPhasingError) throw oppPhasingError;

      // Fetch all manual phasing for projects
      const { data: projPhasingData, error: projPhasingError } = await supabase
        .from("project_monthly_phasing")
        .select("project_id, year, month, revenue_amount")
        .gte("year", now.getFullYear())
        .lte("year", now.getFullYear() + 1);

      if (projPhasingError) throw projPhasingError;

      // Get all projects that have ANY manual phasing entries
      const { data: projectsWithAnyPhasing, error: projectsWithAnyPhasingError } = await supabase
        .from("project_monthly_phasing")
        .select("project_id")
        .not("revenue_amount", "is", null);

      if (projectsWithAnyPhasingError) throw projectsWithAnyPhasingError;

      // Get all opportunities that have ANY manual phasing entries
      const { data: oppsWithAnyPhasing, error: oppsWithAnyPhasingError } = await supabase
        .from("opportunity_monthly_phasing")
        .select("opportunity_id")
        .not("revenue_amount", "is", null);

      if (oppsWithAnyPhasingError) throw oppsWithAnyPhasingError;

      // Create phasing lookup maps
      const oppPhasingMap = new Map<string, Map<string, number>>();
      oppPhasingData?.forEach((p) => {
        if (!oppPhasingMap.has(p.opportunity_id)) {
          oppPhasingMap.set(p.opportunity_id, new Map());
        }
        const key = `${p.year}-${p.month}`;
        oppPhasingMap.get(p.opportunity_id)!.set(key, p.revenue_amount || 0);
      });

      const projPhasingMap = new Map<string, Map<string, number>>();
      projPhasingData?.forEach((p) => {
        if (!projPhasingMap.has(p.project_id)) {
          projPhasingMap.set(p.project_id, new Map());
        }
        const key = `${p.year}-${p.month}`;
        projPhasingMap.get(p.project_id)!.set(key, p.revenue_amount || 0);
      });

      // Create sets of all projects/opportunities that have ANY manual phasing
      const projectsWithAnyPhasingSet = new Set(
        projectsWithAnyPhasing?.map((p) => p.project_id) || []
      );

      const oppsWithAnyPhasingSet = new Set(
        oppsWithAnyPhasing?.map((o) => o.opportunity_id) || []
      );

      // Create 12 months array
      const months: MonthData[] = [];
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push({
          month: monthDate,
          projects: [],
          totalTurnover: 0,
        });
      }

      // Distribute opportunities across months
      if (oppsData) {
        oppsData.forEach((opp) => {
          const startDate = new Date(opp.expected_start_date || opp.tender_due_date || "");
          const endDate = new Date(opp.expected_end_date || "");

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const hasManualPhasing = oppsWithAnyPhasingSet.has(opp.id);
            
            // Calculate default monthly turnover (only used if NO manual phasing at all)
            const durationMonths = Math.max(1, 
              (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
              (endDate.getMonth() - startDate.getMonth()) + 1
            );
            const defaultMonthlyTurnover = (opp.expected_fee_value || 0) / durationMonths;

            // Add to each relevant month
            months.forEach((monthData) => {
              const monthStart = new Date(monthData.month.getFullYear(), monthData.month.getMonth(), 1);
              const monthEnd = new Date(monthData.month.getFullYear(), monthData.month.getMonth() + 1, 0);

              if (startDate <= monthEnd && endDate >= monthStart) {
                // Check if manual phasing exists for this month
                const phasingKey = `${monthData.month.getFullYear()}-${monthData.month.getMonth() + 1}`;
                const manualPhasing = oppPhasingMap.get(opp.id);
                
                // CRITICAL: If opportunity has ANY manual phasing, use 0 for months without values
                // If opportunity has NO manual phasing at all, use the calculated fallback
                const monthlyTurnover = hasManualPhasing 
                  ? (manualPhasing?.get(phasingKey) ?? 0) 
                  : defaultMonthlyTurnover;

                console.log(`Opp ${opp.name} - ${formatMonth(monthData.month)}: hasManualPhasing=${hasManualPhasing}, phasingValue=${manualPhasing?.get(phasingKey)}, monthlyTurnover=${monthlyTurnover}`);

                monthData.projects.push({
                  id: opp.id,
                  code: opp.id.substring(0, 8),
                  name: opp.name,
                  companyShortName: opp.companies?.short_name || opp.companies?.name || "",
                  stage: opp.stage,
                  turnover: monthlyTurnover,
                  month: monthData.month,
                  type: "opportunity",
                  start_date: startDate.toISOString(),
                  end_date: endDate.toISOString(),
                  hasManualPhasing,
                });
                monthData.totalTurnover += monthlyTurnover;
              }
            });
          }
        });
      }

      // Distribute projects across months
      if (projectsData) {
        projectsData.forEach((proj) => {
          const startDate = new Date(proj.start_date || "");
          const endDate = new Date(proj.end_date || "");

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const hasManualPhasing = projectsWithAnyPhasingSet.has(proj.id);
            
            // Calculate default monthly turnover (only used if NO manual phasing at all)
            const durationMonths = Math.max(1, 
              (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
              (endDate.getMonth() - startDate.getMonth()) + 1
            );
            const defaultMonthlyTurnover = (proj.agreed_fee_value || 0) / durationMonths;

            // Add to each relevant month
            months.forEach((monthData) => {
              const monthStart = new Date(monthData.month.getFullYear(), monthData.month.getMonth(), 1);
              const monthEnd = new Date(monthData.month.getFullYear(), monthData.month.getMonth() + 1, 0);

              if (startDate <= monthEnd && endDate >= monthStart) {
                // Check if manual phasing exists for this month
                const phasingKey = `${monthData.month.getFullYear()}-${monthData.month.getMonth() + 1}`;
                const manualPhasing = projPhasingMap.get(proj.id);
                
                // CRITICAL: If project has ANY manual phasing, use 0 for months without values
                // If project has NO manual phasing at all, use the calculated fallback
                const monthlyTurnover = hasManualPhasing 
                  ? (manualPhasing?.get(phasingKey) ?? 0) 
                  : defaultMonthlyTurnover;

                console.log(`Project ${proj.code} - ${formatMonth(monthData.month)}: hasManualPhasing=${hasManualPhasing}, phasingValue=${manualPhasing?.get(phasingKey)}, monthlyTurnover=${monthlyTurnover}`);

                monthData.projects.push({
                  id: proj.id,
                  code: proj.code,
                  name: proj.name,
                  companyShortName: proj.companies?.short_name || proj.companies?.name || "",
                  stage: "secured",
                  turnover: monthlyTurnover,
                  month: monthData.month,
                  type: "project",
                  start_date: startDate.toISOString(),
                  end_date: endDate.toISOString(),
                  hasManualPhasing,
                });
                monthData.totalTurnover += monthlyTurnover;
              }
            });
          }
        });
      }

      setMonthsData(months);

    } catch (err) {
      console.error("Failed to load monthly data", err);
      setError("Failed to load monthly data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (project: MonthlyProject) => {
    if (project.type === "opportunity") {
      router.push(`/opportunities/${project.id}`);
    } else {
      router.push(`/projects/${project.id}`);
    }
  };

  const shiftProject = async (project: MonthlyProject, direction: "left" | "right") => {
    try {
      const monthDiff = direction === "right" ? 1 : -1;
      const currentStart = new Date(project.start_date);
      const currentEnd = new Date(project.end_date);
      
      // Create new dates without mutating the original - use proper date constructor
      const newStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + monthDiff, currentStart.getDate());
      const newEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth() + monthDiff, currentEnd.getDate());

      if (project.type === "opportunity") {
        const { error: updateError } = await supabase
          .from("opportunities")
          .update({
            expected_start_date: newStart.toISOString(),
            expected_end_date: newEnd.toISOString(),
          })
          .eq("id", project.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from("projects")
          .update({
            start_date: newStart.toISOString(),
            end_date: newEnd.toISOString(),
          })
          .eq("id", project.id);
        
        if (updateError) throw updateError;
      }

      await fetchMonthlyData();

    } catch (err) {
      console.error("Failed to shift project dates:", err);
      setError("Failed to shift project dates. Please try again.");
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Title page
      pdf.setFontSize(24);
      pdf.text("Pipeline Report - Monthly View", 148, 20, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 148, 30, { align: "center" });

      // Using the currently loaded data for the PDF to ensure consistency
      monthsData.forEach((monthData, monthIndex) => {
        if (monthIndex > 0) {
          pdf.addPage();
        } else {
          pdf.addPage(); // First month starts on page 2
        }

        pdf.setFontSize(18);
        const monthName = monthData.month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        pdf.text(`Monthly View - ${monthName}`, 148, 15, { align: "center" });

        let yPos = 30;
        const pageHeight = 190;

        // Display total
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Total Turnover: ${formatCurrency(monthData.totalTurnover)}`, 148, 25, { align: "center" });

        // Display projects
        pdf.setFontSize(10);
        monthData.projects.forEach((project) => {
          if (yPos > pageHeight) {
            pdf.addPage();
            pdf.setFontSize(18);
            pdf.text(`${monthName} (continued)`, 148, 15, { align: "center" });
            yPos = 35;
            pdf.setFontSize(10);
          }

          // Stage colors for PDF
          if (project.stage === "secured") {
            pdf.setTextColor(34, 197, 94); // green
          } else if (project.stage === "high_potential") {
            pdf.setTextColor(249, 115, 22); // orange
          } else {
            pdf.setTextColor(59, 130, 246); // blue
          }

          pdf.setFont("helvetica", "bold");
          pdf.text(`[${formatStage(project.stage)}${project.hasManualPhasing ? " M" : ""}]`, 10, yPos);

          pdf.setTextColor(0, 0, 0);
          pdf.setFont("helvetica", "normal");
          pdf.text(project.name, 55, yPos);
          pdf.text(project.companyShortName, 150, yPos);
          pdf.text(formatCurrency(project.turnover), 220, yPos);

          yPos += 7;
        });

        if (monthData.projects.length === 0) {
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          pdf.text("No projects scheduled for this month", 148, yPos, { align: "center" });
        }
      });

      pdf.save(`pipeline-report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Monthly Pipeline View</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Rolling 12-month view of projects and expected turnover</p>
          </div>
          <Button 
            onClick={exportToPDF}
            disabled={exporting || loading}
            variant="outline"
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export to PDF"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expected Monthly Turnover</CardTitle>
          </CardHeader>
          <CardContent id="monthly-view">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-slate-600">Loading monthly data...</div>
              </div>
            ) : error ? (
              <Alert variant="destructive" className="my-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : monthsData.length === 0 || monthsData.every(m => m.projects.length === 0) ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-2">No projects with turnover data</div>
                <p className="text-sm text-slate-600">
                  Add expected values and dates to opportunities and projects to see them here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Top Scrollbar */}
                <div 
                  id="top-scroll-container"
                  className="overflow-x-auto border border-gray-300 rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-600 mb-2"
                  style={{ height: "20px" }}
                >
                  <div 
                    id="top-scroll-spacer"
                    style={{ 
                      width: `${monthsData.length * 280}px`,
                      height: "1px"
                    }}
                  />
                </div>

                {/* Scrollable Monthly Columns Container */}
                <div className="overflow-x-auto" id="bottom-scroll-container">
                  <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
                    {monthsData.map((monthData, idx) => (
                      <div key={idx} className="flex-shrink-0" style={{ width: "280px" }}>
                        {/* Month Header */}
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-t-lg p-3 border-b-2 border-slate-300 dark:border-slate-600">
                          <div className="font-semibold text-slate-900 dark:text-white text-center">
                            {formatMonth(monthData.month)}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 text-center mt-1">
                            {formatCurrency(monthData.totalTurnover)}
                          </div>
                        </div>

                        {/* Projects Column */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-b-lg p-3 min-h-[400px] space-y-2 border border-slate-200 dark:border-slate-700 border-t-0">
                          {monthData.projects.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-8">
                              No projects
                            </div>
                          ) : (
                            monthData.projects.map((project) => (
                              <ProjectCard
                                key={`${project.id}-${idx}`}
                                project={project}
                                monthIndex={idx}
                                isFirst={idx === 0}
                                isLast={idx === monthsData.length - 1}
                                onShift={shiftProject}
                                onClick={handleCardClick}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend and Summary */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Legend:</div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                      <span className="text-slate-700 dark:text-slate-300">Secured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded"></div>
                      <span className="text-slate-700 dark:text-slate-300">High Potential</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                      <span className="text-slate-700 dark:text-slate-300">Bid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">M</span>
                      <span className="text-slate-700 dark:text-slate-300">Manual Phasing Active</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {monthsData.reduce((sum, m) => sum + m.totalTurnover, 0) > 0
                          ? formatCurrency(monthsData.reduce((sum, m) => sum + m.totalTurnover, 0))
                          : "£0"}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Total 12 Months</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(
                          monthsData.reduce((sum, m) => sum + m.totalTurnover, 0) / 12
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Average/Month</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {Math.max(...monthsData.map(m => m.totalTurnover)) > 0
                          ? formatCurrency(Math.max(...monthsData.map(m => m.totalTurnover)))
                          : "£0"}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Peak Month</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function PipelineMonthlyPage() {
  return (
    <RequireAuth>
      <PipelineMonthlyContent />
    </RequireAuth>
  );
}