import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface GanttItem {
  id: string;
  code?: string;
  name: string;
  companyShortName: string;
  startDate: Date;
  endDate: Date;
  type: "opportunity" | "project";
  stage?: string;
  status?: string;
}

function PipelineGanttContent() {
  const [items, setItems] = useState<GanttItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchGanttData();
  }, []);

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
      pdf.text("Pipeline Report - Gantt View", 148, 20, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 148, 30, { align: "center" });

      // Add Gantt chart data
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text("Project Timeline", 10, 15);
      
      let yPos = 25;
      const lineHeight = 7;
      const pageHeight = 190;

      items.forEach((item, index) => {
        if (yPos > pageHeight) {
          pdf.addPage();
          yPos = 15;
        }

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text(item.name, 10, yPos);
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        yPos += 5;
        
        const details = [
          `Code: ${item.code || "-"}`,
          `Company: ${item.companyShortName}`,
          `Start: ${item.startDate.toLocaleDateString("en-GB")}`,
          `End: ${item.endDate.toLocaleDateString("en-GB")}`,
          `Status: ${item.status || item.stage || "-"}`,
        ];
        
        details.forEach((detail) => {
          if (yPos > pageHeight) {
            pdf.addPage();
            yPos = 15;
          }
          pdf.text(detail, 15, yPos);
          yPos += 4;
        });
        
        yPos += 3;
      });

      // Fetch monthly data
      const { data: projectsData } = await supabase
        .from("projects")
        .select(`
          id,
          code,
          name,
          start_date,
          end_date,
          agreed_fee_value,
          companies!projects_client_company_id_fkey (
            short_name
          )
        `)
        .eq("archived", false)
        .not("start_date", "is", null)
        .not("end_date", "is", null);

      const { data: oppsData } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          expected_start_date,
          expected_end_date,
          expected_fee_value,
          stage,
          companies (
            short_name
          )
        `)
        .not("expected_start_date", "is", null)
        .not("expected_end_date", "is", null);

      // Generate 12 months of data
      const months: Date[] = [];
      const currentDate = new Date();
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        months.push(monthDate);
      }

      // Process each month
      months.forEach((month) => {
        pdf.addPage();
        pdf.setFontSize(18);
        const monthName = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        pdf.text(`Monthly View - ${monthName}`, 148, 15, { align: "center" });

        let yPos = 30;
        let totalTurnover = 0;

        const monthProjects: Array<{
          name: string;
          company: string;
          value: number;
          stage: string;
        }> = [];

        // Process projects
        if (projectsData) {
          projectsData.forEach((project) => {
            const projectStart = new Date(project.start_date!);
            const projectEnd = new Date(project.end_date!);

            if (projectStart <= new Date(month.getFullYear(), month.getMonth() + 1, 0) &&
                projectEnd >= month) {
              const totalMonths = Math.ceil(
                (projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
              );
              const monthlyValue = (project.agreed_fee_value || 0) / Math.max(totalMonths, 1);

              monthProjects.push({
                name: project.name,
                company: (project.companies as any)?.short_name || "Unknown",
                value: monthlyValue,
                stage: "Secured",
              });
              totalTurnover += monthlyValue;
            }
          });
        }

        // Process opportunities
        if (oppsData) {
          oppsData.forEach((opp) => {
            const oppStart = new Date(opp.expected_start_date!);
            const oppEnd = new Date(opp.expected_end_date!);

            if (oppStart <= new Date(month.getFullYear(), month.getMonth() + 1, 0) &&
                oppEnd >= month) {
              const totalMonths = Math.ceil(
                (oppEnd.getTime() - oppStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
              );
              const monthlyValue = (opp.expected_fee_value || 0) / Math.max(totalMonths, 1);

              monthProjects.push({
                name: opp.name,
                company: (opp.companies as any)?.short_name || "Unknown",
                value: monthlyValue,
                stage: opp.stage === "secured" ? "Secured" : opp.stage === "high_potential" ? "High Potential" : "Bid",
              });
              totalTurnover += monthlyValue;
            }
          });
        }

        // Display total
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Total Turnover: £${totalTurnover.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 148, 25, { align: "center" });

        // Display projects
        pdf.setFontSize(10);
        monthProjects.forEach((project) => {
          if (yPos > pageHeight) {
            pdf.addPage();
            pdf.setFontSize(18);
            pdf.text(`${monthName} (continued)`, 148, 15, { align: "center" });
            yPos = 30;
          }

          // Stage badge color
          if (project.stage === "Secured") {
            pdf.setTextColor(34, 197, 94); // green
          } else if (project.stage === "High Potential") {
            pdf.setTextColor(249, 115, 22); // orange
          } else {
            pdf.setTextColor(59, 130, 246); // blue
          }

          pdf.setFont("helvetica", "bold");
          pdf.text(`[${project.stage}]`, 10, yPos);

          pdf.setTextColor(0, 0, 0);
          pdf.setFont("helvetica", "normal");
          pdf.text(project.name, 45, yPos);
          pdf.text(project.company, 150, yPos);
          pdf.text(`£${project.value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 220, yPos);

          yPos += 7;
        });

        if (monthProjects.length === 0) {
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          pdf.text("No projects scheduled for this month", 148, yPos, { align: "center" });
        }
      });

      // Save PDF
      pdf.save(`pipeline-report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const fetchGanttData = async () => {
    try {
      setLoading(true);
      setError(null);

      const ganttItems: GanttItem[] = [];

      // Fetch opportunities
      const { data: oppsData, error: oppsError } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          stage,
          expected_start_date,
          expected_end_date,
          tender_due_date,
          companies (
            short_name,
            name
          )
        `)
        .not("expected_start_date", "is", null)
        .not("expected_end_date", "is", null);

      if (oppsError) throw oppsError;

      if (oppsData) {
        oppsData.forEach((opp) => {
          const startDate = new Date(opp.expected_start_date || opp.tender_due_date || "");
          const endDate = new Date(opp.expected_end_date || "");

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            ganttItems.push({
              id: opp.id,
              name: opp.name,
              companyShortName: opp.companies?.short_name || opp.companies?.name || "",
              startDate,
              endDate,
              type: "opportunity",
              stage: opp.stage,
            });
          }
        });
      }

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(`
          id,
          code,
          name,
          status,
          start_date,
          end_date,
          companies!projects_client_company_id_fkey (
            short_name,
            name
          )
        `)
        .not("start_date", "is", null)
        .not("end_date", "is", null);

      if (projectsError) throw projectsError;

      if (projectsData) {
        projectsData.forEach((proj) => {
          const startDate = new Date(proj.start_date || "");
          const endDate = new Date(proj.end_date || "");

          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            ganttItems.push({
              id: proj.id,
              code: proj.code,
              name: proj.name,
              companyShortName: proj.companies?.short_name || proj.companies?.name || "",
              startDate,
              endDate,
              type: "project",
              status: proj.status,
            });
          }
        });
      }

      // Sort by start date
      ganttItems.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      setItems(ganttItems);
    } catch (err) {
      console.error("Failed to load gantt data", err);
      setError("Failed to load timeline data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (item: GanttItem) => {
    if (item.type === "project") {
      return "bg-green-700";
    }

    switch (item.stage) {
      case "secured":
        return "bg-green-500";
      case "high_potential":
        return "bg-orange-500";
      case "bid":
        return "bg-blue-500";
      default:
        return "bg-slate-500";
    }
  };

  const getTextColor = (item: GanttItem) => {
    if (item.type === "project") {
      return "text-green-700";
    }

    switch (item.stage) {
      case "secured":
        return "text-green-600";
      case "high_potential":
        return "text-orange-600";
      case "bid":
        return "text-blue-600";
      default:
        return "text-slate-600";
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getMonthsBetween = (start: Date, end: Date) => {
    const months = [];
    const current = new Date(start);
    current.setDate(1);

    while (current <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  };

  // Calculate timeline range
  const earliestStart = items.length > 0 
    ? new Date(Math.min(...items.map(i => i.startDate.getTime()))) 
    : new Date();
  const latestEnd = items.length > 0 
    ? new Date(Math.max(...items.map(i => i.endDate.getTime()))) 
    : new Date();

  // Add buffer
  if (items.length > 0) {
    earliestStart.setMonth(earliestStart.getMonth() - 1);
    latestEnd.setMonth(latestEnd.getMonth() + 1);
  }

  const timelineMonths = getMonthsBetween(earliestStart, latestEnd);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Pipeline Gantt</h1>
            <p className="text-slate-600 mt-1">Visual timeline of opportunities and projects</p>
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
            <CardTitle>Timeline View</CardTitle>
          </CardHeader>
          <CardContent id="gantt-view">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-slate-600">Loading timeline...</div>
              </div>
            ) : error ? (
              <Alert variant="destructive" className="my-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-2">No items with dates available</div>
                <p className="text-sm text-slate-600">
                  Add start and end dates to opportunities and projects to see them here.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Scrollable Timeline Container */}
                <div className="overflow-x-auto border rounded-lg">
                  <div style={{ minWidth: `${Math.max(800, timelineMonths.length * 80)}px` }}>
                    {/* Timeline Header */}
                    <div className="flex mb-4 pb-2 border-b border-slate-200">
                      <div className="w-48 sm:w-64 flex-shrink-0 font-medium text-sm text-slate-600 pr-2 sm:pr-4">
                        Item
                      </div>
                      <div className="flex-1 flex">
                        {timelineMonths.map((month, idx) => (
                          <div
                            key={idx}
                            className="flex-1 text-center text-xs text-slate-500 border-l border-slate-200 px-1"
                            style={{ minWidth: "80px" }}
                          >
                            {month.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gantt Rows */}
                    <div className="space-y-3 pb-4">
                      {items.map((item) => {
                        const totalDays = (latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24);
                        const startOffset = (item.startDate.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24);
                        const duration = (item.endDate.getTime() - item.startDate.getTime()) / (1000 * 60 * 60 * 24);

                        const leftPercent = Math.max(0, (startOffset / totalDays) * 100);
                        const widthPercent = Math.max(2, (duration / totalDays) * 100);

                        return (
                          <div key={item.id} className="flex items-center group">
                            <div className="w-48 sm:w-64 flex-shrink-0 pr-2 sm:pr-4">
                              <div className={`text-xs sm:text-sm font-medium ${getTextColor(item)} truncate`}>
                                {item.name}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {item.companyShortName}
                              </div>
                            </div>
                            <div className="flex-1 relative h-10">
                              <div
                                className={`absolute h-7 ${getBarColor(item)} rounded text-white text-xs flex items-center justify-center px-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  minWidth: "40px",
                                }}
                                title={`${item.name}: ${formatDate(item.startDate)} - ${formatDate(item.endDate)}`}
                              >
                                <span className="truncate text-[10px] sm:text-xs">
                                  {widthPercent > 15 ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}` : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="text-sm font-medium text-slate-600 mb-3">Legend:</div>
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-700 rounded shadow-sm"></div>
                      <span className="text-slate-700">Project</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded shadow-sm"></div>
                      <span className="text-slate-700">Secured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded shadow-sm"></div>
                      <span className="text-slate-700">High Potential</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded shadow-sm"></div>
                      <span className="text-slate-700">Bid</span>
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

export default function PipelineGanttPage() {
  return (
    <RequireAuth>
      <PipelineGanttContent />
    </RequireAuth>
  );
}