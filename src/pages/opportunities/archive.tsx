import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Archive as ArchiveIcon, ChevronRight, Building2, AlertTriangle, Search, RefreshCw, Eye } from "lucide-react";

interface ArchivedOpportunity {
  id: string;
  name: string;
  stage: string;
  company_id: string;
  expected_fee_value: number | null;
  archived_at: string | null;
  archived_reason: string | null;
  created_at: string;
  companies?: {
    name: string;
  };
  archived_by_profile?: {
    full_name: string | null;
    email: string;
  };
}

function ArchivedOpportunitiesContent() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<ArchivedOpportunity[]>([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<ArchivedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Everyone can restore
  const canRestore = !!profile;

  useEffect(() => {
    fetchArchivedOpportunities();
  }, []);

  useEffect(() => {
    filterOpportunities();
  }, [opportunities, searchTerm]);

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
      setFilteredOpportunities((data as any) || []);
    } catch (err) {
      console.error("Failed to load archived opportunities", err);
      setError("Failed to load archived opportunities");
    } finally {
      setLoading(false);
    }
  };

  const filterOpportunities = () => {
    if (!searchTerm) {
      setFilteredOpportunities(opportunities);
      return;
    }

    const filtered = opportunities.filter((opp) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        opp.name.toLowerCase().includes(searchLower) ||
        opp.companies?.name.toLowerCase().includes(searchLower) ||
        opp.stage.toLowerCase().includes(searchLower)
      );
    });

    setFilteredOpportunities(filtered);
  };

  const handleRestore = async (opportunityId: string) => {
    if (!confirm("Are you sure you want to restore this opportunity? It will be moved back to the active opportunities list.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("opportunities" as any)
        .update({
          archived: false,
          archived_at: null,
          archived_reason: null,
          archived_by_user_id: null,
        })
        .eq("id", opportunityId);

      if (error) throw error;

      toast({
        title: "Opportunity restored",
        description: "The opportunity has been restored to the active list.",
      });

      // Refresh the list
      fetchArchivedOpportunities();
    } catch (err) {
      console.error("Failed to restore opportunity", err);
      toast({
        title: "Error",
        description: "Failed to restore opportunity. Please try again.",
        variant: "destructive",
      });
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
      case "high_potential":
        return "bg-blue-100 text-blue-800";
      case "bid":
        return "bg-yellow-100 text-yellow-800";
      case "lost":
        return "bg-red-100 text-red-800";
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

  const getReasonBadge = (reason: string | null) => {
    if (!reason) return null;
    
    const colors = {
      lost: "bg-red-100 text-red-800",
      won: "bg-green-100 text-green-800",
      secured: "bg-green-100 text-green-800",
    };

    return (
      <Badge className={colors[reason as keyof typeof colors] || "bg-slate-100 text-slate-800"}>
        {reason}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArchiveIcon className="w-6 h-6 text-slate-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Archived Opportunities</h1>
            </div>
            <p className="text-sm sm:text-base text-slate-600">View and restore archived opportunities</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search archived opportunities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
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
            <div className="text-slate-600">Loading archived opportunities...</div>
          </div>
        )}

        {/* Opportunities List */}
        {!loading && !error && (
          <div className="space-y-3">
            {filteredOpportunities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ArchiveIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">
                    {searchTerm ? "No archived opportunities found" : "No archived opportunities"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredOpportunities.map((opp) => (
                <Card 
                  key={opp.id} 
                  className="hover:shadow-md transition-shadow"
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
                            {getReasonBadge(opp.archived_reason)}
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-2">{opp.companies?.name}</p>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                          <span className="text-slate-500">Expected Value:</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(opp.expected_fee_value)}
                          </span>
                          {opp.archived_at && (
                            <>
                              <span className="hidden sm:inline text-slate-300">•</span>
                              <span className="text-slate-500">
                                Archived: {formatDate(opp.archived_at)}
                              </span>
                            </>
                          )}
                        </div>

                        {opp.archived_by_profile && (
                          <div className="text-xs text-slate-500 mt-1">
                            Archived by {opp.archived_by_profile.full_name || opp.archived_by_profile.email}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/opportunities/${opp.id}`)}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                        {canRestore && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleRestore(opp.id)}
                            className="gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Results count */}
        {!loading && !error && filteredOpportunities.length > 0 && (
          <div className="text-center text-sm text-slate-600">
            Showing {filteredOpportunities.length} archived {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function ArchivedOpportunitiesPage() {
  return (
    <RequireAuth>
      <ArchivedOpportunitiesContent />
    </RequireAuth>
  );
}