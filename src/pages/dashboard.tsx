import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Users, Target, Briefcase, TrendingUp, Calendar, AlertCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  companiesCount: number;
  contactsCount: number;
  opportunitiesCount: number;
  projectsCount: number;
  liveProjectsCount: number;
}

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  tender_due_date: string | null;
  expected_fee_value?: number | null;
  expected_start_date?: string | null;
  companies?: { name: string };
}

interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  companies?: { name: string };
}

interface Absence {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  profiles?: { full_name: string };
}

interface PipelineData {
  month: string;
  bid: number;
  prospect: number;
  secured: number;
  budget: number;
}

function DashboardContent() {
  const { profile } = useAuth();
  const router = useRouter();
  
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    companiesCount: 0,
    contactsCount: 0,
    opportunitiesCount: 0,
    projectsCount: 0,
    liveProjectsCount: 0,
  });

  const [tendersLoading, setTendersLoading] = useState(true);
  const [tendersError, setTendersError] = useState<string | null>(null);
  const [upcomingTenders, setUpcomingTenders] = useState<Opportunity[]>([]);

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [liveProjects, setLiveProjects] = useState<Project[]>([]);

  const [absencesLoading, setAbsencesLoading] = useState(true);
  const [absencesError, setAbsencesError] = useState<string | null>(null);
  const [thisWeekAbsences, setThisWeekAbsences] = useState<Absence[]>([]);

  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);

  useEffect(() => {
    fetchStats();
    fetchTenders();
    fetchLiveProjects();
    fetchAbsences();
    fetchPipelineData();
  }, []);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);

      const { data: companies } = await supabase.from("companies").select("id");
      const { data: contacts } = await supabase.from("contacts").select("id");
      const { data: opportunities } = await supabase.from("opportunities").select("id");
      const { data: projects } = await supabase.from("projects").select("id, status");
      
      const liveCount = projects?.filter(p => p.status === "live").length || 0;

      setStats({
        companiesCount: companies?.length || 0,
        contactsCount: contacts?.length || 0,
        opportunitiesCount: opportunities?.length || 0,
        projectsCount: projects?.length || 0,
        liveProjectsCount: liveCount,
      });
    } catch (error) {
      console.error("Failed to load dashboard stats", error);
      setStatsError("Failed to load statistics");
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchTenders = async () => {
    try {
      setTendersLoading(true);
      setTendersError(null);

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          stage,
          tender_due_date,
          companies (
            name
          )
        `)
        .not("tender_due_date", "is", null)
        .lte("tender_due_date", thirtyDaysFromNow.toISOString().split("T")[0])
        .order("tender_due_date")
        .limit(5);

      if (error) throw error;
      setUpcomingTenders(data || []);
    } catch (error) {
      console.error("Failed to load upcoming tenders", error);
      setTendersError("Failed to load tenders");
    } finally {
      setTendersLoading(false);
    }
  };

  const fetchLiveProjects = async () => {
    try {
      setProjectsLoading(true);
      setProjectsError(null);

      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          code,
          name,
          status,
          companies!projects_client_company_id_fkey (
            name
          )
        `)
        .eq("status", "live")
        .order("name")
        .limit(5);

      if (error) throw error;
      setLiveProjects(data || []);
    } catch (error) {
      console.error("Failed to load live projects", error);
      setProjectsError("Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchAbsences = async () => {
    try {
      setAbsencesLoading(true);
      setAbsencesError(null);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const { data, error } = await supabase
        .from("absences")
        .select(`
          id,
          type,
          start_date,
          end_date,
          profiles!absences_user_id_fkey (
            full_name
          )
        `)
        .not("approved_by", "is", null)
        .lte("start_date", endOfWeek.toISOString().split("T")[0])
        .gte("end_date", startOfWeek.toISOString().split("T")[0])
        .order("start_date")
        .limit(10);

      if (error) throw error;
      setThisWeekAbsences(data || []);
    } catch (error) {
      console.error("Failed to load absences", error);
      setAbsencesError("Failed to load absences");
    } finally {
      setAbsencesLoading(false);
    }
  };

  const fetchPipelineData = async () => {
    try {
      setPipelineLoading(true);
      setPipelineError(null);

      const today = new Date();
      const months: PipelineData[] = [];

      // Initialize 12 months
      for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        months.push({
          month: date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
          bid: 0,
          prospect: 0,
          secured: 0,
          budget: 0,
        });
      }

      // Fetch all opportunities
      const { data: allOpportunities } = await supabase
        .from("opportunities")
        .select("id, stage, expected_fee_value, expected_start_date")
        .in("stage", ["bid", "high_potential", "secured"]);

      // Group opportunities by month and stage
      (allOpportunities || []).forEach((opp) => {
        if (!opp.expected_start_date || !opp.expected_fee_value) return;

        const awardDate = new Date(opp.expected_start_date);
        const monthIndex = (awardDate.getFullYear() - today.getFullYear()) * 12 + 
                          (awardDate.getMonth() - today.getMonth());

        if (monthIndex >= 0 && monthIndex < 12) {
          if (opp.stage === "bid") {
            months[monthIndex].bid += opp.expected_fee_value;
          } else if (opp.stage === "high_potential") {
            months[monthIndex].prospect += opp.expected_fee_value;
          } else if (opp.stage === "secured") {
            months[monthIndex].secured += opp.expected_fee_value;
          }
        }
      });

      // Fetch budgets for each month
      for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        const { data: budget } = await supabase
          .from("monthly_budgets")
          .select("budget_revenue")
          .eq("year", year)
          .eq("month", month)
          .maybeSingle();

        if (budget) {
          months[i].budget = budget.budget_revenue;
        }
      }

      setPipelineData(months);
    } catch (error) {
      console.error("Failed to load pipeline data", error);
      setPipelineError("Failed to load pipeline");
    } finally {
      setPipelineLoading(false);
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

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "secured":
        return "bg-green-100 text-green-800";
      case "high_potential":
        return "bg-blue-100 text-blue-800";
      case "bid":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getAbsenceColor = (type: string) => {
    switch (type) {
      case "holiday":
        return "bg-blue-100 text-blue-800";
      case "sick":
        return "bg-red-100 text-red-800";
      default:
        return "bg-orange-100 text-orange-800";
    }
  };

  const maxValue = Math.max(
    ...pipelineData.map(d => d.bid + d.prospect + d.secured),
    ...pipelineData.map(d => d.budget),
    1
  );

  const ErrorState = ({ message }: { message: string }) => (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Welcome Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          {profile?.role && (
            <p className="text-sm sm:text-base text-slate-600 capitalize">
              {profile.role} Dashboard
            </p>
          )}
        </div>

        {/* Quick Stats Grid */}
        {statsError ? (
          <ErrorState message={statsError} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Link href="/companies">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {statsLoading ? "..." : stats.companiesCount}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">Companies</div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/contacts">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {statsLoading ? "..." : stats.contactsCount}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">Contacts</div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/opportunities">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {statsLoading ? "..." : stats.opportunitiesCount}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">Opportunities</div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/projects">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {statsLoading ? "..." : stats.liveProjectsCount}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">Live Projects</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Pipeline Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-600" />
                <CardTitle className="text-base sm:text-lg">12-Month Pipeline</CardTitle>
              </div>
              <Link href="/pipeline/gantt">
                <Button variant="outline" size="sm">View Gantt</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {pipelineError ? (
              <ErrorState message={pipelineError} />
            ) : pipelineLoading ? (
              <div className="flex items-center justify-center h-64 sm:h-80 text-slate-600">
                Loading pipeline data...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="min-w-[600px] h-64 sm:h-80 relative">
                    {/* Budget line overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                      <path
                        d={pipelineData.map((data, idx) => {
                          const x = ((idx + 0.5) / pipelineData.length) * 100;
                          const y = 100 - ((data.budget / maxValue) * 80);
                          return `${idx === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                        }).join(' ')}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                      {pipelineData.map((data, idx) => {
                        if (data.budget === 0) return null;
                        const x = ((idx + 0.5) / pipelineData.length) * 100;
                        const y = 100 - ((data.budget / maxValue) * 80);
                        return (
                          <circle
                            key={idx}
                            cx={`${x}%`}
                            cy={`${y}%`}
                            r="4"
                            fill="#ef4444"
                          />
                        );
                      })}
                    </svg>

                    {/* Stacked bar chart */}
                    <div className="flex h-full gap-1 items-end">
                      {pipelineData.map((data, idx) => {
                        const total = data.bid + data.prospect + data.secured;
                        const totalHeight = (total / maxValue) * 200;
                        const bidHeight = (data.bid / maxValue) * 200;
                        const prospectHeight = (data.prospect / maxValue) * 200;
                        const securedHeight = (data.secured / maxValue) * 200;

                        return (
                          <div key={idx} className="flex-1 flex flex-col justify-end items-center gap-1">
                            <div className="w-full flex flex-col">
                              {/* Secured (green) - top */}
                              {data.secured > 0 && (
                                <div
                                  className="w-full bg-green-500 hover:bg-green-600 transition-colors"
                                  style={{
                                    height: `${securedHeight}px`,
                                    minHeight: "2px",
                                    borderTopLeftRadius: total === data.secured ? "4px" : "0",
                                    borderTopRightRadius: total === data.secured ? "4px" : "0",
                                  }}
                                  title={`Secured: ${formatCurrency(data.secured)}`}
                                />
                              )}
                              {/* Prospect (blue) - middle */}
                              {data.prospect > 0 && (
                                <div
                                  className="w-full bg-blue-500 hover:bg-blue-600 transition-colors"
                                  style={{
                                    height: `${prospectHeight}px`,
                                    minHeight: "2px",
                                    borderTopLeftRadius: data.secured === 0 ? "4px" : "0",
                                    borderTopRightRadius: data.secured === 0 ? "4px" : "0",
                                  }}
                                  title={`Prospect: ${formatCurrency(data.prospect)}`}
                                />
                              )}
                              {/* Bid (yellow) - bottom */}
                              {data.bid > 0 && (
                                <div
                                  className="w-full bg-yellow-500 hover:bg-yellow-600 transition-colors"
                                  style={{
                                    height: `${bidHeight}px`,
                                    minHeight: "2px",
                                    borderTopLeftRadius: data.secured === 0 && data.prospect === 0 ? "4px" : "0",
                                    borderTopRightRadius: data.secured === 0 && data.prospect === 0 ? "4px" : "0",
                                    borderBottomLeftRadius: "4px",
                                    borderBottomRightRadius: "4px",
                                  }}
                                  title={`Bid: ${formatCurrency(data.bid)}`}
                                />
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-slate-600 text-center whitespace-nowrap">
                              {data.month}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs sm:text-sm justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded"></div>
                    <span className="text-slate-600">Secured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded"></div>
                    <span className="text-slate-600">Prospect</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-500 rounded"></div>
                    <span className="text-slate-600">Bid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded"></div>
                    <span className="text-slate-600">Budget</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Three Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Upcoming Tenders */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <CardTitle className="text-base sm:text-lg">Upcoming Tenders</CardTitle>
              </div>
              <p className="text-xs sm:text-sm text-slate-600">Next 30 days</p>
            </CardHeader>
            <CardContent>
              {tendersError ? (
                <ErrorState message={tendersError} />
              ) : tendersLoading ? (
                <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                  Loading tenders...
                </div>
              ) : upcomingTenders.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                  No tenders due in the next 30 days
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTenders.map((opp) => (
                    <div
                      key={opp.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/opportunities/${opp.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-medium text-sm text-slate-900 line-clamp-2">
                          {opp.name}
                        </div>
                        <Badge className={`${getStageColor(opp.stage)} flex-shrink-0 text-xs`}>
                          {opp.stage.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600 mb-1">
                        {opp.companies?.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        Due: {formatDate(opp.tender_due_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Projects */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-600" />
                <CardTitle className="text-base sm:text-lg">Live Projects</CardTitle>
              </div>
              <p className="text-xs sm:text-sm text-slate-600">Currently active</p>
            </CardHeader>
            <CardContent>
              {projectsError ? (
                <ErrorState message={projectsError} />
              ) : projectsLoading ? (
                <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                  Loading projects...
                </div>
              ) : liveProjects.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                  No live projects
                </div>
              ) : (
                <div className="space-y-3">
                  {liveProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/projects/${proj.id}`)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span className="font-mono text-xs text-slate-500 flex-shrink-0">
                          {proj.code}
                        </span>
                        <div className="font-medium text-sm text-slate-900 line-clamp-2">
                          {proj.name}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600">
                        {proj.companies?.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* This Week's Absences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base sm:text-lg">This Week's Absences</CardTitle>
              </div>
              <p className="text-xs sm:text-sm text-slate-600">Team availability</p>
            </CardHeader>
            <CardContent>
              {absencesError ? (
                <ErrorState message={absencesError} />
              ) : absencesLoading ? (
                <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                  Loading absences...
                </div>
              ) : thisWeekAbsences.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                  No absences this week
                </div>
              ) : (
                <div className="space-y-3">
                  {thisWeekAbsences.map((absence) => (
                    <div key={absence.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-medium text-sm text-slate-900">
                          {absence.profiles?.full_name}
                        </div>
                        <Badge className={`${getAbsenceColor(absence.type)} flex-shrink-0 text-xs`}>
                          {absence.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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