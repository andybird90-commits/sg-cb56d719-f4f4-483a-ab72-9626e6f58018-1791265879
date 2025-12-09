import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface Absence {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  approved_by: string | null;
  profiles?: {
    full_name: string;
  };
  approver?: {
    full_name: string;
  };
}

function TeamAbsencesContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  const canView = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    if (profile && !canView) {
      router.push("/absences/my");
    } else if (canView) {
      fetchAbsences();
    }
  }, [profile, canView, router]);

  const fetchAbsences = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("absences")
        .select(`
          *,
          profiles!absences_user_id_fkey (
            full_name
          ),
          approver:profiles!absences_approved_by_fkey (
            full_name
          )
        `)
        .order("start_date", { ascending: false });

      if (fetchError) throw fetchError;

      setAbsences(data || []);
    } catch (err) {
      console.error("Failed to load team absences data", err);
      setError("Failed to load team absences");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (absenceId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("absences")
      .update({ approved_by: user.id })
      .eq("id", absenceId);

    if (error) {
      alert("Error approving absence");
      return;
    }

    await fetchAbsences();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  const pendingAbsences = absences.filter((a) => !a.approved_by);
  const approvedAbsences = absences.filter((a) => a.approved_by);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile optimized */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Team Absences</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">Review and approve absence requests</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="pending" className="text-sm sm:text-base">
              Pending {pendingAbsences.length > 0 && `(${pendingAbsences.length})`}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-sm sm:text-base">All Absences</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Pending Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingAbsences.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-sm">
                    No pending approvals. All absence requests have been reviewed.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingAbsences.map((absence) => (
                      <div key={absence.id} className="p-4 border rounded-lg bg-orange-50 border-orange-200">
                        <div className="flex flex-col gap-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <div className="font-medium text-sm sm:text-base text-slate-900">
                                {absence.profiles?.full_name}
                              </div>
                              <Badge className={getTypeColor(absence.type)}>
                                {absence.type}
                              </Badge>
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                Pending approval
                              </Badge>
                            </div>
                            <div className="text-sm text-slate-700 mb-1">
                              {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                            </div>
                            {absence.notes && (
                              <div className="text-sm text-slate-600 whitespace-pre-wrap">
                                {absence.notes}
                              </div>
                            )}
                          </div>
                          <Button size="sm" onClick={() => handleApprove(absence.id)} className="w-full sm:w-auto gap-2">
                            <Check className="w-4 h-4" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">All Absences</CardTitle>
              </CardHeader>
              <CardContent>
                {absences.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-sm">
                    No absence requests yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {absences.map((absence) => (
                      <div key={absence.id} className="p-4 border rounded-lg">
                        <div className="flex flex-col gap-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <div className="font-medium text-sm sm:text-base text-slate-900">
                                {absence.profiles?.full_name}
                              </div>
                              <Badge className={getTypeColor(absence.type)}>
                                {absence.type}
                              </Badge>
                              {absence.approved_by ? (
                                <Badge className="bg-green-100 text-green-800">
                                  Approved
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-300">
                                  Pending approval
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-slate-700 mb-1">
                              {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                            </div>
                            {absence.notes && (
                              <div className="text-sm text-slate-600 whitespace-pre-wrap">
                                {absence.notes}
                              </div>
                            )}
                            {absence.approved_by && absence.approver && (
                              <div className="text-xs text-slate-500 mt-2">
                                Approved by {absence.approver.full_name}
                              </div>
                            )}
                          </div>
                          {!absence.approved_by && (
                            <Button size="sm" onClick={() => handleApprove(absence.id)} className="w-full sm:w-auto gap-2">
                              <Check className="w-4 h-4" />
                              Approve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

export default function TeamAbsencesPage() {
  return (
    <RequireAuth>
      <TeamAbsencesContent />
    </RequireAuth>
  );
}