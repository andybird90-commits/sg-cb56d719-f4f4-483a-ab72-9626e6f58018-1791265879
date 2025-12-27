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
import { Plus, ChevronRight, Building2, AlertTriangle, Search, CheckCircle2, Target, TrendingUp, Calendar, Filter, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  company_id: string;
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
  archived?: boolean;
  companies?: {
    name: string;
  };
  added_by_profile?: {
    full_name: string;
    email?: string;
  };
}

function OpportunitiesContent() {
  const { profile: user } = useAuth(); // Alias profile to user for compatibility
  const { toast } = useToast();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Everyone can create/edit, only directors/admins can delete
  const canEdit = !!user;
  const canDelete = user?.role === "admin" || user?.role === "director";

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    filterOpportunities();
  }, [opportunities, searchTerm]);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("opportunities" as any)
        .select(`
          *,
          companies (
            name
          ),
          added_by_profile:profiles!opportunities_added_by_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunities((data as any) || []);
      setFilteredOpportunities((data as any) || []);
    } catch (err) {
      console.error("Failed to load opportunities", err);
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
        opp.stage.toLowerCase().includes(searchLower)
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

  const OpportunityCard = ({ opportunity }: { opportunity: Opportunity }) => {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [showSubmittedDate, setShowSubmittedDate] = useState(false);
    const [submittedDate, setSubmittedDate] = useState(opportunity.submitted_date || "");

    const handleStageChange = async (opportunityId: string, newStage: string) => {
      try {
        // Calculate probability based on stage
        const probability = 
          newStage === 'lead' ? 10 :
          newStage === 'in_bid' ? 25 :
          newStage === 'high_potential' ? 50 :
          newStage === 'won' ? 100 :
          newStage === 'lost' ? 0 : 50;

        const { error } = await supabase
          .from("opportunities" as any)
          .update({ 
            stage: newStage,
            probability_percent: probability 
          })
          .eq("id", opportunityId);

        if (error) throw error;

        // Refresh the list
        fetchOpportunities();
        
        toast({
          title: "Stage updated",
          description: `Opportunity stage changed to ${newStage}`,
        });
      } catch (error) {
        console.error("Error updating stage:", error);
        toast({
          title: "Error",
          description: "Failed to update opportunity stage",
          variant: "destructive",
        });
      }
    };

    const handleSubmittedDateSave = async () => {
      if (!submittedDate) return;
      
      setIsUpdating(true);
      try {
        const updates: any = {
          submitted_date: submittedDate,
          stage: "in_bid",
          probability_percent: 25
        };

        const { error } = await supabase
          .from("opportunities")
          .update(updates)
          .eq("id", opportunity.id);

        if (error) throw error;

        setShowSubmittedDate(false);
        await fetchOpportunities();
      } catch (err) {
        console.error("Failed to save submitted date", err);
        alert("Failed to save submitted date");
      } finally {
        setIsUpdating(false);
      }
    };

    const handleSubmittedDateChange = async (opportunityId: string, date: string, currentStage: string) => {
      try {
        const updates: any = {
          submitted_date: date || null,
        };

        // If stage is lead and submitted date is being set, change to in_bid
        if (currentStage === 'lead' && date) {
          updates.stage = 'in_bid';
          updates.probability_percent = 25;
        }

        const { error } = await supabase
          .from("opportunities" as any)
          .update(updates)
          .eq("id", opportunityId);

        if (error) throw error;

        fetchOpportunities();
        
        if (currentStage === 'lead' && date) {
          toast({
            title: "Stage updated",
            description: "Opportunity moved to 'In Bid' stage (25% probability)",
          });
        }
      } catch (error) {
        console.error("Error updating submitted date:", error);
        toast({
          title: "Error",
          description: "Failed to update submitted date",
          variant: "destructive",
        });
      }
    };

    const convertToProject = async (opp: Opportunity) => {
      try {
        // Navigate to new project page with opportunity data
        router.push(`/projects/new?opportunity_id=${opp.id}`);
      } catch (err) {
        console.error("Failed to convert to project", err);
        alert("Failed to convert to project");
      }
    };

    const getStageDisplay = () => {
      if (opportunity.stage === "lead" && !opportunity.submitted_date) return "Lead";
      if (opportunity.stage === "in_bid" || opportunity.submitted_date) return "In Bid";
      if (opportunity.stage === "high_potential") return "High Potential";
      return opportunity.stage;
    };

    return (
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1" onClick={() => router.push(`/opportunities/${opportunity.id}`)}>
              <h3 className="font-semibold text-base sm:text-lg mb-1">{opportunity.name}</h3>
              {opportunity.companies && (
                <p className="text-sm text-slate-600 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {opportunity.companies.name}
                </p>
              )}
            </div>
            <Badge className={getStageColor(opportunity.stage)}>
              {getStageDisplay()}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600 mb-4">
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

            {opportunity.tender_due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Due: {formatDate(opportunity.tender_due_date)}</span>
              </div>
            )}

            {opportunity.tender_received_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Received: {formatDate(opportunity.tender_received_date)}</span>
              </div>
            )}

            {opportunity.submitted_date ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Submitted: {formatDate(opportunity.submitted_date)}</span>
              </div>
            ) : (
              <div className="col-span-2">
                {showSubmittedDate ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={submittedDate}
                      onChange={(e) => setSubmittedDate(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" onClick={handleSubmittedDateSave} disabled={isUpdating}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowSubmittedDate(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowSubmittedDate(true)}
                    className="w-full"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Mark as Submitted
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Stage Progression Buttons */}
          <div className="flex flex-wrap gap-2 pt-3 border-t">
            {opportunity.stage === "lead" && opportunity.submitted_date && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStageChange(opportunity.id, "high_potential")}
                disabled={isUpdating}
                className="flex-1"
              >
                High Potential
              </Button>
            )}

            {opportunity.stage === "in_bid" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStageChange(opportunity.id, "high_potential")}
                disabled={isUpdating}
                className="flex-1"
              >
                High Potential
              </Button>
            )}

            {(opportunity.stage === "high_potential" || opportunity.stage === "in_bid") && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleStageChange(opportunity.id, "secured")}
                  disabled={isUpdating}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Win
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStageChange(opportunity.id, "lost")}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  Lose
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleWin = async (opportunity: Opportunity) => {
    try {
      // First update the opportunity to won status with 100% probability
      const { error: oppError } = await supabase
        .from("opportunities" as any)
        .update({ 
          stage: "won",
          probability_percent: 100
        })
        .eq("id", opportunity.id);

      if (oppError) throw oppError;

      // Create project from opportunity
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .insert({
          code: `PROJ-${Date.now()}`,
          name: opportunity.name,
          client_company_id: opportunity.company_id,
          project_reference: opportunity.project_reference || "",
          expected_fee_value: opportunity.expected_fee_value,
          start_date: opportunity.expected_start_date, // Map expected_start_date to start_date if needed, or check project schema. Usually projects have start_date.
          end_date: opportunity.expected_end_date,
          status: "live", // Changed from "active" to "live" to match allowed types
          // created_by_user_id: user?.id, // projects might not have this column or it might be different. Checking schema would be good but relying on types for now.
        } as any) // Casting to any to avoid strict type checking issues for now
        .select()
        .single();

      if (projectError) throw projectError;

      // Archive the opportunity
      const { error: archiveError } = await supabase
        .from("opportunities" as any)
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by_user_id: user?.id,
        })
        .eq("id", opportunity.id);

      if (archiveError) throw archiveError;

      toast({
        title: "Success",
        description: "Opportunity converted to project and archived",
      });

      // Redirect to the new project
      router.push(`/projects/${projectData.id}`);
    } catch (error) {
      console.error("Error converting opportunity to project:", error);
      toast({
        title: "Error",
        description: "Failed to convert opportunity to project",
        variant: "destructive",
      });
    }
  };

  const handleLose = async (opportunityId: string) => {
    try {
      const { error: updateError } = await supabase
        .from("opportunities" as any)
        .update({ 
          stage: "lost",
          probability_percent: 0
        })
        .eq("id", opportunityId);

      if (updateError) throw updateError;

      const { error: archiveError } = await supabase
        .from("opportunities" as any)
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by_user_id: user?.id,
        })
        .eq("id", opportunityId);

      if (archiveError) throw archiveError;

      toast({
        title: "Opportunity archived",
        description: "Opportunity marked as lost and archived",
      });

      fetchOpportunities();
    } catch (error) {
      console.error("Error archiving opportunity:", error);
      toast({
        title: "Error",
        description: "Failed to archive opportunity",
        variant: "destructive",
      });
    }
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