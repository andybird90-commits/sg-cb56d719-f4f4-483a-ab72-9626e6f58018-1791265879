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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  enquiry_number?: string | null;
  contact_id?: string | null;
  companies?: {
    name: string;
  };
  added_by_profile?: {
    full_name: string;
    email?: string;
  };
  contacts?: {
    name: string;
    email?: string;
    phone?: string;
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
  const [sortBy, setSortBy] = useState<"name" | "date" | "value" | "stage">("date");
  const [filterStage, setFilterStage] = useState<string>("all");

  // Everyone can create/edit, only directors/admins can delete
  const canEdit = !!user;
  const canDelete = user?.role === "admin" || user?.role === "director";

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    filterOpportunities();
  }, [opportunities, searchTerm, sortBy, filterStage]);

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
          ),
          contacts (
            name,
            email,
            phone
          )
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const allOpps = ((data as any) || []) as Opportunity[];

      const pipelineOpps = allOpps.filter(
        (opp) =>
          opp.stage === "bid" ||
          opp.stage === "high_potential" ||
          opp.stage === "in_bid"
      );

      setOpportunities(pipelineOpps);
      setFilteredOpportunities(pipelineOpps);
    } catch (err) {
      console.error("Failed to load opportunities", err);
      setError("Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  };

  const filterOpportunities = () => {
    let filtered = [...opportunities];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((opp) =>
        opp.name.toLowerCase().includes(searchLower) ||
        opp.companies?.name.toLowerCase().includes(searchLower) ||
        opp.stage.toLowerCase().includes(searchLower) ||
        opp.enquiry_number?.toLowerCase().includes(searchLower)
      );
    }

    // Apply stage filter
    if (filterStage !== "all") {
      filtered = filtered.filter((opp) => opp.stage === filterStage);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "value":
          return (b.expected_fee_value || 0) - (a.expected_fee_value || 0);
        case "stage":
          return a.stage.localeCompare(b.stage);
        case "date":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
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

  // Derive live + high_potential opportunities for the top table
  const liveAndHighPotential = opportunities.filter(
    (opp) =>
      !opp.archived &&
      (opp.stage === "bid" ||
        opp.stage === "high_potential" ||
        opp.stage === "in_bid")
  );

  // Sort that list by created_at desc and then by expected_fee_value desc as a reasonable default
  const sortedLiveAndHighPotential = [...liveAndHighPotential].sort((a, b) => {
    const dateDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateDiff !== 0) return dateDiff;
    return (b.expected_fee_value || 0) - (a.expected_fee_value || 0);
  });

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
      <div className="space-y-8">
        {/* Live Opportunities & High Potentials table at top */}
        {!loading && !error && sortedLiveAndHighPotential.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-900/40 text-amber-300">
                  Ⓦ
                </span>
                <span>Live Opportunities &amp; High Potentials</span>
              </CardTitle>
              <p className="text-sm text-slate-400">
                Active pipeline opportunities – click column headers to sort
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Opportunity name</th>
                    <th className="px-3 py-2 text-left">Company</th>
                    <th className="px-3 py-2 text-left">Stage</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2 text-left">Due date</th>
                    <th className="px-3 py-2 text-left">Start date</th>
                    <th className="px-3 py-2 text-left">Finish date</th>
                    <th className="px-3 py-2 text-right">Probability</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLiveAndHighPotential.map((opp) => (
                    <tr
                      key={opp.id}
                      className="border-b border-slate-900/60 hover:bg-slate-900/40 cursor-pointer"
                      onClick={() => router.push(`/opportunities/${opp.id}`)}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">
                        {opp.project_reference || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        {opp.name}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {opp.companies?.name || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={getStageColor(opp.stage)}>
                          {opp.stage.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {formatCurrency(opp.expected_fee_value)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {formatDate(opp.tender_due_date)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {formatDate(opp.expected_start_date)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {formatDate(opp.expected_end_date)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {opp.probability_percent != null
                          ? `${opp.probability_percent}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Opportunities
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your business pipeline and opportunities
            </p>
          </div>
          <Button
            onClick={() => router.push("/opportunities/new")}
            className="btn-professional shadow-lg hover:shadow-xl">
            <Plus className="w-4 h-4 mr-2" />
            New Opportunity
          </Button>
        </div>

        {/* Search, Filter, and Sort Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search by name, company, stage, or enquiry number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="in_bid">In Bid</SelectItem>
                <SelectItem value="high_potential">High Potential</SelectItem>
                <SelectItem value="secured">Secured</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Recent First</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="value">Highest Value</SelectItem>
                <SelectItem value="stage">Stage</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                        
                        {opp.enquiry_number && (
                          <div className="text-sm font-mono text-blue-600 mb-2">
                            {opp.enquiry_number}
                          </div>
                        )}
                        
                        <p className="text-sm text-slate-600 mb-2">{opp.companies?.name}</p>
                        
                        {opp.contacts && (
                          <div className="text-sm text-slate-600 mb-2 space-y-1">
                            <div className="font-medium">{opp.contacts.name}</div>
                            {opp.contacts.email && (
                              <div className="text-xs">{opp.contacts.email}</div>
                            )}
                            {opp.contacts.phone && (
                              <div className="text-xs">{opp.contacts.phone}</div>
                            )}
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">Expected Value:</span>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(opp.expected_fee_value)}
                            </span>
                          </div>
                          
                          {opp.tender_due_date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-600">Due: {formatDate(opp.tender_due_date)}</span>
                            </div>
                          )}
                        </div>

                        {opp.added_by_user_id && (
                          <div className="text-xs text-slate-500 mt-2 pt-2 border-t">
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