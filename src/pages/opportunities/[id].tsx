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
import { ArrowLeft, Edit, AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";

interface Opportunity {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  status: string;
  company_id: string;
  contact_id: string | null;
  tender_due_date: string | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  expected_fee_value: number | null;
  probability_percent: number | null;
  added_by_user_id: string | null;
  companies?: {
    name: string;
  };
  contacts?: {
    name: string;
  };
  added_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
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
  const [editData, setEditData] = useState({
    name: "",
    description: "",
    stage: "",
    status: "",
    tender_due_date: "",
    expected_start_date: "",
    expected_end_date: "",
    expected_fee_value: "",
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
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("opportunities")
        .select(`
          *,
          companies (
            name
          ),
          contacts (
            name
          ),
          added_by_profile:profiles (
            full_name,
            email
          )
        `)
        .eq("id", oppId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Opportunity not found");

      setOpportunity(data);
      setEditData({
        name: data.name,
        description: data.description || "",
        stage: data.stage,
        status: data.status,
        tender_due_date: data.tender_due_date || "",
        expected_start_date: data.expected_start_date || "",
        expected_end_date: data.expected_end_date || "",
        expected_fee_value: data.expected_fee_value?.toString() || "",
        probability_percent: data.probability_percent?.toString() || "",
        added_by_user_id: data.added_by_user_id || "",
      });
    } catch (err) {
      console.error("Failed to load opportunity data", err);
      setError("Failed to load opportunity details");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== "string") return;

    try {
      const { error: updateError } = await supabase
        .from("opportunities")
        .update({
          name: editData.name,
          description: editData.description || null,
          stage: editData.stage as "secured" | "high_potential" | "bid",
          status: editData.status as "open" | "closed_won" | "closed_lost",
          tender_due_date: editData.tender_due_date || null,
          expected_start_date: editData.expected_start_date || null,
          expected_end_date: editData.expected_end_date || null,
          expected_fee_value: editData.expected_fee_value ? parseFloat(editData.expected_fee_value) : null,
          probability_percent: editData.probability_percent ? parseInt(editData.probability_percent) : null,
          added_by_user_id: editData.added_by_user_id || null,
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
    if (!id || typeof id !== "string") return;
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
                <Badge variant="outline">{opportunity.status}</Badge>
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
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      required
                      className="h-10 sm:h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
                    <Textarea
                      id="description"
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={4}
                      className="text-sm sm:text-base"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stage" className="text-sm sm:text-base">Stage</Label>
                      <Select
                        value={editData.stage}
                        onValueChange={(value) => setEditData({ ...editData, stage: value })}
                      >
                        <SelectTrigger className="h-10 sm:h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="secured">Secured</SelectItem>
                          <SelectItem value="high_potential">High Potential</SelectItem>
                          <SelectItem value="bid">Bid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-sm sm:text-base">Status</Label>
                      <Select
                        value={editData.status}
                        onValueChange={(value) => setEditData({ ...editData, status: value })}
                      >
                        <SelectTrigger className="h-10 sm:h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="closed_won">Closed Won</SelectItem>
                          <SelectItem value="closed_lost">Closed Lost</SelectItem>
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
                        value={editData.expected_fee_value}
                        onChange={(e) => setEditData({ ...editData, expected_fee_value: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="probability_percent" className="text-sm sm:text-base">Probability (%)</Label>
                      <Input
                        id="probability_percent"
                        type="number"
                        min="0"
                        max="100"
                        value={editData.probability_percent}
                        onChange={(e) => setEditData({ ...editData, probability_percent: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tender_due_date" className="text-sm sm:text-base">Tender Due Date</Label>
                      <Input
                        id="tender_due_date"
                        type="date"
                        value={editData.tender_due_date}
                        onChange={(e) => setEditData({ ...editData, tender_due_date: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expected_start_date" className="text-sm sm:text-base">Expected Start Date</Label>
                      <Input
                        id="expected_start_date"
                        type="date"
                        value={editData.expected_start_date}
                        onChange={(e) => setEditData({ ...editData, expected_start_date: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expected_end_date" className="text-sm sm:text-base">Expected End Date</Label>
                      <Input
                        id="expected_end_date"
                        type="date"
                        value={editData.expected_end_date}
                        onChange={(e) => setEditData({ ...editData, expected_end_date: e.target.value })}
                        className="h-10 sm:h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="added_by_user_id" className="text-sm sm:text-base">Added by</Label>
                    <Select
                      value={editData.added_by_user_id}
                      onValueChange={(value) => setEditData({ ...editData, added_by_user_id: value })}
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
                    <Button type="submit" className="h-10 sm:h-11">Save Changes</Button>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-500">Expected Value</div>
                      <div className="text-slate-900 font-semibold text-sm sm:text-base">{formatCurrency(opportunity.expected_fee_value)}</div>
                    </div>
                    
                    {opportunity.probability_percent !== null && (
                      <div>
                        <div className="text-sm font-medium text-slate-500">Probability</div>
                        <div className="text-slate-900 text-sm sm:text-base">{opportunity.probability_percent}%</div>
                      </div>
                    )}

                    {opportunity.tender_due_date && (
                      <div>
                        <div className="text-sm font-medium text-slate-500">Tender Due</div>
                        <div className="text-slate-900 text-sm sm:text-base">{formatDate(opportunity.tender_due_date)}</div>
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

              {opportunity.added_by_user_id && !isEditing && (
                <div className="pt-4 border-t mt-4">
                  <div className="text-xs text-slate-500">
                    Added by {opportunity.added_by_profile?.full_name || opportunity.added_by_profile?.email || "Unknown"}
                  </div>
                </div>
              )}
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