import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Edit, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { OpportunityCalendar } from "@/components/OpportunityCalendar";
import { OpportunityTimeline } from "@/components/OpportunityTimeline";

interface Opportunity {
  id: string;
  name: string;
  company_id: string;
  stage: string;
  status: string;
  expected_fee_value: number | null;
  tender_due_date: string | null;
  tender_received_date: string | null;
  submitted_date: string | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  probability_percent: number | null;
  project_reference: string | null;
  description: string | null;
  created_at: string;
  created_by_user_id: string;
  added_by_user_id?: string;
  linked_project_id: string | null;
  companies?: {
    id: string;
    name: string;
  };
  contacts?: {
    name: string;
  };
  added_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
  projects?: {
    id: string;
    code: string;
    name: string;
  };
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

function OpportunityDetailContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [editFormData, setEditFormData] = useState({
    name: "",
    stage: "",
    status: "",
    expected_fee_value: "",
    expected_start_date: "",
    expected_end_date: "",
    tender_due_date: "",
    tender_received_date: "",
    submitted_date: "",
    project_reference: "",
    description: "",
    probability_percent: "",
    added_by_user_id: "",
  });

  // Everyone can edit, only directors/admins can delete
  const canEdit = !!profile;
  const canDelete = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (id && typeof id === "string") {
      fetchOpportunity(id);
      fetchUsers();
    }
  }, [id]);

  const fetchUsers = async () => {
    try {
      const { data, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (usersError) throw usersError;
      setUsers(data || []);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  const fetchOpportunity = async (oppId: string) => {
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          *,
          companies(name),
          contacts(name),
          added_by_profile:profiles!opportunities_added_by_user_id_fkey(
            full_name,
            email
          ),
          projects!opportunities_linked_project_id_fkey(
            id,
            code,
            name
          )
        `)
        .eq("id", oppId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Opportunity not found");

      const opportunityData = data as any;
      setOpportunity(opportunityData);
      setEditFormData({
        name: opportunityData.name,
        stage: opportunityData.stage,
        status: opportunityData.status || "open",
        expected_fee_value: opportunityData.expected_fee_value?.toString() || "",
        expected_start_date: opportunityData.expected_start_date || "",
        expected_end_date: opportunityData.expected_end_date || "",
        tender_due_date: opportunityData.tender_due_date || "",
        tender_received_date: opportunityData.tender_received_date || "",
        submitted_date: opportunityData.submitted_date || "",
        project_reference: opportunityData.project_reference || "",
        description: opportunityData.description || "",
        probability_percent: opportunityData.probability_percent?.toString() || "",
        added_by_user_id: opportunityData.added_by_user_id || opportunityData.created_by_user_id || "",
      });
    } catch (err) {
      console.error("Error fetching opportunity:", err);
      setError("Failed to load opportunity");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id === "string") return;

    try {
      const { error: updateError } = await supabase
        .from("opportunities")
        .update({
          name: editFormData.name,
          description: editFormData.description || null,
          stage: editFormData.stage,
          status: editFormData.status,
          tender_due_date: editFormData.tender_due_date || null,
          expected_start_date: editFormData.expected_start_date || null,
          expected_end_date: editFormData.expected_end_date || null,
          expected_fee_value: editFormData.expected_fee_value ? parseFloat(editFormData.expected_fee_value) : null,
          probability_percent: editFormData.probability_percent ? parseInt(editFormData.probability_percent) : null,
          added_by_user_id: editFormData.added_by_user_id || null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      await fetchOpportunity(id);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      console.error("Failed to update opportunity", err);
      setError("Failed to update opportunity");
    }
  };

  const handleDelete = async () => {
    if (!id || typeof id === "string") return;
    if (!confirm("Are you sure you want to delete this opportunity?")) return;

    try {
      const { error } = await supabase
        .from("opportunities")
        .delete()
        .eq("id", id);

      if (error) throw error;
      router.push("/opportunities");
    } catch (err) {
      console.error("Failed to delete opportunity", err);
      alert("Failed to delete opportunity");
    }
  };

  const handleSave = async () => {
    if (!id || typeof id === "string") return;

    try {
      // Calculate probability based on stage - ALWAYS enforce the rules
      const probability = 
        editFormData.stage === 'bid' ? 25 :
        editFormData.stage === 'high_potential' ? 50 :
        editFormData.stage === 'secured' ? 100 : 50;

      // Determine if this should be archived based on STATUS field (not stage)
      const shouldArchive = editFormData.status === 'closed_lost' || editFormData.status === 'closed_won';
      
      const updates: any = {
        name: editFormData.name,
        stage: editFormData.stage,
        status: editFormData.status,
        probability_percent: probability,
        expected_fee_value: editFormData.expected_fee_value ? parseFloat(editFormData.expected_fee_value) : null,
        expected_start_date: editFormData.expected_start_date || null,
        expected_end_date: editFormData.expected_end_date || null,
        tender_due_date: editFormData.tender_due_date || null,
        tender_received_date: editFormData.tender_received_date || null,
        submitted_date: editFormData.submitted_date || null,
        project_reference: editFormData.project_reference || null,
        description: editFormData.description || null,
      };

      // Add archive fields if archiving
      if (shouldArchive) {
        updates.archived = true;
        updates.archived_at = new Date().toISOString();
        updates.archived_reason = editFormData.status; // 'closed_lost' or 'closed_won'
        updates.archived_by_user_id = profile?.id || null;
      }

      const { error } = await supabase
        .from("opportunities" as any)
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setIsEditing(false);
      
      if (shouldArchive) {
        // Redirect back to opportunities list after archiving
        router.push("/opportunities");
      } else {
        fetchOpportunity(id);
      }
    } catch (error) {
      console.error("Error saving opportunity:", error);
      setError("Failed to save opportunity");
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

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Link href="/opportunities">
            <Button variant="ghost" size="sm" className="gap-2 self-start">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-slate-600">Loading opportunity details...</div>
            </CardContent>
          </Card>
        )}

        {/* Opportunity Details */}
        {!loading && opportunity && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
                <CardTitle className="text-xl sm:text-2xl">{opportunity.name}</CardTitle>
                <Badge className={getStageColor(opportunity.stage)}>
                  {opportunity.stage.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2 w-full sm:w-auto">
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                )}
                {canDelete && !isEditing && (
                  <Button variant="outline" size="sm" onClick={handleDelete} className="gap-2 w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm sm:text-base">Opportunity Name *</Label>
                    <Input
                      id="name"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      required
                      className="h-10 sm:h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
                    <Textarea
                      id="description"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      rows={4}
                      className="text-sm sm:text-base"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-stage">Sales Stage *</Label>
                      <Select
                        value={editFormData.stage}
                        onValueChange={(value) => setEditFormData({ ...editFormData, stage: value })}
                      >
                        <SelectTrigger id="edit-stage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bid">Bid</SelectItem>
                          <SelectItem value="high_potential">High Potential</SelectItem>
                          <SelectItem value="secured">Secured</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status *</Label>
                      <Select
                        value={editFormData.status}
                        onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                      >
                        <SelectTrigger id="edit-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="closed_won">Closed - Won</SelectItem>
                          <SelectItem value="closed_lost">Closed - Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expected_fee_value" className="text-sm sm:text-base">Expected Fee Value (£)</Label>
                      <Input
                        id="expected_fee_value"
                        type="number"
                        step="0.01"
                        value={editFormData.expected_fee_value}
                        onChange={(e) => setEditFormData({ ...editFormData, expected_fee_value: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="probability_percent" className="text-sm sm:text-base">Probability (%) - Auto-calculated</Label>
                      <Input
                        id="probability_percent"
                        type="number"
                        min="0"
                        max="100"
                        value={
                          editFormData.stage === 'bid' ? '25' :
                          editFormData.stage === 'high_potential' ? '50' :
                          editFormData.stage === 'secured' ? '100' : '50'
                        }
                        className="h-10 sm:h-11"
                        readOnly
                        disabled
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tender_due_date" className="text-sm sm:text-base">Tender Due Date</Label>
                      <Input
                        id="tender_due_date"
                        type="date"
                        value={editFormData.tender_due_date}
                        onChange={(e) => setEditFormData({ ...editFormData, tender_due_date: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expected_start_date" className="text-sm sm:text-base">Expected Start Date</Label>
                      <Input
                        id="expected_start_date"
                        type="date"
                        value={editFormData.expected_start_date}
                        onChange={(e) => setEditFormData({ ...editFormData, expected_start_date: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expected_end_date" className="text-sm sm:text-base">Expected End Date</Label>
                      <Input
                        id="expected_end_date"
                        type="date"
                        value={editFormData.expected_end_date}
                        onChange={(e) => setEditFormData({ ...editFormData, expected_end_date: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="added_by_user_id" className="text-sm sm:text-base">Added by</Label>
                    <Select
                      value={editFormData.added_by_user_id}
                      onValueChange={(value) => setEditFormData({ ...editFormData, added_by_user_id: value })}
                    >
                      <SelectTrigger className="h-10 sm:h-11">
                        <SelectValue placeholder="Select user (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button type="button" onClick={handleSave} className="h-10 sm:h-11">Save Changes</Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="h-10 sm:h-11">
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-slate-500 mb-1">Company</div>
                    <div 
                      className="text-blue-600 hover:underline cursor-pointer text-sm sm:text-base"
                      onClick={() => router.push(`/companies/${opportunity.company_id}`)}
                    >
                      {opportunity.companies?.name}
                    </div>
                  </div>

                  {opportunity.contacts && (
                    <div>
                      <div className="text-sm font-medium text-slate-500 mb-1">Contact</div>
                      <div className="text-slate-900 text-sm sm:text-base">{opportunity.contacts.name}</div>
                    </div>
                  )}

                  {opportunity.description && (
                    <div>
                      <div className="text-sm font-medium text-slate-500 mb-1">Description</div>
                      <div className="text-slate-900 whitespace-pre-wrap text-sm sm:text-base">{opportunity.description}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-600">Sales Stage</div>
                      <div className="font-medium">{opportunity.stage.replace("_", " ")}</div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-600">Status</div>
                      <div className="font-medium">{opportunity.status.replace("_", " ")}</div>
                    </div>

                    {opportunity.project_reference && (
                      <div>
                        <div className="text-sm text-slate-600">Project Reference</div>
                        <div className="font-medium font-mono">{opportunity.project_reference}</div>
                      </div>
                    )}
                    
                    <div>
                      <div className="text-sm text-slate-600">Expected Value</div>
                      <div className="font-medium">
                        {opportunity.expected_fee_value ? formatCurrency(opportunity.expected_fee_value) : "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-600">Probability</div>
                      <div className="font-medium">{opportunity.probability_percent}%</div>
                    </div>

                    {opportunity.tender_received_date && (
                      <div>
                        <div className="text-sm text-slate-600">Tender Received</div>
                        <div className="font-medium">{formatDate(opportunity.tender_received_date)}</div>
                      </div>
                    )}

                    {opportunity.tender_due_date && (
                      <div>
                        <div className="text-sm text-slate-600">Tender Due Date</div>
                        <div className="font-medium">{formatDate(opportunity.tender_due_date)}</div>
                      </div>
                    )}

                    {opportunity.submitted_date && (
                      <div>
                        <div className="text-sm text-slate-600">Submitted Date</div>
                        <div className="font-medium text-green-700 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          {formatDate(opportunity.submitted_date)}
                        </div>
                      </div>
                    )}
                  </div>

                  {(opportunity.expected_start_date || opportunity.expected_end_date) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {opportunity.expected_start_date && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">Expected Start</div>
                          <div className="text-slate-900 text-sm sm:text-base">{formatDate(opportunity.expected_start_date)}</div>
                        </div>
                      )}

                      {opportunity.expected_end_date && (
                        <div>
                          <div className="text-sm font-medium text-slate-500">Expected End</div>
                          <div className="text-slate-900 text-sm sm:text-base">{formatDate(opportunity.expected_end_date)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            {opportunity.added_by_user_id && !isEditing && (
              <div className="pt-4 border-t mt-4">
                <div className="text-xs text-slate-500">
                  Added by {opportunity.added_by_profile?.full_name || opportunity.added_by_profile?.email || "Unknown"}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Calendar and Timeline Section */}
        {!loading && opportunity && (
          <div className="space-y-6">
            <OpportunityCalendar 
              opportunityId={opportunity.id} 
              opportunityName={opportunity.name} 
              isDetailView={true} 
            />
            
            <OpportunityTimeline 
              opportunityId={opportunity.id}
              opportunityName={opportunity.name}
            />
          </div>
        )}

        {/* Linked Project Section */}
        {!loading && opportunity && opportunity.projects && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Linked Project</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-slate-500 mb-1">
                    {opportunity.projects.code}
                  </div>
                  <div className="font-medium text-slate-900">
                    {opportunity.projects.name}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/projects/${opportunity.projects?.id}`)}
                >
                  View Project
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Convert to Project Button */}
        {!loading && opportunity && !opportunity.projects && canEdit && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900 mb-1">Convert to Project</h3>
                  <p className="text-sm text-slate-600">
                    Create a new project from this opportunity
                  </p>
                </div>
                <Link href={`/projects/new?opportunity_id=${opportunity.id}`}>
                  <Button>
                    Create Project
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not Found State */}
        {!loading && !opportunity && !error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Opportunity not found</AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  );
}

export default function OpportunityDetailPage() {
  return (
    <RequireAuth>
      <OpportunityDetailContent />
    </RequireAuth>
  );
}