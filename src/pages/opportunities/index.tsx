import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, ChevronRight, Building2, AlertTriangle, Search, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Opportunity {
  id: string;
  name: string;
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
  created_at: string;
  added_by_user_id?: string;
  companies?: {
    name: string;
  };
  added_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

function OpportunitiesContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Everyone can create/edit, only directors/admins can delete
  const canEdit = !!profile;
  const canDelete = profile?.role === "admin" || profile?.role === "director";

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    filterOpportunities();
  }, [opportunities, searchTerm]);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          *,
          companies (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunities((data as unknown as Opportunity[]) || []);
      setFilteredOpportunities((data as unknown as Opportunity[]) || []);
    } catch (err) {
      console.error("Failed to load opportunities data", err);
      setError("Failed to load opportunities");
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
        opp.stage.toLowerCase().includes(searchLower) ||
        opp.status.toLowerCase().includes(searchLower)
      );
    });

    setFilteredOpportunities(filtered);
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

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const OpportunityCard = ({ opportunity }: { opportunity: Opportunity }) => (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/opportunities/${opportunity.id}`)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-1 truncate">{opportunity.name}</CardTitle>
            {opportunity.project_reference && (
              <div className="text-sm text-slate-600 font-mono mb-2">
                Ref: {opportunity.project_reference}
              </div>
            )}
            <p className="text-sm text-slate-600">{opportunity.companies?.name}</p>
          </div>
          <Badge className={getStageColor(opportunity.stage)}>
            {opportunity.stage === "high_potential" ? "High Potential" : opportunity.stage}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Value:</span>
          <span className="font-semibold">
            {opportunity.expected_fee_value ? formatCurrency(opportunity.expected_fee_value) : "—"}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Probability:</span>
          <span className="font-semibold">{opportunity.probability_percent || 0}%</span>
        </div>

        {opportunity.submitted_date && (
          <div className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 rounded px-2 py-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-green-700 font-medium">
              Submitted: {formatDate(opportunity.submitted_date)}
            </span>
          </div>
        )}

        {opportunity.tender_due_date && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Due:</span>
            <span>{formatDate(opportunity.tender_due_date)}</span>
          </div>
        )}

        {opportunity.tender_received_date && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Received:</span>
            <span>{formatDate(opportunity.tender_received_date)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search by name, company, stage, or status..."
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
            <div className="text-slate-600">Loading opportunities...</div>
          </div>
        )}

        {/* Opportunities List */}
        {!loading && !error && (
          <div className="space-y-3">
            {filteredOpportunities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">
                    {searchTerm ? "No opportunities found" : "No opportunities yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredOpportunities.map((opp) => (
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

                        {opp.added_by_user_id && (
                          <div className="text-xs text-slate-500 mt-1">
                            Added by {opp.added_by_profile?.full_name || opp.added_by_profile?.email || "Unknown"}
                          </div>
                        )}
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
        {!loading && !error && filteredOpportunities.length > 0 && (
          <div className="text-center text-sm text-slate-600">
            Showing {filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'}
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