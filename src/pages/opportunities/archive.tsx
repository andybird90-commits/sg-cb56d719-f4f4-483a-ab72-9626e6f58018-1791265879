import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Archive, 
  RotateCcw, 
  Trash2, 
  Building2, 
  Calendar,
  TrendingUp,
  Target,
  AlertCircle
} from "lucide-react";

interface ArchivedOpportunity {
  id: string;
  name: string;
  stage: string;
  expected_fee_value: number | null;
  tender_due_date: string | null;
  submitted_date: string | null;
  project_reference: string | null;
  archived_at: string | null;
  archived: boolean;
  companies?: {
    name: string;
  };
  archived_by_profile?: {
    full_name: string;
    email?: string;
  };
}

export default function OpportunitiesArchive() {
  const router = useRouter();
  const { profile } = useAuth();
  const [opportunities, setOpportunities] = useState<ArchivedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) {
      fetchArchivedOpportunities();
    }
  }, [profile]);

  const fetchArchivedOpportunities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opportunities" as any)
        .select(`
          *,
          companies (
            name
          ),
          archived_by_profile:profiles!opportunities_archived_by_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("archived", true)
        .order("archived_at", { ascending: false });

      if (error) throw error;
      setOpportunities((data as any) || []);
    } catch (err) {
      console.error("Failed to load archived opportunities", err);
      setError("Failed to load archived opportunities");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (opportunityId: string) => {
    if (!profile) return;
    if (profile.role !== "director" && profile.role !== "admin") {
      alert("Only Directors and Admins can restore archived opportunities");
      return;
    }

    try {
      const { error } = await supabase
        .from("opportunities" as any)
        .update({
          archived: false,
          archived_at: null,
          archived_by_user_id: null,
        })
        .eq("id", opportunityId);

      if (error) throw error;
      
      await fetchArchivedOpportunities();
    } catch (err) {
      console.error("Failed to restore opportunity", err);
      alert("Failed to restore opportunity");
    }
  };

  const handleDelete = async (opportunityId: string) => {
    if (!profile) return;
    if (profile.role !== "admin") {
      alert("Only Admins can permanently delete archived opportunities");
      return;
    }

    if (!confirm("Are you sure you want to permanently delete this opportunity? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("opportunities" as any)
        .delete()
        .eq("id", opportunityId);

      if (error) throw error;
      
      await fetchArchivedOpportunities();
    } catch (err) {
      console.error("Failed to delete opportunity", err);
      alert("Failed to delete opportunity");
    }
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
      case "lost":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const canRestore = profile?.role === "director" || profile?.role === "admin";
  const canDelete = profile?.role === "admin";

  return (
    <RequireAuth>
      <Layout>
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Archive className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Archived Opportunities</h1>
                <p className="text-sm text-slate-600">
                  {opportunities.length} archived {opportunities.length === 1 ? "opportunity" : "opportunities"}
                </p>
              </div>
            </div>
            <Button onClick={() => router.push("/opportunities")}>
              Back to Opportunities
            </Button>
          </div>

          {/* Permission Notice */}
          {!canRestore && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800">
                    <strong>View Only:</strong> Only Directors and Admins can restore archived opportunities.
                    {!canDelete && " Only Admins can permanently delete them."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading archived opportunities...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-800">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !error && opportunities.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Archive className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No archived opportunities</h3>
                <p className="text-slate-600">
                  Opportunities that are won or lost will appear here.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Archived Opportunities Grid */}
          {!loading && !error && opportunities.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {opportunities.map((opportunity) => (
                <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base sm:text-lg mb-1">
                          {opportunity.name}
                        </h3>
                        {opportunity.companies && (
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {opportunity.companies.name}
                          </p>
                        )}
                      </div>
                      <Badge className={getStageColor(opportunity.stage)}>
                        {opportunity.stage === "secured" ? "Won" : "Lost"}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      {opportunity.project_reference && (
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          <span className="font-medium">{opportunity.project_reference}</span>
                        </div>
                      )}
                      
                      {opportunity.expected_fee_value && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>£{opportunity.expected_fee_value.toLocaleString()}</span>
                        </div>
                      )}

                      {opportunity.archived_at && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Archived: {formatDate(opportunity.archived_at)}</span>
                        </div>
                      )}

                      {opportunity.archived_by_profile && (
                        <div className="text-xs text-slate-500">
                          By: {opportunity.archived_by_profile.full_name || opportunity.archived_by_profile.email || "Unknown"}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-3 border-t">
                      {canRestore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(opportunity.id)}
                          className="flex-1"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Restore
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(opportunity.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </RequireAuth>
  );
}