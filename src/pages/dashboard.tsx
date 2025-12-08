import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Target, ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MonthPipeline {
  month: string;
  secured: number;
  highPotential: number;
  bid: number;
  budget: number;
}

interface CurrentAbsence {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  profiles?: {
    full_name: string;
  };
}

function DashboardContent() {
  const router = useRouter();
  const [pipelineData, setPipelineData] = useState<MonthPipeline[]>([]);
  const [currentAbsences, setCurrentAbsences] = useState<CurrentAbsence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPipelineData();
    fetchCurrentAbsences();
  }, []);

  const fetchPipelineData = async () => {
    const months: MonthPipeline[] = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const monthStart = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const monthEnd = new Date(year, month, 0).toISOString().split("T")[0];

      // Get opportunities for this month
      const { data: oppsData } = await supabase
        .from("opportunities")
        .select("stage, expected_fee_value, expected_start_date")
        .gte("expected_start_date", monthStart)
        .lte("expected_start_date", monthEnd);

      let secured = 0;
      let highPotential = 0;
      let bid = 0;

      if (oppsData) {
        oppsData.forEach((opp) => {
          const value = opp.expected_fee_value || 0;
          if (opp.stage === "secured") secured += value;
          else if (opp.stage === "high_potential") highPotential += value;
          else if (opp.stage === "bid") bid += value;
        });
      }

      // Get budget for this month
      const { data: budgetData } = await supabase
        .from("monthly_budgets")
        .select("budget_revenue")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      months.push({
        month: monthDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        secured,
        highPotential,
        bid,
        budget: budgetData?.budget_revenue || 0,
      });
    }

    setPipelineData(months);
    setLoading(false);
  };

  const fetchCurrentAbsences = async () => {
    // Get current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayStr = monday.toISOString().split("T")[0];
    const sundayStr = sunday.toISOString().split("T")[0];

    // Fetch absences that overlap with current week
    const { data } = await supabase
      .from("absences")
      .select(`
        *,
        profiles!absences_user_id_fkey (
          full_name
        )
      `)
      .not("approved_by", "is", null)
      .or(`and(start_date.lte.${sundayStr},end_date.gte.${mondayStr})`);

    setCurrentAbsences(data || []);
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return "£0";
    if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `£${(value / 1000).toFixed(0)}k`;
    return `£${value.toFixed(0)}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "holiday":
        return "bg-blue-100 text-blue-800";
      case "sick":
        return "bg-red-100 text-red-800";
      case "other":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const maxValue = Math.max(
    ...pipelineData.map(m => m.secured + m.highPotential + m.bid + m.budget)
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome to Conexa DT</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card 
            onClick={() => router.push("/companies")} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-blue-600" />
                <CardTitle>Companies</CardTitle>
              </div>
              <CardDescription>Manage your client companies</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                View and manage all companies in your CRM system.
              </p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => router.push("/contacts")} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-green-600" />
                <CardTitle>Contacts</CardTitle>
              </div>
              <CardDescription>Manage your contacts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Access and organize all your business contacts.
              </p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => router.push("/opportunities")} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-purple-600" />
                <CardTitle>Opportunities</CardTitle>
              </div>
              <CardDescription>Track sales pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Monitor and manage your sales opportunities.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Who's Off This Week Widget */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-600" />
              <CardTitle>Who's Off This Week</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {currentAbsences.length === 0 ? (
              <div className="text-center py-4 text-slate-600">
                No current absences this week.
              </div>
            ) : (
              <div className="space-y-2">
                {currentAbsences.map((absence) => (
                  <div key={absence.id} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-slate-900">
                        {absence.profiles?.full_name}
                      </div>
                      <Badge className={getTypeColor(absence.type)}>
                        {absence.type}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600">
                      {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>12-Month Pipeline vs Budget</CardTitle>
                <CardDescription>Opportunity values by stage and monthly revenue targets</CardDescription>
              </div>
              <Button variant="outline" onClick={() => router.push("/pipeline/gantt")} className="gap-2">
                View Gantt
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-slate-600">Loading pipeline data...</div>
            ) : pipelineData.length === 0 ? (
              <div className="text-center py-12 text-slate-600">No pipeline data available</div>
            ) : (
              <div className="space-y-4">
                {/* Chart */}
                <div className="flex items-end justify-between gap-2 h-64">
                  {pipelineData.map((month, idx) => {
                    const total = month.secured + month.highPotential + month.bid;
                    const securedHeight = maxValue > 0 ? (month.secured / maxValue) * 100 : 0;
                    const highPotentialHeight = maxValue > 0 ? (month.highPotential / maxValue) * 100 : 0;
                    const bidHeight = maxValue > 0 ? (month.bid / maxValue) * 100 : 0;
                    const budgetHeight = maxValue > 0 ? (month.budget / maxValue) * 100 : 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full relative" style={{ height: "200px" }}>
                          {/* Budget line */}
                          {month.budget > 0 && (
                            <div
                              className="absolute w-full border-t-2 border-dashed border-slate-400"
                              style={{ bottom: `${budgetHeight}%` }}
                            />
                          )}
                          
                          {/* Stacked bars */}
                          <div className="absolute bottom-0 w-full flex flex-col">
                            {month.bid > 0 && (
                              <div
                                className="bg-blue-500 w-full rounded-t"
                                style={{ height: `${bidHeight * 2}px` }}
                                title={`Bid: ${formatCurrency(month.bid)}`}
                              />
                            )}
                            {month.highPotential > 0 && (
                              <div
                                className="bg-orange-500 w-full"
                                style={{ height: `${highPotentialHeight * 2}px` }}
                                title={`High Potential: ${formatCurrency(month.highPotential)}`}
                              />
                            )}
                            {month.secured > 0 && (
                              <div
                                className="bg-green-500 w-full"
                                style={{ height: `${securedHeight * 2}px` }}
                                title={`Secured: ${formatCurrency(month.secured)}`}
                              />
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-slate-600 text-center">{month.month}</div>
                        {total > 0 && (
                          <div className="text-xs font-medium text-slate-900">
                            {formatCurrency(total)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Secured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span>High Potential</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Bid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-dashed border-slate-400 rounded"></div>
                    <span>Budget</span>
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

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}