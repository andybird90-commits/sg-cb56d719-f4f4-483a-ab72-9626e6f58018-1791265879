import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, ChevronRight, Building2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  status: string;
  expected_fee_value: number | null;
  companies?: {
    name: string;
  };
}

function OpportunitiesContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Everyone can create/edit, only directors/admins can delete
  const canEdit = !!profile;
  const canDelete = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("opportunities")
        .select(`
          *,
          companies (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setOpportunities(data || []);
    } catch (err) {
      console.error("Failed to load opportunities data", err);
      setError("Failed to load opportunities");
    } finally {
      setLoading(false);
    }
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

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Opportunities</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Track and manage business opportunities</p>
          </div>
          {canEdit && (
            <Link href="/opportunities/new">
              <Button className="w-full sm:w-auto gap-2">
                <Plus className="w-4 h-4" />
                <span>New Opportunity</span>
              </Button>
            </Link>
          )}
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
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-600">Loading opportunities...</div>
          </div>
        )}

        {/* Opportunities List */}
        {!loading && !error && (
          <div className="space-y-3">
            {opportunities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">No opportunities yet</p>
                </CardContent>
              </Card>
            ) : (
              opportunities.map((opp) => (
                <Card 
                  key={opp.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/opportunities/${opp.id}`)}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                            {opp.name}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={`${getStageColor(opp.stage)} w-fit text-xs`}>
                              {opp.stage.replace("_", " ")}
                            </Badge>
                            <Badge variant="outline" className="w-fit text-xs">{opp.status}</Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-2">{opp.companies?.name}</p>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">Expected Value:</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(opp.expected_fee_value)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Results count */}
        {!loading && !error && opportunities.length > 0 && (
          <div className="text-center text-sm text-slate-600">
            Showing {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function OpportunitiesPage() {
  return (
    <RequireAuth>
      <OpportunitiesContent />
    </RequireAuth>
  );
}