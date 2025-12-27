import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface MonthlyProject {
  id: string;
  code: string;
  name: string;
  companyShortName: string;
  stage: string;
  turnover: number;
  month: Date;
}

interface MonthData {
  month: Date;
  projects: MonthlyProject[];
  totalTurnover: number;
}

function PipelineMonthlyContent() {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchMonthlyData();
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
      pdf.text("Pipeline Report - Monthly View", 148, 20, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 148, 30, { align: "center" });

      // Generate 12 months of data
      const months: Date[] = [];
      const currentDate = new Date();
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        months.push(monthDate);
      }

      // Fetch data with explicit typing
      const { data: projectsData } = (await supabase
        .from("projects")
        .select("id, code, name, start_date, end_date, agreed_fee_value, companies!projects_client_company_id_fkey(short_name)")
        .eq("archived", false)
        .not("start_date", "is", null)
        .not("end_date", "is", null)) as any;

      const { data: oppsData } = (await supabase
        .from("opportunities")
        .select("id, name, expected_start_date, expected_end_date, expected_fee_value, stage, companies(short_name)")
        .not("expected_start_date", "is", null)
        .not("expected_end_date", "is", null)) as any;

      // Process each month - one page per month
      months.forEach((month, monthIndex) => {
        if (monthIndex > 0) {
          pdf.addPage();
        } else {
          pdf.addPage(); // First month starts on page 2 (after title)
        }

        pdf.setFontSize(18);
        const monthName = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        pdf.text(`Monthly View - ${monthName}`, 148, 15, { align: "center" });

        let yPos = 30;
        let totalTurnover = 0;
        const pageHeight = 190;

        const monthProjects: Array<{
          name: string;
          company: string;
          value: number;
          stage: string;
        }> = [];

        // Process projects
        if (projectsData) {
          projectsData.forEach((project: any) => {
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
                company: project.companies?.short_name || "Unknown",
                value: monthlyValue,
                stage: "Secured",
              });
              totalTurnover += monthlyValue;
            }
          });
        }

        // Process opportunities
        if (oppsData) {
          oppsData.forEach((opp: any) => {
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
                company: opp.companies?.short_name || "Unknown",
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
            pdf.setFontSize(12);
            pdf.setFont("helvetica", "bold");
            pdf.text(`Total Turnover: £${totalTurnover.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 148, 25, { align: "center" });
            yPos = 35;
            pdf.setFontSize(10);
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
          pdf.text(project.name, 55, yPos);
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

  const fetchMonthlyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current date and calculate 12 months range
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 12, 0);

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
        .not("agreed_fee_value", "is", null)
        .gte("end_date", startOfCurrentMonth.toISOString());

      if (projectsError) throw projectsError;

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
            const durationMonths = Math.max(1, 
              (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
              (endDate.getMonth() - startDate.getMonth()) + 1
            );

            const monthlyTurnover = (opp.expected_fee_value || 0) / durationMonths;

            // Add to each relevant month
            months.forEach((monthData) => {
              const monthStart = new Date(monthData.month.getFullYear(), monthData.month.getMonth(), 1);
              const monthEnd = new Date(monthData.month.getFullYear(), monthData.month.getMonth() + 1, 0);

              if (startDate <= monthEnd && endDate >= monthStart) {
                monthData.projects.push({
                  id: opp.id,
                  code: opp.id.substring(0, 8),
                  name: opp.name,
                  companyShortName: opp.companies?.short_name || opp.companies?.name || "",
                  stage: opp.stage,
                  turnover: monthlyTurnover,
                  month: monthData.month,
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
            const durationMonths = Math.max(1, 
              (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
              (endDate.getMonth() - startDate.getMonth()) + 1
            );

            const monthlyTurnover = (proj.agreed_fee_value || 0) / durationMonths;

            // Add to each relevant month
            months.forEach((monthData) => {
              const monthStart = new Date(monthData.month.getFullYear(), monthData.month.getMonth(), 1);
              const monthEnd = new Date(monthData.month.getFullYear(), monthData.month.getMonth() + 1, 0);

              if (startDate <= monthEnd && endDate >= monthStart) {
                monthData.projects.push({
                  id: proj.id,
                  code: proj.code,
                  name: proj.name,
                  companyShortName: proj.companies?.short_name || proj.companies?.name || "",
                  stage: "secured", // Projects are secured
                  turnover: monthlyTurnover,
                  month: monthData.month,
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

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "secured":
        return "bg-green-50 border-green-200 text-green-700";
      case "high_potential":
        return "bg-orange-50 border-orange-200 text-orange-700";
      case "bid":
        return "bg-blue-50 border-blue-200 text-blue-700";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700";
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Monthly Pipeline View</h1>
            <p className="text-slate-600 mt-1">Rolling 12-month view of projects and expected turnover</p>
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
                {/* Scrollable Monthly Columns Container */}
                <div className="overflow-x-auto">
                  <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
                    {monthsData.map((monthData, idx) => (
                      <div key={idx} className="flex-shrink-0" style={{ width: "280px" }}>
                        {/* Month Header */}
                        <div className="bg-slate-100 rounded-t-lg p-3 border-b-2 border-slate-300">
                          <div className="font-semibold text-slate-900 text-center">
                            {formatMonth(monthData.month)}
                          </div>
                          <div className="text-xs text-slate-600 text-center mt-1">
                            {formatCurrency(monthData.totalTurnover)}
                          </div>
                        </div>

                        {/* Projects Column */}
                        <div className="bg-slate-50 rounded-b-lg p-3 min-h-[400px] space-y-2">
                          {monthData.projects.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-8">
                              No projects
                            </div>
                          ) : (
                            monthData.projects.map((project) => (
                              <div
                                key={`${project.id}-${idx}`}
                                className={`border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${getStageColor(project.stage)}`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="text-xs font-mono text-slate-600">
                                    {project.code}
                                  </div>
                                  <Badge className={`text-[10px] px-1.5 py-0.5 ${getStageBadgeColor(project.stage)}`}>
                                    {formatStage(project.stage)}
                                  </Badge>
                                </div>
                                <div className="font-medium text-sm mb-1 line-clamp-2">
                                  {project.name}
                                </div>
                                <div className="text-xs text-slate-600 mb-2">
                                  {project.companyShortName}
                                </div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {formatCurrency(project.turnover)}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="text-sm font-medium text-slate-600 mb-3">Legend:</div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                      <span className="text-slate-700">Secured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded"></div>
                      <span className="text-slate-700">High Potential</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                      <span className="text-slate-700">Bid</span>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-slate-900">
                        {monthsData.reduce((sum, m) => sum + m.totalTurnover, 0) > 0
                          ? formatCurrency(monthsData.reduce((sum, m) => sum + m.totalTurnover, 0))
                          : "£0"}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">Total 12 Months</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-slate-900">
                        {formatCurrency(
                          monthsData.reduce((sum, m) => sum + m.totalTurnover, 0) / 12
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">Average/Month</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-slate-900">
                        {Math.max(...monthsData.map(m => m.totalTurnover)) > 0
                          ? formatCurrency(Math.max(...monthsData.map(m => m.totalTurnover)))
                          : "£0"}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">Peak Month</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-slate-900">
                        {monthsData.reduce((sum, m) => sum + m.projects.length, 0)}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">Total Projects</div>
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