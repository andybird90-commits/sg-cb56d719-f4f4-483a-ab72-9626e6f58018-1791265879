import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Users, Target, Briefcase, TrendingUp, Calendar, AlertCircle, AlertTriangle, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, addMonths, differenceInMonths } from "date-fns";

interface DashboardStats {
  companiesCount: number;
  contactsCount: number;
  opportunitiesCount: number;
  projectsCount: number;
  liveProjectsCount: number;
}

interface PipelineData {
  month: string;
  bid: number;
  highPotential: number;
  secured: number;
  budget: number;
  budgetGap: number;
}

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  project_reference?: string | null;
  tender_due_date: string | null;
  expected_fee_value?: number | null;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  probability_percent?: number | null;
  created_at?: string;
  companies?: {name: string;};
}

interface ActivityEntry {
  id: string;
  source: "contact" | "opportunity";
  source_id: string;
  source_name: string;
  post_type: "event" | "post" | "note";
  content: string;
  created_at: string;
  author_name: string;
  event_type?: string;
}

interface LatestOpportunity {
  id: string;
  name: string;
  stage: string;
  status: string;
  expected_fee_value: number | null;
  created_at: string;
  companies?: {name: string;};
}

interface ContactEvent {
  id: string;
  contact_id: string;
  title: string;
  event_type: "visit" | "function";
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  contacts?: {
    name: string;
    companies?: {
      name: string;
    };
  };
}

type SortField = "name" | "company" | "stage" | "value" | "due_date" | "start_date" | "end_date" | "probability" | "created_at";
type SortDirection = "asc" | "desc";

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
    liveProjectsCount: 0
  });

  const [tendersLoading, setTendersLoading] = useState(true);
  const [tendersError, setTendersError] = useState<string | null>(null);
  const [upcomingTenders, setUpcomingTenders] = useState<Opportunity[]>([]);

  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [latestActivity, setLatestActivity] = useState<ActivityEntry[]>([]);

  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [upcomingVisits, setUpcomingVisits] = useState<ContactEvent[]>([]);

  const [latestOpportunitiesLoading, setLatestOpportunitiesLoading] = useState(true);
  const [latestOpportunitiesError, setLatestOpportunitiesError] = useState<string | null>(null);
  const [latestOpportunities, setLatestOpportunities] = useState<LatestOpportunity[]>([]);

  const [opportunitiesTableLoading, setOpportunitiesTableLoading] = useState(true);
  const [opportunitiesTableError, setOpportunitiesTableError] = useState<string | null>(null);
  const [opportunitiesTable, setOpportunitiesTable] = useState<Opportunity[]>([]);

  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  
  // Filter state for secured-only view
  const [showSecuredOnly, setShowSecuredOnly] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    fetchStats();
    fetchTenders();
    fetchLatestActivity();
    fetchLatestOpportunities();
    fetchUpcomingVisits();
    fetchPipelineData();
    fetchOpportunitiesTable();
  }, []);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);

      const { data: companies } = await supabase.from("companies").select("id");
      const { data: contacts } = await supabase.from("contacts").select("id");
      const { data: opportunities } = await supabase.from("opportunities").select("id");
      const { data: projects } = await supabase.from("projects").select("id, status");

      const liveCount = projects?.filter((p) => p.status === "live").length || 0;

      setStats({
        companiesCount: companies?.length || 0,
        contactsCount: contacts?.length || 0,
        opportunitiesCount: opportunities?.length || 0,
        projectsCount: projects?.length || 0,
        liveProjectsCount: liveCount
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

      const now = new Date();
      now.setHours(0, 0, 0, 0);
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
        .gte("tender_due_date", now.toISOString().split("T")[0])
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

  const fetchLatestActivity = async () => {
    try {
      setActivityLoading(true);
      setActivityError(null);

      const { data: contactTimeline, error: contactError } = (await supabase
        .from("contact_timeline" as any)
        .select(`
          id,
          post_type,
          content,
          created_at,
          contact_id,
          contacts!contact_timeline_contact_id_fkey (
            name
          ),
          profiles!contact_timeline_created_by_user_id_fkey (
            full_name,
            email
          ),
          contact_events (
            event_type
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10)) as any;

      if (contactError) throw contactError;

      const { data: opportunityTimeline, error: opportunityError } = (await supabase
        .from("opportunity_timeline" as any)
        .select(`
          id,
          post_type,
          content,
          created_at,
          opportunity_id,
          opportunities!opportunity_timeline_opportunity_id_fkey (
            name
          ),
          profiles!opportunity_timeline_created_by_user_id_fkey (
            full_name,
            email
          ),
          opportunity_events (
            event_type
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10)) as any;

      if (opportunityError) throw opportunityError;

      const combinedActivity: ActivityEntry[] = [
        ...(contactTimeline || []).map((entry: any) => ({
          id: entry.id,
          source: "contact" as const,
          source_id: entry.contact_id,
          source_name: entry.contacts?.name || "Unknown Contact",
          post_type: entry.post_type,
          content: entry.content,
          created_at: entry.created_at,
          author_name: entry.profiles?.full_name || entry.profiles?.email || "Unknown User",
          event_type: entry.contact_events?.event_type
        })),
        ...(opportunityTimeline || []).map((entry: any) => ({
          id: entry.id,
          source: "opportunity" as const,
          source_id: entry.opportunity_id,
          source_name: entry.opportunities?.name || "Unknown Opportunity",
          post_type: entry.post_type,
          content: entry.content,
          created_at: entry.created_at,
          author_name: entry.profiles?.full_name || entry.profiles?.email || "Unknown User",
          event_type: entry.opportunity_events?.event_type
        }))
      ];

      combinedActivity.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setLatestActivity(combinedActivity.slice(0, 10));
    } catch (error) {
      console.error("Failed to load latest activity", error);
      setActivityError("Failed to load activity");
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchLatestOpportunities = async () => {
    try {
      setLatestOpportunitiesLoading(true);
      setLatestOpportunitiesError(null);

      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          stage,
          status,
          expected_fee_value,
          created_at,
          companies (
            name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setLatestOpportunities(data || []);
    } catch (error) {
      console.error("Failed to load latest opportunities", error);
      setLatestOpportunitiesError("Failed to load opportunities");
    } finally {
      setLatestOpportunitiesLoading(false);
    }
  };

  const fetchUpcomingVisits = async () => {
    try {
      setVisitsLoading(true);
      setVisitsError(null);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data, error } = (await supabase
        .from("contact_events" as any)
        .select(`
          *,
          contacts!contact_events_contact_id_fkey (
            name,
            companies!contacts_company_id_fkey (
              name
            )
          )
        `)
        .gte("event_date", today.toISOString().split("T")[0])
        .lte("event_date", sevenDaysFromNow.toISOString().split("T")[0])
        .order("event_date")
        .order("start_time")
        .limit(20)) as any;

      if (error) throw error;
      setUpcomingVisits(data as ContactEvent[] || []);
    } catch (error) {
      console.error("Failed to load upcoming visits", error);
      setVisitsError("Failed to load visits");
    } finally {
      setVisitsLoading(false);
    }
  };

  const fetchPipelineData = async () => {
    try {
      setPipelineLoading(true);
      setPipelineError(null);

      const today = new Date();
      const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfTwelfthMonth = new Date(today.getFullYear(), today.getMonth() + 12, 0);
      endOfTwelfthMonth.setHours(23, 59, 59, 999);

      // Create array of 12 month Date objects
      const monthDates: Date[] = [];
      for (let i = 0; i < 12; i++) {
        monthDates.push(new Date(today.getFullYear(), today.getMonth() + i, 1));
      }

      // Initialize data structure with proper Date formatting
      const initialData: PipelineData[] = monthDates.map((date) => ({
        month: format(date, "MMM yy"),
        secured: 0,
        highPotential: 0,
        bid: 0,
        budget: 180000,
        budgetGap: 0
      }));

      console.log("📅 Date range:", {
        start: startOfCurrentMonth.toISOString(),
        end: endOfTwelfthMonth.toISOString()
      });

      // MATCH MONTHLY VIEW: Fetch all opportunities with fee values, no stage filter
      const { data: opportunities } = await supabase
        .from("opportunities")
        .select("id, stage, expected_fee_value, expected_start_date, expected_end_date")
        .not("expected_fee_value", "is", null)
        .in("stage", ["bid", "high_potential"])
        .gte("expected_end_date", startOfCurrentMonth.toISOString());

      // MATCH MONTHLY VIEW: Fetch all projects with fee values, no status filter
      const { data: projects } = await supabase
        .from("projects")
        .select("id, status, agreed_fee_value, start_date, end_date")
        .not("agreed_fee_value", "is", null)
        .gte("end_date", startOfCurrentMonth.toISOString());

      console.log("📊 Data loaded:", {
        opportunities: opportunities?.length || 0,
        projects: projects?.length || 0
      });

      // Process opportunities - EXACT SAME LOGIC AS MONTHLY VIEW
      opportunities?.forEach((opp) => {
        if (!opp.expected_start_date || !opp.expected_end_date || !opp.expected_fee_value) {
          return;
        }

        const startDate = new Date(opp.expected_start_date);
        const endDate = new Date(opp.expected_end_date);
        const totalValue = opp.expected_fee_value;
        const stage = opp.stage;

        // MATCH MONTHLY VIEW: Use same duration calculation
        const durationMonths = Math.max(1,
          (endDate.getFullYear() - startDate.getFullYear()) * 12 + (
          endDate.getMonth() - startDate.getMonth()) + 1
        );

        const monthlyValue = totalValue / durationMonths;

        // Add to each relevant month
        monthDates.forEach((monthDate, idx) => {
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

          if (startDate <= monthEnd && endDate >= monthStart) {
            const monthData = initialData[idx];

            if (stage === "high_potential") {
              monthData.highPotential += monthlyValue;
            } else if (stage === "bid") {
              monthData.bid += monthlyValue;
            }
          }
        });
      });

      // Process projects - EXACT SAME LOGIC AS MONTHLY VIEW
      projects?.forEach((proj) => {
        if (!proj.start_date || !proj.end_date || !proj.agreed_fee_value) {
          return;
        }

        const startDate = new Date(proj.start_date);
        const endDate = new Date(proj.end_date);
        const totalValue = proj.agreed_fee_value;

        // MATCH MONTHLY VIEW: Use same duration calculation
        const durationMonths = Math.max(1,
          (endDate.getFullYear() - startDate.getFullYear()) * 12 + (
          endDate.getMonth() - startDate.getMonth()) + 1
        );

        const monthlyValue = totalValue / durationMonths;

        // Add to each relevant month
        monthDates.forEach((monthDate, idx) => {
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

          if (startDate <= monthEnd && endDate >= monthStart) {
            initialData[idx].secured += monthlyValue;
          }
        });
      });

      // Calculate budget gap for each month
      initialData.forEach((month) => {
        const total = month.secured + month.highPotential + month.bid;
        month.budgetGap = Math.max(0, month.budget - total);
      });

      console.log("📊 Final Pipeline Data:", initialData);

      setPipelineData(initialData);
    } catch (error) {
      console.error("Failed to load pipeline data", error);
      setPipelineError("Failed to load pipeline");
    } finally {
      setPipelineLoading(false);
    }
  };

  const fetchOpportunitiesTable = async () => {
    try {
      setOpportunitiesTableLoading(true);
      setOpportunitiesTableError(null);

      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          id,
          name,
          stage,
          project_reference,
          expected_fee_value,
          tender_due_date,
          expected_start_date,
          expected_end_date,
          probability_percent,
          created_at,
          companies (
            name
          )
        `)
        .in("stage", ["bid", "high_potential"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunitiesTable((data as any) || []);
    } catch (error) {
      console.error("Failed to load opportunities table", error);
      setOpportunitiesTableError("Failed to load opportunities");
    } finally {
      setOpportunitiesTableLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedOpportunities = () => {
    const sorted = [...opportunitiesTable].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "company":
          aValue = (a.companies?.name || "").toLowerCase();
          bValue = (b.companies?.name || "").toLowerCase();
          break;
        case "stage":
          aValue = a.stage;
          bValue = b.stage;
          break;
        case "value":
          aValue = a.expected_fee_value || 0;
          bValue = b.expected_fee_value || 0;
          break;
        case "due_date":
          aValue = a.tender_due_date ? new Date(a.tender_due_date).getTime() : 0;
          bValue = b.tender_due_date ? new Date(b.tender_due_date).getTime() : 0;
          break;
        case "start_date":
          aValue = a.expected_start_date ? new Date(a.expected_start_date).getTime() : 0;
          bValue = b.expected_start_date ? new Date(b.expected_start_date).getTime() : 0;
          break;
        case "end_date":
          aValue = a.expected_end_date ? new Date(a.expected_end_date).getTime() : 0;
          bValue = b.expected_end_date ? new Date(b.expected_end_date).getTime() : 0;
          break;
        case "probability":
          aValue = a.probability_percent || 0;
          bValue = b.probability_percent || 0;
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const SortableHeader = ({ field, label }: {field: SortField;label: string;}) => {
    const isActive = sortField === field;
    return (
      <th
        className="text-left py-3 px-3 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-shadow select-none"
        onClick={() => handleSort(field)}>

        <div className="flex items-center gap-1">
          {label}
          {isActive ?
            sortDirection === "asc" ?
            <ArrowUp className="w-3 h-3" /> :
            <ArrowDown className="w-3 h-3" /> :
            <ArrowUpDown className="w-3 h-3 opacity-30" />
          }
        </div>
      </th>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
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
      case "lead":
        return "bg-purple-100 text-purple-800";
      case "lost":
        return "bg-red-100 text-red-800";
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

  const getEventTypeColor = (type: "visit" | "function") => {
    return type === "visit" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800";
  };

  const getActivityPostTypeColor = (type: string) => {
    switch (type) {
      case "event":
        return "bg-blue-100 text-blue-700";
      case "post":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getActivitySourceIcon = (source: "contact" | "opportunity") => {
    return source === "contact" ? "👤" : "🎯";
  };

  const formatActivityDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    });
  };

  const maxValue = 200000;

  const ErrorState = ({ message }: {message: string;}) =>
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>;


  const sortedOpportunities = getSortedOpportunities();
  
  // Filter pipeline data based on secured-only toggle
  const filteredPipelineData = showSecuredOnly
    ? pipelineData.map(month => ({
        ...month,
        highPotential: 0,
        bid: 0,
        budgetGap: month.budget - month.secured
      }))
    : pipelineData;

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Welcome Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          {profile?.role &&
            <p className="text-sm sm:text-base text-slate-600 capitalize">
              {profile.role} Dashboard
            </p>
          }
        </div>

        {/* Quick Stats Grid */}
        {statsError ?
          <ErrorState message={statsError} /> :

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
        }

        {/* Pipeline Chart */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>12-Month Pipeline</span>
              <div className="flex gap-2">
                <Button
                  variant={showSecuredOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSecuredOnly(!showSecuredOnly)}
                >
                  {showSecuredOnly ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-1" />
                      Show All
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1" />
                      Secured Only
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/pipeline/monthly")}>

                  View Monthly
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/pipeline/gantt")}>

                  View Gantt
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineLoading ?
              <div className="h-96 flex items-center justify-center">
                <p className="text-muted-foreground">Loading pipeline data...</p>
              </div> :
              pipelineError ?
              <div className="h-96 flex items-center justify-center">
                <p className="text-destructive">{pipelineError}</p>
              </div> :

              <>
                {/* Chart with dynamic height */}
                <div className="w-full" style={{ minHeight: "500px", height: "auto" }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={500}>
                    <BarChart data={filteredPipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 12 }} />

                      <YAxis
                        tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }} />

                      <Tooltip
                        formatter={(value: number) => `£${value.toLocaleString()}`}
                        contentStyle={{ fontSize: 12 }} />

                      <Legend
                        wrapperStyle={{ paddingTop: "20px" }}
                        iconType="circle" />

                      <Bar dataKey="secured" stackId="a" fill="#22c55e" name="Secured + Projects" />
                      {!showSecuredOnly && (
                        <>
                          <Bar dataKey="highPotential" stackId="a" name="High Potential" fill="#3b82f6" />
                          <Bar dataKey="bid" stackId="a" name="Bid" fill="#f59e0b" />
                        </>
                      )}
                      <Bar dataKey="budgetGap" stackId="a" name="Budget Gap" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Totals Table - Always Visible */}
                <div className="mt-8 border-t pt-6">
                  <div className="mt-6 overflow-x-auto">
                    <h3 className="text-lg font-semibold mb-4">Monthly Breakdown</h3>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border p-2 text-left">Month</th>
                          <th className="border p-2 text-right text-green-600">Secured + Projects</th>
                          {!showSecuredOnly && (
                            <>
                              <th className="border p-2 text-right text-blue-600">High Potential</th>
                              <th className="border p-2 text-right text-amber-600">Bid</th>
                            </>
                          )}
                          <th className="border p-2 text-right text-red-600">Budget Gap</th>
                          <th className="border p-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPipelineData.map((row) =>
                          <tr key={row.month} className="hover:bg-muted/50">
                            <td className="border p-2">{row.month}</td>
                            <td className="border p-2 text-right">{formatCurrency(row.secured)}</td>
                            {!showSecuredOnly && (
                              <>
                                <td className="border p-2 text-right">{formatCurrency(row.highPotential)}</td>
                                <td className="border p-2 text-right">{formatCurrency(row.bid)}</td>
                              </>
                            )}
                            <td className="border p-2 text-right">{formatCurrency(row.budgetGap)}</td>
                            <td className="border p-2 text-right font-semibold">
                              {formatCurrency(row.secured + row.highPotential + row.bid)}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                          <td className="px-4 py-2">TOTAL</td>
                          <td className="px-4 py-2 text-green-600" style={{ textAlign: "right" }}>
                            £{filteredPipelineData.reduce((sum, month) => sum + month.secured, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          {!showSecuredOnly && (
                            <>
                              <td className="px-4 py-2 text-blue-600" style={{ textAlign: "right" }}>
                                £{filteredPipelineData.reduce((sum, month) => sum + month.highPotential, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-4 py-2 text-amber-600" style={{ textAlign: "right" }}>
                                £{filteredPipelineData.reduce((sum, month) => sum + month.bid, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-2 text-red-600" style={{ textAlign: "right" }}>
                            £{filteredPipelineData.reduce((sum, month) => sum + month.budgetGap, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-2" style={{ textAlign: "right" }}>
                            £{filteredPipelineData.reduce((sum, month) => sum + month.secured + month.highPotential + month.bid, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            }
          </CardContent>
        </Card>

        {/* Live Opportunities & High Potentials Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-base sm:text-lg">Live Opportunities & High Potentials</CardTitle>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">Active pipeline opportunities - Click column headers to sort</p>
          </CardHeader>
          <CardContent>
            {opportunitiesTableError ?
              <ErrorState message={opportunitiesTableError} /> :
              opportunitiesTableLoading ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                Loading opportunities...
              </div> :
              opportunitiesTable.length === 0 ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                No active opportunities in pipeline
              </div> :

              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-3 text-xs font-medium text-slate-600">Reference</th>
                      <SortableHeader field="name" label="Opportunity Name" />
                      <SortableHeader field="company" label="Company" />
                      <SortableHeader field="stage" label="Stage" />
                      <SortableHeader field="value" label="Value" />
                      <SortableHeader field="due_date" label="Due Date" />
                      <SortableHeader field="start_date" label="Start Date" />
                      <SortableHeader field="end_date" label="Finish Date" />
                      <SortableHeader field="probability" label="Probability" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOpportunities.map((opp) =>
                      <tr
                        key={opp.id}
                        className="border-b hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/opportunities/${opp.id}`)}>

                        <td className="py-3 px-3 text-sm text-slate-500">
                          {opp.project_reference || "—"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-sm text-slate-900">{opp.name}</div>
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-700">
                          {opp.companies?.name || "—"}
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={`${getStageColor(opp.stage)} text-xs`}>
                            {opp.stage === "high_potential" ? "High Potential" : opp.stage}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-medium text-slate-900">
                          {opp.expected_fee_value ? formatCurrency(opp.expected_fee_value) : "—"}
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-700">
                          {formatDate(opp.tender_due_date)}
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-700">
                          {formatDate(opp.expected_start_date)}
                        </td>
                        <td className="py-3 px-3 text-sm text-slate-700">
                          {formatDate(opp.expected_end_date)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-slate-700">
                          {opp.probability_percent !== null ? `${opp.probability_percent}%` : "—"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-50">
                      <td colSpan={4} className="py-3 px-3 text-sm font-semibold text-slate-900">
                        Totals:
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-bold text-slate-900">
                        {(() => {
                          const highPotentialTotal = opportunitiesTable.
                            filter((opp) => opp.stage === "high_potential").
                            reduce((sum, opp) => sum + (opp.expected_fee_value || 0), 0);
                          const bidTotal = opportunitiesTable.
                            filter((opp) => opp.stage === "bid").
                            reduce((sum, opp) => sum + (opp.expected_fee_value || 0), 0);

                          return (
                            <div className="space-y-1">
                              <div className="text-blue-600">
                                High Potential: {formatCurrency(highPotentialTotal)}
                              </div>
                              <div className="text-yellow-600">
                                Bids: {formatCurrency(bidTotal)}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          </CardContent>
        </Card>

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
            {tendersError ?
              <ErrorState message={tendersError} /> :
              tendersLoading ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                Loading tenders...
              </div> :
              upcomingTenders.length === 0 ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                No tenders due in the next 30 days
              </div> :

              <div className="space-y-3">
                {upcomingTenders.map((opp) =>
                  <div
                    key={opp.id}
                    className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div
                        className="font-medium text-sm text-slate-900 line-clamp-2 cursor-pointer hover:text-blue-600"
                        onClick={() => router.push(`/opportunities/${opp.id}`)}>

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
                )}
              </div>
            }
          </CardContent>
        </Card>

        {/* Latest Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-base sm:text-lg">Latest Activity</CardTitle>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">Recent updates</p>
          </CardHeader>
          <CardContent>
            {activityError ?
              <ErrorState message={activityError} /> :
              activityLoading ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                Loading activity...
              </div> :
              latestActivity.length === 0 ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                No recent activity
              </div> :

              <div className="space-y-3">
                {latestActivity.map((activity) =>
                  <div
                    key={`${activity.source}-${activity.id}`}
                    className="p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      const path = activity.source === "contact" ?
                        `/contacts/${activity.source_id}` :
                        `/opportunities/${activity.source_id}`;
                      router.push(path);
                    }}>

                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-sm">{getActivitySourceIcon(activity.source)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {activity.source_name}
                          </span>
                          <Badge variant="outline" className={`text-xs ${getActivityPostTypeColor(activity.post_type)}`}>
                            {activity.post_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-700 line-clamp-2 mb-1">
                          {activity.content}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{activity.author_name}</span>
                          <span>•</span>
                          <span>{formatActivityDate(activity.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            }
          </CardContent>
        </Card>

        {/* Latest Opportunities */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-base sm:text-lg">Latest Opportunities</CardTitle>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">Recently added</p>
          </CardHeader>
          <CardContent>
            {latestOpportunitiesError ?
              <ErrorState message={latestOpportunitiesError} /> :
              latestOpportunitiesLoading ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                Loading opportunities...
              </div> :
              latestOpportunities.length === 0 ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                No opportunities yet
              </div> :

              <div className="space-y-3">
                {latestOpportunities.map((opp) =>
                  <div
                    key={opp.id}
                    className="p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/opportunities/${opp.id}`)}>

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
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(opp.created_at)}</span>
                      {opp.expected_fee_value &&
                        <span className="font-medium text-slate-700">
                          {formatCurrency(opp.expected_fee_value)}
                        </span>
                      }
                    </div>
                  </div>
                )}
              </div>
            }
          </CardContent>
        </Card>

        {/* Client Visits & Functions - Full Width */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-base sm:text-lg">Client Visits & Functions</CardTitle>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">Next 7 days</p>
          </CardHeader>
          <CardContent>
            {visitsError ?
              <ErrorState message={visitsError} /> :
              visitsLoading ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                Loading visits...
              </div> :
              upcomingVisits.length === 0 ?
              <div className="text-center py-6 sm:py-8 text-slate-600 text-sm">
                No visits or functions scheduled in the next 7 days
              </div> :

              <div className="space-y-3">
                {upcomingVisits.map((visit) =>
                  <div
                    key={visit.id}
                    className="p-3 sm:p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => router.push(`/contacts/${visit.contact_id}`)}>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      {/* Date & Time Column */}
                      <div className="flex-shrink-0 sm:w-32">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatDate(visit.event_date)}
                        </div>
                        {visit.start_time &&
                          <div className="text-xs text-slate-500">
                            {visit.start_time.substring(0, 5)}
                            {visit.end_time && ` - ${visit.end_time.substring(0, 5)}`}
                          </div>
                        }
                      </div>

                      {/* Event Details Column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <Badge className={`${getEventTypeColor(visit.event_type)} flex-shrink-0 text-xs`}>
                            {visit.event_type}
                          </Badge>
                          <div className="font-medium text-sm text-slate-900 truncate">
                            {visit.title}
                          </div>
                        </div>
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">{visit.contacts?.name}</span>
                          {visit.contacts?.companies?.name &&
                            <span className="text-slate-500"> • {visit.contacts.companies.name}</span>
                          }
                        </div>
                        {visit.location &&
                          <div className="text-xs text-slate-500 mt-1">
                            📍 {visit.location}
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            }
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