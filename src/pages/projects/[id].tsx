import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase, Project, Company, ProjectActivity, Variation, Timesheet, SubcontractorCost, Profile } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Edit, Plus, Trash2, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

interface ProjectWithRelations extends Project {
  company?: Company;
  activities?: ProjectActivity[];
  variations?: Variation[];
  timesheets?: (Timesheet & { profile?: Profile })[];
  subcontractor_costs?: SubcontractorCost[];
}

export default function ProjectDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [editFormData, setEditFormData] = useState({
    code: "",
    name: "",
    start_date: "",
    end_date: "",
    status: "pipeline" as "pipeline" | "live" | "on_hold" | "completed",
    agreed_fee_value: "",
    notes: "",
  });

  // Activity form state
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ProjectActivity | null>(null);
  const [activityFormData, setActivityFormData] = useState({
    name: "",
    activity_type: "",
    billable: true,
    status: "not_started" as "not_started" | "in_progress" | "complete",
    notes: "",
  });

  // Variation form state
  const [variationFormOpen, setVariationFormOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<Variation | null>(null);
  const [variationFormData, setVariationFormData] = useState({
    code: "",
    description: "",
    value: "",
    status: "proposed" as "proposed" | "accepted" | "rejected",
  });

  // Subcontractor cost form state
  const [costFormOpen, setCostFormOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<SubcontractorCost | null>(null);
  const [costFormData, setCostFormData] = useState({
    supplier_name: "",
    description: "",
    cost_amount: "",
    cost_date: "",
    variation_id: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (id && typeof id === "string" && user) {
      fetchProjectData(id);
    }
  }, [id, user]);

  const fetchProjectData = async (projectId: string) => {
    setLoading(true);
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        companies!projects_client_company_id_fkey (
          *
        )
      `)
      .eq("id", projectId)
      .single();

    if (projectError || !projectData) {
      setError("Project not found");
      setLoading(false);
      return;
    }

    // Fetch activities
    const { data: activitiesData } = await supabase
      .from("project_activities")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");

    // Fetch variations
    const { data: variationsData } = await supabase
      .from("variations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");

    // Fetch timesheets with user profiles
    const { data: timesheetsData } = await supabase
      .from("timesheets")
      .select(`
        *,
        profiles!timesheets_user_id_fkey (
          id,
          full_name,
          default_hourly_cost_rate
        )
      `)
      .eq("project_id", projectId)
      .order("date", { ascending: false });

    // Fetch subcontractor costs
    const { data: costsData } = await supabase
      .from("subcontractor_costs")
      .select("*")
      .eq("project_id", projectId)
      .order("cost_date", { ascending: false });

    const formatted: ProjectWithRelations = {
      ...projectData,
      company: projectData.companies,
      activities: activitiesData || [],
      variations: variationsData || [],
      timesheets: timesheetsData?.map((ts: any) => ({
        ...ts,
        profile: ts.profiles,
        profiles: undefined,
      })) || [],
      subcontractor_costs: costsData || [],
    };

    setProject(formatted);
    setEditFormData({
      code: projectData.code,
      name: projectData.name,
      start_date: projectData.start_date || "",
      end_date: projectData.end_date || "",
      status: projectData.status,
      agreed_fee_value: projectData.agreed_fee_value?.toString() || "",
      notes: projectData.notes || "",
    });

    setLoading(false);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (typeof id !== "string") return;

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        code: editFormData.code,
        name: editFormData.name,
        start_date: editFormData.start_date || null,
        end_date: editFormData.end_date || null,
        status: editFormData.status,
        agreed_fee_value: editFormData.agreed_fee_value ? parseFloat(editFormData.agreed_fee_value) : null,
        notes: editFormData.notes || null,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await fetchProjectData(id);
    setIsEditing(false);
  };

  // Activity handlers
  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof id !== "string") return;

    if (editingActivity) {
      const { error } = await supabase
        .from("project_activities")
        .update({
          name: activityFormData.name,
          activity_type: activityFormData.activity_type || null,
          billable: activityFormData.billable,
          status: activityFormData.status,
          notes: activityFormData.notes || null,
        })
        .eq("id", editingActivity.id);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("project_activities").insert({
        project_id: id,
        name: activityFormData.name,
        activity_type: activityFormData.activity_type || null,
        billable: activityFormData.billable,
        status: activityFormData.status,
        notes: activityFormData.notes || null,
      });

      if (error) {
        setError(error.message);
        return;
      }
    }

    await fetchProjectData(id);
    setActivityFormOpen(false);
    setEditingActivity(null);
    resetActivityForm();
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;
    if (typeof id !== "string") return;

    const { error } = await supabase
      .from("project_activities")
      .delete()
      .eq("id", activityId);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchProjectData(id);
  };

  const resetActivityForm = () => {
    setActivityFormData({
      name: "",
      activity_type: "",
      billable: true,
      status: "not_started",
      notes: "",
    });
  };

  const openActivityForm = (activity?: ProjectActivity) => {
    if (activity) {
      setEditingActivity(activity);
      setActivityFormData({
        name: activity.name,
        activity_type: activity.activity_type || "",
        billable: activity.billable,
        status: activity.status,
        notes: activity.notes || "",
      });
    } else {
      setEditingActivity(null);
      resetActivityForm();
    }
    setActivityFormOpen(true);
  };

  // Variation handlers
  const handleSaveVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof id !== "string") return;

    if (editingVariation) {
      const { error } = await supabase
        .from("variations")
        .update({
          code: variationFormData.code,
          description: variationFormData.description || null,
          value: parseFloat(variationFormData.value),
          status: variationFormData.status,
        })
        .eq("id", editingVariation.id);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("variations").insert({
        project_id: id,
        code: variationFormData.code,
        description: variationFormData.description || null,
        value: parseFloat(variationFormData.value),
        status: variationFormData.status,
      });

      if (error) {
        setError(error.message);
        return;
      }
    }

    await fetchProjectData(id);
    setVariationFormOpen(false);
    setEditingVariation(null);
    resetVariationForm();
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (!confirm("Are you sure you want to delete this variation?")) return;
    if (typeof id !== "string") return;

    const { error } = await supabase
      .from("variations")
      .delete()
      .eq("id", variationId);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchProjectData(id);
  };

  const resetVariationForm = () => {
    setVariationFormData({
      code: "",
      description: "",
      value: "",
      status: "proposed",
    });
  };

  const openVariationForm = (variation?: Variation) => {
    if (variation) {
      setEditingVariation(variation);
      setVariationFormData({
        code: variation.code,
        description: variation.description || "",
        value: variation.value.toString(),
        status: variation.status,
      });
    } else {
      setEditingVariation(null);
      resetVariationForm();
    }
    setVariationFormOpen(true);
  };

  // Subcontractor cost handlers
  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof id !== "string") return;

    if (editingCost) {
      const { error } = await supabase
        .from("subcontractor_costs")
        .update({
          supplier_name: costFormData.supplier_name,
          description: costFormData.description || null,
          cost_amount: parseFloat(costFormData.cost_amount),
          cost_date: costFormData.cost_date,
          variation_id: costFormData.variation_id || null,
        })
        .eq("id", editingCost.id);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("subcontractor_costs").insert({
        project_id: id,
        supplier_name: costFormData.supplier_name,
        description: costFormData.description || null,
        cost_amount: parseFloat(costFormData.cost_amount),
        cost_date: costFormData.cost_date,
        variation_id: costFormData.variation_id || null,
      });

      if (error) {
        setError(error.message);
        return;
      }
    }

    await fetchProjectData(id);
    setCostFormOpen(false);
    setEditingCost(null);
    resetCostForm();
  };

  const handleDeleteCost = async (costId: string) => {
    if (!confirm("Are you sure you want to delete this cost?")) return;
    if (typeof id !== "string") return;

    const { error } = await supabase
      .from("subcontractor_costs")
      .delete()
      .eq("id", costId);

    if (error) {
      setError(error.message);
      return;
    }

    await fetchProjectData(id);
  };

  const resetCostForm = () => {
    setCostFormData({
      supplier_name: "",
      description: "",
      cost_amount: "",
      cost_date: "",
      variation_id: "",
    });
  };

  const openCostForm = (cost?: SubcontractorCost) => {
    if (cost) {
      setEditingCost(cost);
      setCostFormData({
        supplier_name: cost.supplier_name,
        description: cost.description || "",
        cost_amount: cost.cost_amount.toString(),
        cost_date: cost.cost_date,
        variation_id: cost.variation_id || "",
      });
    } else {
      setEditingCost(null);
      resetCostForm();
    }
    setCostFormOpen(true);
  };

  // Financial calculations
  const calculateFinancials = () => {
    const agreedFee = project?.agreed_fee_value || 0;
    const acceptedVariations = project?.variations
      ?.filter((v) => v.status === "accepted")
      .reduce((sum, v) => sum + v.value, 0) || 0;
    const totalRevenue = agreedFee + acceptedVariations;

    const internalCost = project?.timesheets?.reduce((sum, ts) => {
      const hourlyRate = ts.profile?.default_hourly_cost_rate || 0;
      return sum + (ts.hours * hourlyRate);
    }, 0) || 0;

    const subcontractorCost = project?.subcontractor_costs?.reduce((sum, sc) => sum + sc.cost_amount, 0) || 0;
    const totalCost = internalCost + subcontractorCost;
    const margin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    return {
      agreedFee,
      acceptedVariations,
      totalRevenue,
      internalCost,
      subcontractorCost,
      totalCost,
      margin,
      marginPercent,
    };
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-green-100 text-green-800";
      case "pipeline":
        return "bg-blue-100 text-blue-800";
      case "on_hold":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "not_started":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getVariationStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "proposed":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (error && !project) {
    return (
      <Layout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
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

  const isAdmin = profile?.role === "admin" || profile?.role === "director";
  const financials = calculateFinancials();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-slate-500">{project?.code}</span>
              <CardTitle className="text-2xl">{project?.name}</CardTitle>
              {project && (
                <Badge className={getStatusColor(project.status)}>
                  {project.status.replace("_", " ")}
                </Badge>
              )}
            </div>
            {isAdmin && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form onSubmit={handleUpdateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Project Code *</Label>
                    <Input
                      id="code"
                      value={editFormData.code}
                      onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editFormData.status}
                      onValueChange={(value: "pipeline" | "live" | "on_hold" | "completed") =>
                        setEditFormData({ ...editFormData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pipeline">Pipeline</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={editFormData.start_date}
                      onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={editFormData.end_date}
                      onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agreed_fee_value">Agreed Fee (£)</Label>
                    <Input
                      id="agreed_fee_value"
                      type="number"
                      step="0.01"
                      value={editFormData.agreed_fee_value}
                      onChange={(e) => setEditFormData({ ...editFormData, agreed_fee_value: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit">Save Changes</Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {project?.company && (
                    <div>
                      <div className="text-sm font-medium text-slate-500">Client</div>
                      <div className="text-slate-900">{project.company.name}</div>
                    </div>
                  )}
                  {project?.start_date && (
                    <div>
                      <div className="text-sm font-medium text-slate-500">Start Date</div>
                      <div className="text-slate-900">{formatDate(project.start_date)}</div>
                    </div>
                  )}
                  {project?.end_date && (
                    <div>
                      <div className="text-sm font-medium text-slate-500">End Date</div>
                      <div className="text-slate-900">{formatDate(project.end_date)}</div>
                    </div>
                  )}
                </div>
                {project?.notes && (
                  <div>
                    <div className="text-sm font-medium text-slate-500 mb-1">Notes</div>
                    <div className="text-slate-900 whitespace-pre-wrap">{project.notes}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">Agreed Fee</div>
                <div className="text-2xl font-bold text-slate-900">{formatCurrency(financials.agreedFee)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Variations</div>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(financials.acceptedVariations)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Total Revenue</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(financials.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Total Cost</div>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(financials.totalCost)}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">Internal Cost</div>
                <div className="text-lg font-semibold text-slate-900">{formatCurrency(financials.internalCost)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Subcontractor Cost</div>
                <div className="text-lg font-semibold text-slate-900">{formatCurrency(financials.subcontractorCost)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Margin</div>
                <div className={`text-lg font-semibold flex items-center gap-1 ${financials.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {financials.margin >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {formatCurrency(financials.margin)}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Margin %</div>
                <div className={`text-lg font-semibold ${financials.marginPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {financials.marginPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Activities, Variations, Costs, Timesheets */}
        <Tabs defaultValue="activities">
          <TabsList>
            <TabsTrigger value="activities">Activities ({project?.activities?.length || 0})</TabsTrigger>
            <TabsTrigger value="variations">Variations ({project?.variations?.length || 0})</TabsTrigger>
            <TabsTrigger value="costs">Subcontractor Costs ({project?.subcontractor_costs?.length || 0})</TabsTrigger>
            <TabsTrigger value="timesheets">Timesheets ({project?.timesheets?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Activities Tab */}
          <TabsContent value="activities">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Project Activities</CardTitle>
                {isAdmin && (
                  <Dialog open={activityFormOpen} onOpenChange={setActivityFormOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" onClick={() => openActivityForm()}>
                        <Plus className="w-4 h-4" />
                        Add Activity
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingActivity ? "Edit Activity" : "Add New Activity"}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSaveActivity} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="activity_name">Activity Name *</Label>
                          <Input
                            id="activity_name"
                            value={activityFormData.name}
                            onChange={(e) => setActivityFormData({ ...activityFormData, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="activity_type">Activity Type</Label>
                          <Input
                            id="activity_type"
                            value={activityFormData.activity_type}
                            onChange={(e) => setActivityFormData({ ...activityFormData, activity_type: e.target.value })}
                            placeholder="e.g., Design, Coordination, Review"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="billable"
                            checked={activityFormData.billable}
                            onCheckedChange={(checked) => 
                              setActivityFormData({ ...activityFormData, billable: checked as boolean })
                            }
                          />
                          <Label htmlFor="billable">Billable</Label>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="activity_status">Status</Label>
                          <Select
                            value={activityFormData.status}
                            onValueChange={(value: "not_started" | "in_progress" | "complete") =>
                              setActivityFormData({ ...activityFormData, status: value })
                            }
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

                        <div className="space-y-2">
                          <Label htmlFor="activity_notes">Notes</Label>
                          <Textarea
                            id="activity_notes"
                            value={activityFormData.notes}
                            onChange={(e) => setActivityFormData({ ...activityFormData, notes: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <div className="flex gap-3">
                          <Button type="submit">
                            {editingActivity ? "Save Changes" : "Add Activity"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setActivityFormOpen(false);
                              setEditingActivity(null);
                              resetActivityForm();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {!project?.activities || project.activities.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    No activities yet. Add your first activity to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Billable</TableHead>
                        <TableHead>Status</TableHead>
                        {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.activities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell className="font-medium">{activity.name}</TableCell>
                          <TableCell>{activity.activity_type || "—"}</TableCell>
                          <TableCell>{activity.billable ? "Yes" : "No"}</TableCell>
                          <TableCell>
                            <Badge className={getActivityStatusColor(activity.status)}>
                              {activity.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openActivityForm(activity)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteActivity(activity.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Variations Tab */}
          <TabsContent value="variations">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Variations</CardTitle>
                {isAdmin && (
                  <Dialog open={variationFormOpen} onOpenChange={setVariationFormOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" onClick={() => openVariationForm()}>
                        <Plus className="w-4 h-4" />
                        Add Variation
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingVariation ? "Edit Variation" : "Add New Variation"}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSaveVariation} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="variation_code">Variation Code *</Label>
                          <Input
                            id="variation_code"
                            value={variationFormData.code}
                            onChange={(e) => setVariationFormData({ ...variationFormData, code: e.target.value })}
                            placeholder="e.g., VAR-001"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="variation_description">Description</Label>
                          <Textarea
                            id="variation_description"
                            value={variationFormData.description}
                            onChange={(e) => setVariationFormData({ ...variationFormData, description: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="variation_value">Value (£) *</Label>
                          <Input
                            id="variation_value"
                            type="number"
                            step="0.01"
                            value={variationFormData.value}
                            onChange={(e) => setVariationFormData({ ...variationFormData, value: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="variation_status">Status</Label>
                          <Select
                            value={variationFormData.status}
                            onValueChange={(value: "proposed" | "accepted" | "rejected") =>
                              setVariationFormData({ ...variationFormData, status: value })
                            }
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
                            {editingVariation ? "Save Changes" : "Add Variation"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setVariationFormOpen(false);
                              setEditingVariation(null);
                              resetVariationForm();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {!project?.variations || project.variations.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    No variations yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.variations.map((variation) => (
                        <TableRow key={variation.id}>
                          <TableCell className="font-medium">{variation.code}</TableCell>
                          <TableCell>{variation.description || "—"}</TableCell>
                          <TableCell>{formatCurrency(variation.value)}</TableCell>
                          <TableCell>
                            <Badge className={getVariationStatusColor(variation.status)}>
                              {variation.status}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openVariationForm(variation)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteVariation(variation.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subcontractor Costs Tab */}
          <TabsContent value="costs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Subcontractor Costs</CardTitle>
                {isAdmin && (
                  <Dialog open={costFormOpen} onOpenChange={setCostFormOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" onClick={() => openCostForm()}>
                        <Plus className="w-4 h-4" />
                        Add Cost
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingCost ? "Edit Cost" : "Add New Cost"}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSaveCost} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="supplier_name">Supplier Name *</Label>
                          <Input
                            id="supplier_name"
                            value={costFormData.supplier_name}
                            onChange={(e) => setCostFormData({ ...costFormData, supplier_name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cost_description">Description</Label>
                          <Textarea
                            id="cost_description"
                            value={costFormData.description}
                            onChange={(e) => setCostFormData({ ...costFormData, description: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cost_amount">Amount (£) *</Label>
                            <Input
                              id="cost_amount"
                              type="number"
                              step="0.01"
                              value={costFormData.cost_amount}
                              onChange={(e) => setCostFormData({ ...costFormData, cost_amount: e.target.value })}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="cost_date">Date *</Label>
                            <Input
                              id="cost_date"
                              type="date"
                              value={costFormData.cost_date}
                              onChange={(e) => setCostFormData({ ...costFormData, cost_date: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cost_variation_id">Linked Variation (Optional)</Label>
                          <Select
                            value={costFormData.variation_id}
                            onValueChange={(value) => setCostFormData({ ...costFormData, variation_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {project?.variations?.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.code} - {formatCurrency(v.value)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-3">
                          <Button type="submit">
                            {editingCost ? "Save Changes" : "Add Cost"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCostFormOpen(false);
                              setEditingCost(null);
                              resetCostForm();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {!project?.subcontractor_costs || project.subcontractor_costs.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    No subcontractor costs recorded yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.subcontractor_costs.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell className="font-medium">{cost.supplier_name}</TableCell>
                          <TableCell>{cost.description || "—"}</TableCell>
                          <TableCell>{formatCurrency(cost.cost_amount)}</TableCell>
                          <TableCell>{formatDate(cost.cost_date)}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openCostForm(cost)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCost(cost.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timesheets Tab */}
          <TabsContent value="timesheets">
            <Card>
              <CardHeader>
                <CardTitle>Project Timesheets</CardTitle>
              </CardHeader>
              <CardContent>
                {!project?.timesheets || project.timesheets.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    No timesheet entries for this project yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.timesheets.map((ts) => {
                        const hourlyRate = ts.profile?.default_hourly_cost_rate || 0;
                        const cost = ts.hours * hourlyRate;
                        return (
                          <TableRow key={ts.id}>
                            <TableCell>{formatDate(ts.date)}</TableCell>
                            <TableCell>{ts.profile?.full_name || "Unknown"}</TableCell>
                            <TableCell>{ts.hours}h</TableCell>
                            <TableCell>{formatCurrency(cost)}</TableCell>
                            <TableCell>{ts.notes || "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}