import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GanttItem {
  id: string;
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

  useEffect(() => {
    fetchGanttData();
  }, []);

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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pipeline Gantt</h1>
          <p className="text-slate-600 mt-1">Visual timeline of opportunities and projects</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline View</CardTitle>
          </CardHeader>
          <CardContent>
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
              <>
                {/* Timeline Header */}
                <div className="flex mb-4 pb-2 border-b border-slate-200">
                  <div className="w-48 sm:w-64 flex-shrink-0 font-medium text-sm text-slate-600 pr-2 sm:pr-4">
                    Item
                  </div>
                  <div className="flex-1 flex min-w-0">
                    {timelineMonths.map((month, idx) => (
                      <div
                        key={idx}
                        className="flex-1 text-center text-xs text-slate-500 border-l border-slate-200 px-1"
                        style={{ minWidth: "60px" }}
                      >
                        {month.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gantt Rows */}
                <div className="space-y-3">
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
                        <div className="flex-1 relative h-10 min-w-0">
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

                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-slate-200">
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
              </>
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