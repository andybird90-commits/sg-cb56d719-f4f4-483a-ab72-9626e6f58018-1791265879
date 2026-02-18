import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Users, Target, Briefcase, TrendingUp, Calendar, AlertCircle, AlertTriangle, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Plus, Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, DollarSign, FolderKanban } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, addMonths, differenceInMonths } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  
  const [showSecuredOnly, setShowSecuredOnly] = useState(false);

  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAddEvent, setShowQuickAddEvent] = useState(false);
  const [quickEventForm, setQuickEventForm] = useState({
    title: "",
    event_type: "meeting",
    event_date: new Date().toISOString().split("T")[0],
    start_time: "",
    end_time: "",
    location: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchTenders();
    fetchLatestActivity();
    fetchLatestOpportunities();
    fetchUpcomingVisits();
    fetchPipelineData();
    fetchOpportunitiesTable();
  }, [profile]);

  const handleQuickAddEvent = async () => {
    if (!profile?.id || !quickEventForm.title || !quickEventForm.event_date) {
      alert("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("calendar_events").insert({
        title: quickEventForm.title,
        event_type: quickEventForm.event_type,
        event_date: quickEventForm.event_date,
        start_time: quickEventForm.start_time || null,
        end_time: quickEventForm.end_time || null,
        location: quickEventForm.location || null,
        description: quickEventForm.description || null,
        created_by_user_id: profile.id,
      });

      if (error) throw error;

      setShowQuickAddEvent(false);
      setQuickEventForm({
        title: "",
        event_type: "meeting",
        event_date: new Date().toISOString().split("T")[0],
        start_time: "",
        end_time: "",
        location: "",
        description: "",
      });
      alert("Event created successfully!");
    } catch (err) {
      console.error("Error creating event:", err);
      alert("Failed to create event");
    } finally {
      setSaving(false);
    }
  };

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

      const monthDates: Date[] = [];
      for (let i = 0; i < 12; i++) {
        monthDates.push(new Date(today.getFullYear(), today.getMonth() + i, 1));
      }

      const initialData: PipelineData[] = monthDates.map((date) => ({
        month: format(date, "MMM yy"),
        secured: 0,
        highPotential: 0,
        bid: 0,
        budget: 180000,
        budgetGap: 0
      }));

      const { data: opportunityPhasing } = await supabase
        .from("opportunity_monthly_phasing")
        .select("opportunity_id, year, month, revenue_amount")
        .gte("year", startOfCurrentMonth.getFullYear())
        .lte("year", endOfTwelfthMonth.getFullYear());

      const { data: projectPhasing } = await supabase
        .from("project_monthly_phasing")
        .select("project_id, year, month, revenue_amount")
        .gte("year", startOfCurrentMonth.getFullYear())
        .lte("year", endOfTwelfthMonth.getFullYear());

      const oppPhasingMap = new Map<string, number>();
      opportunityPhasing?.forEach((phase) => {
        const monthStr = phase.month.toString().padStart(2, '0');
        const key = `${phase.opportunity_id}-${phase.year}-${monthStr}`;
        oppPhasingMap.set(key, phase.revenue_amount);
      });

      const projPhasingMap = new Map<string, number>();
      projectPhasing?.forEach((phase) => {
        const monthStr = phase.month.toString().padStart(2, '0');
        const key = `${phase.project_id}-${phase.year}-${monthStr}`;
        projPhasingMap.set(key, phase.revenue_amount);
      });

      const { data: opportunities } = await supabase
        .from("opportunities")
        .select("id, stage, expected_fee_value, expected_start_date, expected_end_date")
        .not("expected_fee_value", "is", null)
        .in("stage", ["bid", "high_potential"])
        .eq("archived", false)
        .not("status", "in", '("closed_won","closed_lost")')
        .gte("expected_end_date", startOfCurrentMonth.toISOString());

      const { data: projects } = await supabase
        .from("projects")
        .select("id, status, agreed_fee_value, start_date, end_date")
        .not("agreed_fee_value", "is", null)
        .gte("end_date", startOfCurrentMonth.toISOString());

      opportunities?.forEach((opp) => {
        if (!opp.expected_start_date || !opp.expected_end_date || !opp.expected_fee_value) {
          return;
        }

        const startDate = new Date(opp.expected_start_date);
        const endDate = new Date(opp.expected_end_date);
        const totalValue = opp.expected_fee_value;
        const stage = opp.stage;

        const durationMonths = Math.max(1,
          (endDate.getFullYear() - startDate.getFullYear()) * 12 + (
          endDate.getMonth() - startDate.getMonth()) + 1
        );
        const defaultMonthlyValue = totalValue / durationMonths;

        const opportunityPhasingKeys = Array.from(oppPhasingMap.keys())
          .filter(key => key.startsWith(`${opp.id}-`));
        const hasManualPhasing = opportunityPhasingKeys.length > 0;

        monthDates.forEach((monthDate, idx) => {
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

          if (startDate <= monthEnd && endDate >= monthStart) {
            const monthData = initialData[idx];
            const yearMonth = format(monthDate, "yyyy-MM");
            const phasingKey = `${opp.id}-${yearMonth}`;

            const monthlyValue = hasManualPhasing
              ? (oppPhasingMap.get(phasingKey) || 0)
              : defaultMonthlyValue;

            if (stage === "high_potential") {
              monthData.highPotential += monthlyValue;
            } else if (stage === "bid") {
              monthData.bid += monthlyValue;
            }
          }
        });
      });

      projects?.forEach((proj) => {
        if (!proj.start_date || !proj.end_date || !proj.agreed_fee_value) {
          return;
        }

        const startDate = new Date(proj.start_date);
        const endDate = new Date(proj.end_date);
        const totalValue = proj.agreed_fee_value;

        const durationMonths = Math.max(1,
          (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
          (endDate.getMonth() - startDate.getMonth()) + 1
        );
        const defaultMonthlyValue = totalValue / durationMonths;

        const projectPhasingKeys = Array.from(projPhasingMap.keys())
          .filter(key => key.startsWith(`${proj.id}-`));
        const hasManualPhasing = projectPhasingKeys.length > 0;

        monthDates.forEach((monthDate, idx) => {
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

          if (startDate <= monthEnd && endDate >= monthStart) {
            const yearMonth = format(monthDate, "yyyy-MM");
            const phasingKey = `${proj.id}-${yearMonth}`;

            const monthlyValue = hasManualPhasing
              ? (projPhasingMap.get(phasingKey) || 0)
              : defaultMonthlyValue;

            initialData[idx].secured += monthlyValue;
          }
        });
      });

      initialData.forEach((month) => {
        const total = month.secured + month.highPotential + month.bid;
        month.budgetGap = Math.max(0, month.budget - total);
      });

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
        className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-professional select-none"
        onClick={() => handleSort(field)}>
        <div className="flex items-center gap-2">
          {label}
          {isActive ?
            sortDirection === "asc" ?
            <ArrowUp className="w-3 h-3" /> :
            <ArrowDown className="w-3 h-3" /> :
            <ArrowUpDown className="w-3 h-3 opacity-40" />
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
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "high_potential":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "bid":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "lead":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "lost":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getEventTypeColor = (type: "visit" | "function") => {
    return type === "visit" ? 
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : 
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
  };

  const getActivityPostTypeColor = (type: string) => {
    switch (type) {
      case "event":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "post":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
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

  const ErrorState = ({ message }: {message: string;}) =>
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>;

  const sortedOpportunities = getSortedOpportunities();
  
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
      <div className="space-y-8">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-4xl font-bold">Dashboard</h1>
              <Button onClick={() => setShowQuickAddEvent(true)} className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                <Plus className="h-4 w-4" />
                Add Event
              </Button>
            </div>
            <p className="text-slate-600">
              Comprehensive overview of business operations
            </p>
          </div>
        </div>

        {statsError ?
          <ErrorState message={statsError} /> :
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <Link href="/companies" className="group">
              <Card className="card-professional h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-professional">
                      <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight">
                      {statsLoading ? "..." : stats.companiesCount}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">Companies</div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/contacts" className="group">
              <Card className="card-professional h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition-professional">
                      <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight">
                      {statsLoading ? "..." : stats.contactsCount}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">Contacts</div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/opportunities" className="group">
              <Card className="card-professional h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-110 transition-professional">
                      <Target className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight">
                      {statsLoading ? "..." : stats.opportunitiesCount}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">Opportunities</div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/projects" className="group">
              <Card className="card-professional h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-professional">
                      <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight">
                      {statsLoading ? "..." : stats.liveProjectsCount}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">Live Projects</div>
                </CardContent>
              </Card>
            </Link>
          </div>
        }

        {/* Pipeline Chart */}
        <Card className="card-professional">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">12-Month Pipeline</CardTitle>
                <p className="text-sm text-muted-foreground">Revenue forecast and budget analysis</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={showSecuredOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSecuredOnly(!showSecuredOnly)}
                  className="btn-professional">
                  {showSecuredOnly ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Show All
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Secured Only
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/pipeline/monthly")}
                  className="btn-professional">
                  View Monthly
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/pipeline/gantt")}
                  className="btn-professional">
                  View Gantt
                </Button>
              </div>
            </div>
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
                <div className="w-full" style={{ minHeight: "500px", height: "auto" }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={500}>
                    <BarChart data={filteredPipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        formatter={(value: number) => `£${value.toLocaleString()}`}
                        contentStyle={{ 
                          fontSize: 12,
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }} />
                      <Legend
                        wrapperStyle={{ paddingTop: "20px" }}
                        iconType="circle" />
                      <Bar dataKey="secured" stackId="a" fill="#22c55e" name="Secured + Projects" radius={[0, 0, 0, 0]} />
                      {!showSecuredOnly && (
                        <>
                          <Bar dataKey="highPotential" stackId="a" name="High Potential" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="bid" stackId="a" name="Bid" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                        </>
                      )}
                      <Bar dataKey="budgetGap" stackId="a" name="Budget Gap" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Monthly Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border border-border p-3 text-left text-sm font-semibold">Month</th>
                          <th className="border border-border p-3 text-right text-sm font-semibold text-green-600 dark:text-green-400">Secured + Projects</th>
                          {!showSecuredOnly && (
                            <>
                              <th className="border border-border p-3 text-right text-sm font-semibold text-blue-600 dark:text-blue-400">High Potential</th>
                              <th className="border border-border p-3 text-right text-sm font-semibold text-amber-600 dark:text-amber-400">Bid</th>
                            </>
                          )}
                          <th className="border border-border p-3 text-right text-sm font-semibold text-red-600 dark:text-red-400">Budget Gap</th>
                          <th className="border border-border p-3 text-right text-sm font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPipelineData.map((row) =>
                          <tr key={row.month} className="hover:bg-muted/30 transition-professional">
                            <td className="border border-border p-3 text-sm font-medium">{row.month}</td>
                            <td className="border border-border p-3 text-right text-sm">{formatCurrency(row.secured)}</td>
                            {!showSecuredOnly && (
                              <>
                                <td className="border border-border p-3 text-right text-sm">{formatCurrency(row.highPotential)}</td>
                                <td className="border border-border p-3 text-right text-sm">{formatCurrency(row.bid)}</td>
                              </>
                            )}
                            <td className="border border-border p-3 text-right text-sm">{formatCurrency(row.budgetGap)}</td>
                            <td className="border border-border p-3 text-right text-sm font-semibold">
                              {formatCurrency(row.secured + row.highPotential + row.bid)}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-muted font-bold">
                          <td className="border border-border p-3 text-sm">TOTAL</td>
                          <td className="border border-border p-3 text-right text-sm text-green-600 dark:text-green-400">
                            {formatCurrency(filteredPipelineData.reduce((sum, month) => sum + month.secured, 0))}
                          </td>
                          {!showSecuredOnly && (
                            <>
                              <td className="border border-border p-3 text-right text-sm text-blue-600 dark:text-blue-400">
                                {formatCurrency(filteredPipelineData.reduce((sum, month) => sum + month.highPotential, 0))}
                              </td>
                              <td className="border border-border p-3 text-right text-sm text-amber-600 dark:text-amber-400">
                                {formatCurrency(filteredPipelineData.reduce((sum, month) => sum + month.bid, 0))}
                              </td>
                            </>
                          )}
                          <td className="border border-border p-3 text-right text-sm text-red-600 dark:text-red-400">
                            {formatCurrency(filteredPipelineData.reduce((sum, month) => sum + month.budgetGap, 0))}
                          </td>
                          <td className="border border-border p-3 text-right text-sm">
                            {formatCurrency(filteredPipelineData.reduce((sum, month) => sum + month.secured + month.highPotential + month.bid, 0))}
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

        {/* Two Column Layout for Cards */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Tenders */}
          <Card className="card-professional">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-xl">Upcoming Tenders</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">Next 30 days</p>
            </CardHeader>
            <CardContent>
              {tendersError ?
                <ErrorState message={tendersError} /> :
                tendersLoading ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Loading tenders...
                </div> :
                upcomingTenders.length === 0 ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tenders due in the next 30 days
                </div> :
                <div className="space-y-3">
                  {upcomingTenders.map((opp) =>
                    <div
                      key={opp.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-professional cursor-pointer"
                      onClick={() => router.push(`/opportunities/${opp.id}`)}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-medium text-sm line-clamp-2 flex-1">
                          {opp.name}
                        </div>
                        <Badge className={`${getStageColor(opp.stage)} flex-shrink-0 text-xs font-medium`}>
                          {opp.stage.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {opp.companies?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Due: <span className="font-medium">{formatDate(opp.tender_due_date)}</span>
                      </div>
                    </div>
                  )}
                </div>
              }
            </CardContent>
          </Card>

          {/* Latest Opportunities */}
          <Card className="card-professional">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-xl">Latest Opportunities</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">Recently added</p>
            </CardHeader>
            <CardContent>
              {latestOpportunitiesError ?
                <ErrorState message={latestOpportunitiesError} /> :
                latestOpportunitiesLoading ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Loading opportunities...
                </div> :
                latestOpportunities.length === 0 ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No opportunities yet
                </div> :
                <div className="space-y-3">
                  {latestOpportunities.map((opp) =>
                    <div
                      key={opp.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-professional cursor-pointer"
                      onClick={() => router.push(`/opportunities/${opp.id}`)}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-medium text-sm line-clamp-2 flex-1">
                          {opp.name}
                        </div>
                        <Badge className={`${getStageColor(opp.stage)} flex-shrink-0 text-xs font-medium`}>
                          {opp.stage.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {opp.companies?.name}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(opp.created_at)}</span>
                        {opp.expected_fee_value &&
                          <span className="font-semibold">
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

          {/* Latest Activity */}
          <Card className="card-professional">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-xl">Latest Activity</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">Recent updates</p>
            </CardHeader>
            <CardContent>
              {activityError ?
                <ErrorState message={activityError} /> :
                activityLoading ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Loading activity...
                </div> :
                latestActivity.length === 0 ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No recent activity
                </div> :
                <div className="space-y-3">
                  {latestActivity.map((activity) =>
                    <div
                      key={`${activity.source}-${activity.id}`}
                      className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-professional cursor-pointer"
                      onClick={() => {
                        const path = activity.source === "contact" ?
                          `/contacts/${activity.source_id}` :
                          `/opportunities/${activity.source_id}`;
                        router.push(path);
                      }}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{getActivitySourceIcon(activity.source)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-semibold truncate">
                              {activity.source_name}
                            </span>
                            <Badge variant="outline" className={`text-xs ${getActivityPostTypeColor(activity.post_type)}`}>
                              {activity.post_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {activity.content}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">{activity.author_name}</span>
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

          {/* Client Visits & Functions */}
          <Card className="card-professional">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-xl">Client Visits & Functions</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">Next 7 days</p>
            </CardHeader>
            <CardContent>
              {visitsError ?
                <ErrorState message={visitsError} /> :
                visitsLoading ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Loading visits...
                </div> :
                upcomingVisits.length === 0 ?
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No visits or functions scheduled in the next 7 days
                </div> :
                <div className="space-y-3">
                  {upcomingVisits.map((visit) =>
                    <div
                      key={visit.id}
                      className="p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-professional"
                      onClick={() => router.push(`/contacts/${visit.contact_id}`)}>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-20">
                          <div className="text-sm font-semibold">
                            {formatDate(visit.event_date)}
                          </div>
                          {visit.start_time &&
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {visit.start_time.substring(0, 5)}
                              {visit.end_time && ` - ${visit.end_time.substring(0, 5)}`}
                            </div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge className={`${getEventTypeColor(visit.event_type)} flex-shrink-0 text-xs font-medium`}>
                              {visit.event_type}
                            </Badge>
                            <div className="font-medium text-sm truncate">
                              {visit.title}
                            </div>
                          </div>
                          <div className="text-sm mb-1">
                            <span className="font-medium">{visit.contacts?.name}</span>
                            {visit.contacts?.companies?.name &&
                              <span className="text-muted-foreground"> • {visit.contacts.companies.name}</span>
                            }
                          </div>
                          {visit.location &&
                            <div className="text-xs text-muted-foreground">
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

        {/* Live Opportunities & High Potentials Table */}
        <Card className="card-professional">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-2xl">Live Opportunities & High Potentials</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Active pipeline opportunities - Click column headers to sort</p>
          </CardHeader>
          <CardContent>
            {opportunitiesTableError ?
              <ErrorState message={opportunitiesTableError} /> :
              opportunitiesTableLoading ?
              <div className="text-center py-12 text-muted-foreground">
                Loading opportunities...
              </div> :
              opportunitiesTable.length === 0 ?
              <div className="text-center py-12 text-muted-foreground">
                No active opportunities in pipeline
              </div> :
              <div className="overflow-x-auto -mx-6">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
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
                        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-professional"
                        onClick={() => router.push(`/opportunities/${opp.id}`)}>
                        <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                          {opp.project_reference || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-sm">{opp.name}</div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {opp.companies?.name || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`${getStageColor(opp.stage)} text-xs font-medium`}>
                            {opp.stage === "high_potential" ? "High Potential" : opp.stage}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold">
                          {opp.expected_fee_value ? formatCurrency(opp.expected_fee_value) : "—"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {formatDate(opp.tender_due_date)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {formatDate(opp.expected_start_date)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {formatDate(opp.expected_end_date)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm">
                          {opp.probability_percent !== null ? `${opp.probability_percent}%` : "—"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50">
                      <td colSpan={4} className="py-4 px-4 text-sm font-bold">
                        Totals:
                      </td>
                      <td className="py-4 px-4 text-right text-sm">
                        {(() => {
                          const highPotentialTotal = opportunitiesTable
                            .filter((opp) => opp.stage === "high_potential")
                            .reduce((sum, opp) => sum + (opp.expected_fee_value || 0), 0);
                          const bidTotal = opportunitiesTable
                            .filter((opp) => opp.stage === "bid")
                            .reduce((sum, opp) => sum + (opp.expected_fee_value || 0), 0);

                          return (
                            <div className="space-y-1.5">
                              <div className="text-blue-600 dark:text-blue-400 font-semibold">
                                High Potential: {formatCurrency(highPotentialTotal)}
                              </div>
                              <div className="text-amber-600 dark:text-amber-400 font-semibold">
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

        {/* Quick Add Event Dialog */}
        <Dialog open={showQuickAddEvent} onOpenChange={setShowQuickAddEvent}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Quick Add Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="quick-title">Event Title *</Label>
                <Input
                  id="quick-title"
                  value={quickEventForm.title}
                  onChange={(e) =>
                    setQuickEventForm({ ...quickEventForm, title: e.target.value })
                  }
                  placeholder="Enter event title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-type">Type</Label>
                <Select
                  value={quickEventForm.event_type}
                  onValueChange={(value) =>
                    setQuickEventForm({ ...quickEventForm, event_type: value })
                  }
                >
                  <SelectTrigger id="quick-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="visit">Visit</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-date">Date *</Label>
                  <Input
                    id="quick-date"
                    type="date"
                    value={quickEventForm.event_date}
                    onChange={(e) =>
                      setQuickEventForm({ ...quickEventForm, event_date: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quick-start-time">Start Time</Label>
                  <Input
                    id="quick-start-time"
                    type="time"
                    value={quickEventForm.start_time}
                    onChange={(e) =>
                      setQuickEventForm({ ...quickEventForm, start_time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-location">Location</Label>
                <Input
                  id="quick-location"
                  value={quickEventForm.location}
                  onChange={(e) =>
                    setQuickEventForm({ ...quickEventForm, location: e.target.value })
                  }
                  placeholder="Enter location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-description">Description</Label>
                <Textarea
                  id="quick-description"
                  value={quickEventForm.description}
                  onChange={(e) =>
                    setQuickEventForm({ ...quickEventForm, description: e.target.value })
                  }
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowQuickAddEvent(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleQuickAddEvent} disabled={saving}>
                  {saving ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}