import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Edit, Trash2, Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  code: string;
  name: string;
  project_reference: string | null;
  opportunity_reference: string | null;
  status: "pipeline" | "live" | "on_hold" | "completed" | "cancelled";
  start_date: string | null;
  end_date: string | null;
  agreed_fee_value: number | null;
  notes: string | null;
  companies?: {
    name: string;
  };
  opportunities?: {
    id: string;
    name: string;
  };
}

interface Activity {
  id: string;
  name: string;
  activity_type: string | null;
  billable: boolean;
  status: string;
  notes: string | null;
}

interface Variation {
  id: string;
  code: string;
  description: string | null;
  value: number;
  status: string;
}

interface SubcontractorCost {
  id: string;
  supplier_name: string;
  description: string | null;
  cost_amount: number;
  cost_date: string;
  variation_id: string | null;
  variations?: {
    code: string;
  };
}

interface PhasingRow {
  id: string;
  project_id: string;
  year: number;
  month: number;
  revenue_amount: number;
  actual_revenue: number | null;
  invoice_status: string | null;
  invoice_ref: string | null;
  invoice_date: string | null;
}

interface MonthPhasing {
  year: number;
  month: number;
  revenue: number;
  actualRevenue: number;
  invoiceStatus: string;
  invoiceRef: string;
  invoiceDate: string;
  hasData: boolean;
}

function ProjectDetailContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [costs, setCosts] = useState<SubcontractorCost[]>([]);
  const [phasingData, setPhasingData] = useState<PhasingRow[]>([]);
  const [monthsGrid, setMonthsGrid] = useState<MonthPhasing[]>([]);
  
  // Local state for phasing edits (not saved until user clicks Save)
  const [localMonthsGrid, setLocalMonthsGrid] = useState<MonthPhasing[]>([]);
  const [phasingHasChanges, setPhasingHasChanges] = useState(false);
  const [savingPhasing, setSavingPhasing] = useState(false);
  
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Project edit state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    code: "",
    name: "",
    status: "pipeline",
    start_date: "",
    end_date: "",
    agreed_fee_value: "",
    notes: "",
  });

  // Activity form state
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({
    name: "",
    activity_type: "",
    billable: true,
    status: "not_started",
    notes: "",
  });

  // Variation form state
  const [variationFormOpen, setVariationFormOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<Variation | null>(null);
  const [variationForm, setVariationForm] = useState({
    code: "",
    description: "",
    value: "",
    status: "proposed",
  });

  // Subcontractor cost form state
  const [costFormOpen, setCostFormOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<SubcontractorCost | null>(null);
  const [costForm, setCostForm] = useState({
    supplier_name: "",
    description: "",
    cost_amount: "",
    cost_date: "",
    variation_id: "",
  });

  // Everyone can edit, only directors/admins can delete
  const canEdit = !!profile;
  const canDelete = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchProjectData(id);
    }
  }, [id]);

  const fetchProjectData = async (projectId: string) => {
    try {
      setProjectLoading(true);
      setProjectError(null);

      console.log("Fetching project:", projectId);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(`
          id,
          code,
          name,
          status,
          start_date,
          end_date,
          agreed_fee_value,
          notes,
          client_company_id,
          opportunity_id,
          companies (
            id,
            name
          ),
          opportunities!projects_opportunity_id_fkey (
            id,
            name
          )
        `)
        .eq("id", projectId)
        .single();

      if (projectError) {
        console.error("Project fetch error:", projectError);
        throw projectError;
      }

      if (!projectData) {
        setProjectError("Project not found");
        return;
      }

      console.log("Project data loaded:", projectData);

      const { data: activitiesData } = await supabase
        .from("project_activities")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      const { data: variationsData } = await supabase
        .from("variations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      const { data: costsData } = await supabase
        .from("subcontractor_costs")
        .select(`
          *,
          variations (
            code
          )
        `)
        .eq("project_id", projectId)
        .order("cost_date", { ascending: false });

      const { data: phasingDataResult } = await supabase
        .from("project_monthly_phasing")
        .select("*")
        .eq("project_id", projectId)
        .order("year", { ascending: true })
        .order("month", { ascending: true });

      setProject(projectData);
      setActivities(activitiesData || []);
      setVariations(variationsData || []);
      setCosts(costsData || []);
      setPhasingData((phasingDataResult as unknown as PhasingRow[]) || []);
      
      // Initialize project form with loaded data
      setProjectForm({
        code: projectData.code,
        name: projectData.name,
        status: projectData.status,
        start_date: projectData.start_date || "",
        end_date: projectData.end_date || "",
        agreed_fee_value: projectData.agreed_fee_value?.toString() || "",
        notes: projectData.notes || "",
      });
      
      // Generate months grid
      generateMonthsGrid(projectData, (phasingDataResult as unknown as PhasingRow[]) || []);
    } catch (err) {
      console.error("Failed to load project data", err);
      setProjectError("Failed to load project");
    } finally {
      setProjectLoading(false);
    }
  };

  const generateMonthsGrid = (proj: Project, phasing: PhasingRow[]) => {
    const now = new Date();
    const startDate = proj.start_date ? new Date(proj.start_date) : now;
    
    const gridStart = startDate < now ? startDate : now;
    
    const months: MonthPhasing[] = [];
    
    for (let i = 0; i < 24; i++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const existingPhasing = phasing.find(p => p.year === year && p.month === month);
      
      months.push({
        year,
        month,
        revenue: existingPhasing?.revenue_amount || 0,
        actualRevenue: existingPhasing?.actual_revenue || 0,
        invoiceStatus: existingPhasing?.invoice_status || "none",
        invoiceRef: existingPhasing?.invoice_ref || "",
        invoiceDate: existingPhasing?.invoice_date || null,
        hasData: !!existingPhasing,
      });
    }
    
    setMonthsGrid(months);
    setLocalMonthsGrid(months); // Initialize local state with saved data
    setPhasingHasChanges(false); // Reset changes flag
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== "string") return;

    try {
      // Determine if this should be archived
      const shouldArchive = projectForm.status === 'completed';
      
      const updates: any = {
        code: projectForm.code,
        name: projectForm.name,
        status: projectForm.status as "pipeline" | "live" | "on_hold" | "completed" | "cancelled",
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
        agreed_fee_value: projectForm.agreed_fee_value ? parseFloat(projectForm.agreed_fee_value) : null,
        notes: projectForm.notes || null,
      };

      // Add archive fields if archiving
      if (shouldArchive) {
        updates.archived = true;
        updates.archived_at = new Date().toISOString();
        updates.archived_reason = 'completed';
        updates.archived_by_user_id = profile?.id || null;
      }

      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Project updated",
        description: shouldArchive 
          ? "Project has been completed and archived successfully."
          : "Project details have been updated successfully.",
      });

      if (shouldArchive) {
        // Redirect back to projects list after archiving
        router.push("/projects");
      } else {
        await fetchProjectData(id);
        setIsEditingProject(false);
      }
    } catch (err) {
      console.error("Failed to update project", err);
      toast({
        title: "Error updating project",
        description: "Failed to update project details. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!id || typeof id !== "string") return;
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone and will delete all associated activities, variations, costs, and phasing data.")) return;

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Project deleted",
        description: "Project has been deleted successfully.",
      });

      router.push("/projects");
    } catch (err) {
      console.error("Failed to delete project", err);
      toast({
        title: "Error deleting project",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePhasingUpdate = async (
    year: number, 
    month: number, 
    field: "revenue" | "actual" | "invoiceStatus" | "invoiceRef" | "invoiceDate",
    value: number | string
  ) => {
    // Update local state only (no save yet)
    setLocalMonthsGrid(prev => {
      const updated = prev.map(m => {
        if (m.year === year && m.month === month) {
          const updatedMonth = { ...m };
          if (field === "revenue") {
            updatedMonth.revenue = typeof value === "number" ? value : 0;
          } else if (field === "actual") {
            updatedMonth.actualRevenue = typeof value === "number" ? value : 0;
          } else if (field === "invoiceStatus") {
            updatedMonth.invoiceStatus = value as string;
          } else if (field === "invoiceRef") {
            updatedMonth.invoiceRef = value as string;
          } else if (field === "invoiceDate") {
            updatedMonth.invoiceDate = value as string;
          }
          return updatedMonth;
        }
        return m;
      });
      setPhasingHasChanges(true); // Mark as having unsaved changes
      return updated;
    });
  };

  const handleSavePhasing = async () => {
    if (!id || typeof id !== "string") return;
    
    setSavingPhasing(true);
    
    try {
      // Prepare all upserts and deletes
      const upserts = [];
      const deletes = [];
      
      for (const month of localMonthsGrid) {
        const shouldDelete = 
          (!month.revenue || month.revenue === 0) &&
          (!month.actualRevenue || month.actualRevenue === 0) &&
          month.invoiceStatus === "none" &&
          !month.invoiceRef &&
          !month.invoiceDate;
        
        if (shouldDelete && month.hasData) {
          // Delete existing row
          deletes.push({ year: month.year, month: month.month });
        } else if (!shouldDelete) {
          // Upsert row
          upserts.push({
            project_id: id,
            year: month.year,
            month: month.month,
            revenue_amount: month.revenue || 0,
            actual_revenue: month.actualRevenue || null,
            invoice_status: month.invoiceStatus || "none",
            invoice_ref: month.invoiceRef || null,
            invoice_date: month.invoiceDate || null,
          });
        }
      }
      
      // Execute deletes
      if (deletes.length > 0) {
        for (const del of deletes) {
          const { error } = await supabase
            .from("project_monthly_phasing")
            .delete()
            .eq("project_id", id)
            .eq("year", del.year)
            .eq("month", del.month);
          
          if (error) throw error;
        }
      }
      
      // Execute upserts
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("project_monthly_phasing")
          .upsert(upserts, {
            onConflict: "project_id,year,month",
          });
        
        if (error) throw error;
      }
      
      // Refresh data but stay on the same page
      await fetchProjectData(id);
      
      toast({
        title: "Phasing saved",
        description: "Revenue phasing has been updated successfully.",
      });
      
      setPhasingHasChanges(false);
    } catch (error) {
      console.error("Error saving phasing:", error);
      toast({
        title: "Error saving phasing",
        description: "Failed to save phasing data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingPhasing(false);
    }
  };

  const handleDiscardPhasingChanges = () => {
    setLocalMonthsGrid([...monthsGrid]); // Reset to saved state
    setPhasingHasChanges(false);
  };

  const handleAutoFill = async () => {
    if (!id || typeof id !== "string" || !project) return;
    
    if (!project.start_date || !project.end_date) {
      alert("Project must have start and end dates to auto-fill phasing.");
      return;
    }
    
    if (!confirm("Auto-fill will distribute revenue evenly across project duration. Continue?")) {
      return;
    }
    
    // Calculate total fee (agreed fee + accepted variations)
    let totalFee = project.agreed_fee_value || 0;
    
    const acceptedVariations = variations.filter(v => v.status === "accepted");
    acceptedVariations.forEach(v => {
      totalFee += v.value;
    });
    
    if (totalFee === 0) {
      alert("No revenue to distribute (agreed fee + accepted variations = 0).");
      return;
    }
    
    // Calculate months between start and end
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    
    const months: { year: number; month: number }[] = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    while (current <= endDate) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
      });
      current.setMonth(current.getMonth() + 1);
    }
    
    if (months.length === 0) {
      alert("No months in project date range.");
      return;
    }
    
    // Distribute evenly
    const perMonth = totalFee / months.length;
    
    // Upsert all months
    const upserts = months.map(m => ({
      project_id: id,
      year: m.year,
      month: m.month,
      revenue_amount: perMonth,
    }));
    
    const { error } = await supabase
      .from("project_monthly_phasing")
      .upsert(upserts, {
        onConflict: "project_id,year,month",
      });
    
    if (error) {
      alert("Error auto-filling phasing: " + error.message);
      return;
    }
    
    // Refresh data
    await fetchProjectData(id);
  };

  const handleClearPhasing = async () => {
    if (!id || typeof id !== "string") return;
    
    if (!confirm("Clear all phasing data? This will revert to automatic date-based allocation.")) {
      return;
    }
    
    const { error } = await supabase
      .from("project_monthly_phasing")
      .delete()
      .eq("project_id", id);
    
    if (error) {
      alert("Error clearing phasing: " + error.message);
      return;
    }
    
    // Refresh data
    await fetchProjectData(id);
  };

  // Activity handlers
  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== "string") return;

    if (editingActivity) {
      const { error } = await supabase
        .from("project_activities")
        .update({
          name: activityForm.name,
          activity_type: activityForm.activity_type || null,
          billable: activityForm.billable,
          status: activityForm.status as "not_started" | "in_progress" | "complete",
          notes: activityForm.notes || null,
        })
        .eq("id", editingActivity.id);

      if (error) {
        alert("Error updating activity");
        return;
      }
    } else {
      const { error } = await supabase
        .from("project_activities")
        .insert({
          project_id: id,
          name: activityForm.name,
          activity_type: activityForm.activity_type || null,
          billable: activityForm.billable,
          status: activityForm.status as "not_started" | "in_progress" | "complete",
          notes: activityForm.notes || null,
        });

      if (error) {
        alert("Error creating activity");
        return;
      }
    }

    await fetchProjectData(id);
    setActivityFormOpen(false);
    setEditingActivity(null);
    setActivityForm({
      name: "",
      activity_type: "",
      billable: true,
      status: "not_started",
      notes: "",
    });
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityForm({
      name: activity.name,
      activity_type: activity.activity_type || "",
      billable: activity.billable,
      status: activity.status,
      notes: activity.notes || "",
    });
    setActivityFormOpen(true);
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Delete this activity?")) return;

    const { error } = await supabase
      .from("project_activities")
      .delete()
      .eq("id", activityId);

    if (error) {
      alert("Error deleting activity");
      return;
    }

    if (id && typeof id === "string") {
      await fetchProjectData(id);
    }
  };

  // Variation handlers
  const handleVariationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== "string") return;

    if (editingVariation) {
      const { error } = await supabase
        .from("variations")
        .update({
          code: variationForm.code,
          description: variationForm.description || null,
          value: parseFloat(variationForm.value),
          status: variationForm.status as "proposed" | "accepted" | "rejected",
        })
        .eq("id", editingVariation.id);

      if (error) {
        alert("Error updating variation");
        return;
      }
    } else {
      const { error } = await supabase
        .from("variations")
        .insert({
          project_id: id,
          code: variationForm.code,
          description: variationForm.description || null,
          value: parseFloat(variationForm.value),
          status: variationForm.status as "proposed" | "accepted" | "rejected",
        });

      if (error) {
        alert("Error creating variation");
        return;
      }
    }

    await fetchProjectData(id);
    setVariationFormOpen(false);
    setEditingVariation(null);
    setVariationForm({
      code: "",
      description: "",
      value: "",
      status: "proposed",
    });
  };

  const handleEditVariation = (variation: Variation) => {
    setEditingVariation(variation);
    setVariationForm({
      code: variation.code,
      description: variation.description || "",
      value: variation.value.toString(),
      status: variation.status,
    });
    setVariationFormOpen(true);
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (!confirm("Delete this variation?")) return;

    const { error } = await supabase
      .from("variations")
      .delete()
      .eq("id", variationId);

    if (error) {
      alert("Error deleting variation");
      return;
    }

    if (id && typeof id === "string") {
      await fetchProjectData(id);
    }
  };

  // Subcontractor cost handlers
  const handleCostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== "string") return;

    if (editingCost) {
      const { error } = await supabase
        .from("subcontractor_costs")
        .update({
          supplier_name: costForm.supplier_name,
          description: costForm.description || null,
          cost_amount: parseFloat(costForm.cost_amount),
          cost_date: costForm.cost_date,
          variation_id: costForm.variation_id || null,
        })
        .eq("id", editingCost.id);

      if (error) {
        alert("Error updating cost");
        return;
      }
    } else {
      const { error } = await supabase
        .from("subcontractor_costs")
        .insert({
          project_id: id,
          supplier_name: costForm.supplier_name,
          description: costForm.description || null,
          cost_amount: parseFloat(costForm.cost_amount),
          cost_date: costForm.cost_date,
          variation_id: costForm.variation_id || null,
        });

      if (error) {
        alert("Error creating cost");
        return;
      }
    }

    await fetchProjectData(id);
    setCostFormOpen(false);
    setEditingCost(null);
    setCostForm({
      supplier_name: "",
      description: "",
      cost_amount: "",
      cost_date: "",
      variation_id: "",
    });
  };

  const handleEditCost = (cost: SubcontractorCost) => {
    setEditingCost(cost);
    setCostForm({
      supplier_name: cost.supplier_name,
      description: cost.description || "",
      cost_amount: cost.cost_amount.toString(),
      cost_date: cost.cost_date,
      variation_id: cost.variation_id || "",
    });
    setCostFormOpen(true);
  };

  const handleDeleteCost = async (costId: string) => {
    if (!confirm("Delete this cost?")) return;

    const { error } = await supabase
      .from("subcontractor_costs")
      .delete()
      .eq("id", costId);

    if (error) {
      alert("Error deleting cost");
      return;
    }

    if (id && typeof id === "string") {
      await fetchProjectData(id);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
      case "complete":
      case "accepted":
        return "bg-green-100 text-green-800";
      case "pipeline":
      case "in_progress":
      case "proposed":
        return "bg-blue-100 text-blue-800";
      case "on_hold":
      case "not_started":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-slate-100 text-slate-800";
      case "cancelled":
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleDateString("en-GB", { month: "short" });
  };

  const getTotalPhasedRevenue = () => {
    return phasingData.reduce((sum, p) => sum + p.revenue_amount, 0);
  };

  const getTotalActualRevenue = () => {
    return phasingData.reduce((sum, p) => sum + (p.actual_revenue || 0), 0);
  };

  const getTotalProjectFee = () => {
    let total = project?.agreed_fee_value || 0;
    variations.filter(v => v.status === "accepted").forEach(v => {
      total += v.value;
    });
    return total;
  };

  if (projectLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (projectError || !project) {
    return (
      <Layout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertDescription>{projectError}</AlertDescription>
          </Alert>
          <Link href="/projects">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {project.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 ml-2 sm:ml-0">
              {project.project_reference && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                  {project.project_reference}
                </span>
              )}
              {project.opportunity_reference && (
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                  Origin: {project.opportunity_reference}
                </span>
              )}
              <span>•</span>
              <span className="font-medium">{project.code}</span>
            </div>
          </div>

        {/* Error State */}
        {projectError && (
          <Alert variant="destructive">
            <AlertDescription>{projectError}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {projectLoading && !projectError && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-slate-600">Loading project...</div>
            </CardContent>
          </Card>
        )}

        {/* Project Content */}
        {!projectLoading && !projectError && project && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-500">{project.code}</span>
                  <CardTitle className="text-2xl">{project.name}</CardTitle>
                  <Badge className={getStatusColor(project.status)}>
                    {project.status.replace("_", " ")}
                  </Badge>
                </div>
                {canDelete && !isEditingProject && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingProject(true)} className="gap-2">
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteProject} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isEditingProject ? (
                  <form onSubmit={handleUpdateProject} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-code">Project Code *</Label>
                        <Input
                          id="edit-code"
                          value={projectForm.code}
                          onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-status">Status</Label>
                        <Select
                          value={projectForm.status}
                          onValueChange={(value) => setProjectForm({ ...projectForm, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pipeline">Pipeline</SelectItem>
                            <SelectItem value="live">Live</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Project Name *</Label>
                      <Input
                        id="edit-name"
                        value={projectForm.name}
                        onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-start-date">Start Date</Label>
                        <Input
                          id="edit-start-date"
                          type="date"
                          value={projectForm.start_date}
                          onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-end-date">End Date</Label>
                        <Input
                          id="edit-end-date"
                          type="date"
                          value={projectForm.end_date}
                          onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-fee">Agreed Fee (£)</Label>
                        <Input
                          id="edit-fee"
                          type="number"
                          step="0.01"
                          min="0"
                          value={projectForm.agreed_fee_value}
                          onChange={(e) => setProjectForm({ ...projectForm, agreed_fee_value: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-notes">Notes</Label>
                      <Textarea
                        id="edit-notes"
                        value={projectForm.notes}
                        onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button type="submit">Save Changes</Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditingProject(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {project.companies && (
                        <div>
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Client
                          </div>
                          <div className="text-slate-900">
                            {project.companies.name}
                          </div>
                        </div>
                      )}
                      
                      {project.opportunities && (
                        <div>
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Linked Opportunity
                          </div>
                          <div className="text-slate-900">
                            {project.opportunities.name}
                          </div>
                        </div>
                      )}

                      {project.agreed_fee_value && (
                        <div>
                          <div className="text-sm font-medium text-slate-500 mb-1">Agreed Fee</div>
                          <div className="text-slate-900 font-semibold">
                            {formatCurrency(project.agreed_fee_value)}
                          </div>
                        </div>
                      )}

                      {project.start_date && (
                        <div>
                          <div className="text-sm font-medium text-slate-500 mb-1">Start Date</div>
                          <div className="text-slate-900">
                            {formatDate(project.start_date)}
                          </div>
                        </div>
                      )}

                      {project.end_date && (
                        <div>
                          <div className="text-sm font-medium text-slate-500 mb-1">End Date</div>
                          <div className="text-slate-900">
                            {formatDate(project.end_date)}
                          </div>
                        </div>
                      )}
                    </div>

                    {project.notes && (
                      <div>
                        <div className="text-sm font-medium text-slate-500 mb-1">Notes</div>
                        <div className="text-slate-900 whitespace-pre-wrap">
                          {project.notes}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Source Opportunity Section */}
            {project.opportunities && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Source Opportunity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
                    <div>
                      <div className="text-sm font-medium text-slate-500 mb-1">
                        Created from opportunity
                      </div>
                      <div className="font-semibold text-slate-900">
                        {project.opportunities.name}
                      </div>
                    </div>
                    <Link href={`/opportunities/${project.opportunities.id}`}>
                      <Button variant="outline" size="sm">
                        View Opportunity
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="activities" className="w-full">
              <TabsList>
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="variations">Variations</TabsTrigger>
                <TabsTrigger value="costs">Subcontractor Costs</TabsTrigger>
                <TabsTrigger value="phasing">Phasing</TabsTrigger>
              </TabsList>

              <TabsContent value="activities">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Project Activities</CardTitle>
                    {canEdit && (
                      <Dialog open={activityFormOpen} onOpenChange={setActivityFormOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2" onClick={() => {
                            setEditingActivity(null);
                            setActivityForm({
                              name: "",
                              activity_type: "",
                              billable: true,
                              status: "not_started",
                              notes: "",
                            });
                          }}>
                            <Plus className="w-4 h-4" />
                            New Activity
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{editingActivity ? "Edit Activity" : "New Activity"}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleActivitySubmit} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="activity_name">Name *</Label>
                              <Input
                                id="activity_name"
                                value={activityForm.name}
                                onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="activity_type">Type</Label>
                              <Input
                                id="activity_type"
                                value={activityForm.activity_type}
                                onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                                placeholder="e.g., Design, Review, Coordination"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="status">Status</Label>
                              <Select
                                value={activityForm.status}
                                onValueChange={(value) => setActivityForm({ ...activityForm, status: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="not_started">Not Started</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="complete">Complete</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="billable"
                                checked={activityForm.billable}
                                onCheckedChange={(checked) => setActivityForm({ ...activityForm, billable: checked === true })}
                              />
                              <Label htmlFor="billable">Billable</Label>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="activity_notes">Notes</Label>
                              <Textarea
                                id="activity_notes"
                                value={activityForm.notes}
                                onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                                rows={3}
                              />
                            </div>

                            <div className="flex gap-3">
                              <Button type="submit">
                                {editingActivity ? "Update" : "Create"}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setActivityFormOpen(false)}>
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardHeader>
                  <CardContent>
                    {activities.length === 0 ? (
                      <div className="text-center py-8 text-slate-600">
                        No activities yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activities.map((activity) => (
                          <div key={activity.id} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-medium text-slate-900">{activity.name}</h4>
                                  <Badge className={getStatusColor(activity.status)}>
                                    {activity.status.replace("_", " ")}
                                  </Badge>
                                  {activity.billable && (
                                    <Badge variant="outline">Billable</Badge>
                                  )}
                                </div>
                                {activity.activity_type && (
                                  <div className="text-sm text-slate-600 mb-1">
                                    Type: {activity.activity_type}
                                  </div>
                                )}
                                {activity.notes && (
                                  <div className="text-sm text-slate-600 whitespace-pre-wrap">
                                    {activity.notes}
                                  </div>
                                )}
                              </div>
                              {canEdit && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditActivity(activity)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteActivity(activity.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variations">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Variations</CardTitle>
                    {canEdit && (
                      <Dialog open={variationFormOpen} onOpenChange={setVariationFormOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2" onClick={() => {
                            setEditingVariation(null);
                            setVariationForm({
                              code: "",
                              description: "",
                              value: "",
                              status: "proposed",
                            });
                          }}>
                            <Plus className="w-4 h-4" />
                            New Variation
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{editingVariation ? "Edit Variation" : "New Variation"}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleVariationSubmit} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="variation_code">Code *</Label>
                              <Input
                                id="variation_code"
                                value={variationForm.code}
                                onChange={(e) => setVariationForm({ ...variationForm, code: e.target.value })}
                                placeholder="e.g., VAR-001"
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="variation_description">Description</Label>
                              <Textarea
                                id="variation_description"
                                value={variationForm.description}
                                onChange={(e) => setVariationForm({ ...variationForm, description: e.target.value })}
                                rows={3}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="variation_value">Value (£) *</Label>
                              <Input
                                id="variation_value"
                                type="number"
                                step="0.01"
                                value={variationForm.value}
                                onChange={(e) => setVariationForm({ ...variationForm, value: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="variation_status">Status</Label>
                              <Select
                                value={variationForm.status}
                                onValueChange={(value) => setVariationForm({ ...variationForm, status: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="proposed">Proposed</SelectItem>
                                  <SelectItem value="accepted">Accepted</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex gap-3">
                              <Button type="submit">
                                {editingVariation ? "Update" : "Create"}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setVariationFormOpen(false)}>
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardHeader>
                  <CardContent>
                    {variations.length === 0 ? (
                      <div className="text-center py-8 text-slate-600">
                        No variations yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {variations.map((variation) => (
                          <div key={variation.id} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-mono text-sm text-slate-500">{variation.code}</span>
                                  <Badge className={getStatusColor(variation.status)}>
                                    {variation.status}
                                  </Badge>
                                </div>
                                {variation.description && (
                                  <div className="text-sm text-slate-600 mb-2 whitespace-pre-wrap">
                                    {variation.description}
                                  </div>
                                )}
                                <div className="text-lg font-semibold text-slate-900">
                                  {formatCurrency(variation.value)}
                                </div>
                              </div>
                              {canEdit && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditVariation(variation)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteVariation(variation.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="costs">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Subcontractor Costs</CardTitle>
                    {canEdit && (
                      <Dialog open={costFormOpen} onOpenChange={setCostFormOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2" onClick={() => {
                            setEditingCost(null);
                            setCostForm({
                              supplier_name: "",
                              description: "",
                              cost_amount: "",
                              cost_date: "",
                              variation_id: "",
                            });
                          }}>
                            <Plus className="w-4 h-4" />
                            New Cost
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{editingCost ? "Edit Cost" : "New Subcontractor Cost"}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleCostSubmit} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="supplier_name">Supplier Name *</Label>
                              <Input
                                id="supplier_name"
                                value={costForm.supplier_name}
                                onChange={(e) => setCostForm({ ...costForm, supplier_name: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="cost_description">Description</Label>
                              <Textarea
                                id="cost_description"
                                value={costForm.description}
                                onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                                rows={3}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="cost_amount">Cost Amount (£) *</Label>
                                <Input
                                  id="cost_amount"
                                  type="number"
                                  step="0.01"
                                  value={costForm.cost_amount}
                                  onChange={(e) => setCostForm({ ...costForm, cost_amount: e.target.value })}
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="cost_date">Date *</Label>
                                <Input
                                  id="cost_date"
                                  type="date"
                                  value={costForm.cost_date}
                                  onChange={(e) => setCostForm({ ...costForm, cost_date: e.target.value })}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="cost_variation">Variation (Optional)</Label>
                              <Select
                                value={costForm.variation_id}
                                onValueChange={(value) => setCostForm({ ...costForm, variation_id: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">None</SelectItem>
                                  {variations.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex gap-3">
                              <Button type="submit">
                                {editingCost ? "Update" : "Create"}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setCostFormOpen(false)}>
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardHeader>
                  <CardContent>
                    {costs.length === 0 ? (
                      <div className="text-center py-8 text-slate-600">
                        No subcontractor costs yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {costs.map((cost) => (
                          <div key={cost.id} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-medium text-slate-900">{cost.supplier_name}</h4>
                                  {cost.variations && (
                                    <Badge variant="outline">{cost.variations.code}</Badge>
                                  )}
                                </div>
                                {cost.description && (
                                  <div className="text-sm text-slate-600 mb-2 whitespace-pre-wrap">
                                    {cost.description}
                                  </div>
                                )}
                                <div className="flex items-center gap-4">
                                  <div className="text-lg font-semibold text-slate-900">
                                    {formatCurrency(cost.cost_amount)}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {formatDate(cost.cost_date)}
                                  </div>
                                </div>
                              </div>
                              {canEdit && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditCost(cost)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteCost(cost.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="phasing">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-5 h-5 text-slate-600" />
                      <CardTitle>Revenue Phasing</CardTitle>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleAutoFill}>
                          Auto-fill evenly
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleClearPhasing}>
                          Clear phasing
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Save/Discard buttons - show when there are unsaved changes */}
                      {canEdit && phasingHasChanges && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium text-blue-900">You have unsaved changes</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleDiscardPhasingChanges}>
                              Discard
                            </Button>
                            <Button size="sm" onClick={handleSavePhasing} disabled={savingPhasing}>
                              {savingPhasing ? "Saving..." : "Save Phasing"}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="text-sm text-slate-600">
                        {phasingData.length === 0 ? (
                          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                            <p className="font-medium text-blue-900 mb-1">Automatic allocation active</p>
                            <p className="text-blue-700 text-sm">
                              Revenue is automatically spread across project duration using day-based allocation.
                              Set manual phasing below to override the automatic calculation.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-orange-50 border border-orange-200 rounded p-4 mb-4">
                            <p className="font-medium text-orange-900 mb-1">Manual phasing active</p>
                            <p className="text-orange-700 text-sm">
                              This project uses manual month-by-month revenue allocation.
                              Clear phasing to revert to automatic day-based spread.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-medium text-slate-600">Month</th>
                              <th className="text-right p-2 font-medium text-slate-600">Forecast (£)</th>
                              <th className="text-right p-2 font-medium text-slate-600">Actual (£)</th>
                              <th className="text-left p-2 font-medium text-slate-600">Invoice Status</th>
                              <th className="text-left p-2 font-medium text-slate-600">Invoice Ref</th>
                              <th className="text-left p-2 font-medium text-slate-600">Invoice Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {localMonthsGrid.map((m, idx) => (
                              <tr key={idx} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-900">
                                  {getMonthName(m.month)} {m.year}
                                </td>
                                <td className="p-2">
                                  {canEdit ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={m.revenue || ""}
                                      onChange={(e) => {
                                        const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                        handlePhasingUpdate(m.year, m.month, "revenue", value);
                                      }}
                                      className="text-right h-8"
                                      placeholder="0"
                                    />
                                  ) : (
                                    <div className="text-right">
                                      {formatCurrency(m.revenue)}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2">
                                  {canEdit ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={m.actualRevenue || ""}
                                      onChange={(e) => {
                                        const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                        handlePhasingUpdate(m.year, m.month, "actual", value);
                                      }}
                                      className="text-right h-8"
                                      placeholder="0"
                                    />
                                  ) : (
                                    <div className="text-right">
                                      {formatCurrency(m.actualRevenue)}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2">
                                  {canEdit ? (
                                    <Select
                                      value={m.invoiceStatus}
                                      onValueChange={(value) => handlePhasingUpdate(m.year, m.month, "invoiceStatus", value)}
                                    >
                                      <SelectTrigger className="h-8 w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="to_invoice">To Invoice</SelectItem>
                                        <SelectItem value="invoiced">Invoiced</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline" className="capitalize">
                                      {m.invoiceStatus.replace("_", " ")}
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-2">
                                  {canEdit ? (
                                    <Input
                                      type="text"
                                      value={m.invoiceRef || ""}
                                      onChange={(e) => handlePhasingUpdate(m.year, m.month, "invoiceRef", e.target.value)}
                                      className="h-8"
                                      placeholder="INV-001"
                                      disabled={m.invoiceStatus === "none" || m.invoiceStatus === "to_invoice"}
                                    />
                                  ) : (
                                    <div className="text-slate-900">{m.invoiceRef || "—"}</div>
                                  )}
                                </td>
                                <td className="p-2">
                                  {canEdit ? (
                                    <Input
                                      type="date"
                                      value={m.invoiceDate || ""}
                                      onChange={(e) => handlePhasingUpdate(m.year, m.month, "invoiceDate", e.target.value)}
                                      className="h-8 w-36"
                                      disabled={m.invoiceStatus === "none" || m.invoiceStatus === "to_invoice"}
                                    />
                                  ) : (
                                    <div className="text-slate-900">{m.invoiceDate ? formatDate(m.invoiceDate) : "—"}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary - use localMonthsGrid for real-time calculation */}
                      <div className="border-t pt-4 mt-4">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-slate-500 mb-1">Total forecast revenue</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {formatCurrency(localMonthsGrid.reduce((sum, m) => sum + (m.revenue || 0), 0))}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Total actual revenue</div>
                            <div className="text-lg font-semibold text-green-600">
                              {formatCurrency(localMonthsGrid.reduce((sum, m) => sum + (m.actualRevenue || 0), 0))}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Project agreed fee</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {formatCurrency(getTotalProjectFee())}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Forecast difference</div>
                            <div className={`text-lg font-semibold ${
                              Math.abs(localMonthsGrid.reduce((sum, m) => sum + (m.revenue || 0), 0) - getTotalProjectFee()) > 0.01
                                ? "text-orange-600"
                                : "text-green-600"
                            }`}>
                              {formatCurrency(localMonthsGrid.reduce((sum, m) => sum + (m.revenue || 0), 0) - getTotalProjectFee())}
                            </div>
                          </div>
                        </div>
                        {Math.abs(localMonthsGrid.reduce((sum, m) => sum + (m.revenue || 0), 0) - getTotalProjectFee()) > 0.01 && (
                          <div className="mt-3 text-xs text-orange-600">
                            ⚠️ Forecast phased revenue does not match project fee. Adjust phasing or use "Auto-fill evenly".
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}

export default function ProjectDetailPage() {
  return (
    <RequireAuth>
      <ProjectDetailContent />
    </RequireAuth>
  );
}