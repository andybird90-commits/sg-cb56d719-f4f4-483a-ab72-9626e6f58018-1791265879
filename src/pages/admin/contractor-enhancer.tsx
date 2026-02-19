import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  TrendingUp,
  Users,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  getContractorRadarList,
  correctCompanyNames,
  type ContractorListItem,
  type ContractorFilters,
} from "@/services/contractorDataService";
import { useContractorSelection } from "@/stores/contractorSelectionStore";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function ContractorEnhancerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { selectedIds, toggle, selectAll, clearSelection, isSelected } = useContractorSelection();

  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enhancing, setEnhancing] = useState(false);
  const [correctingNames, setCorrectingNames] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState(0);
  const [filters, setFilters] = useState<ContractorFilters>({
    status: ["active", "prospect"],
    limit: 50,
    offset: 0,
  });
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadContractors();
  }, [filters]);

  const loadContractors = async () => {
    setLoading(true);
    const { data, error, count } = await getContractorRadarList(filters);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load contractors",
        variant: "destructive",
      });
    } else {
      setContractors(data);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === contractors.length) {
      clearSelection();
    } else {
      selectAll(contractors.map((c) => c.id));
    }
  };

  const handleCorrectNames = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select contractors first",
        variant: "destructive",
      });
      return;
    }

    setCorrectingNames(true);
    try {
      const result = await correctCompanyNames(selectedIds);
      
      toast({
        title: "Names Corrected",
        description: `${result.count_corrected} names corrected, ${result.count_skipped} skipped`,
      });

      // Refresh the list
      await loadContractors();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to correct names",
        variant: "destructive",
      });
    } finally {
      setCorrectingNames(false);
    }
  };

  const handleEnhanceSelected = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select contractors first",
        variant: "destructive",
      });
      return;
    }

    setEnhancing(true);
    setEnhancementProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedIds.length; i++) {
      const contractorId = selectedIds[i];
      
      try {
        // Call the enhancement Edge Function
        const { data, error } = await supabase.functions.invoke("enhance-contractor", {
          body: { contractor_id: contractorId }
        });

        if (error) throw error;

        successCount++;
        
        // Update progress
        setEnhancementProgress(((i + 1) / selectedIds.length) * 100);
        
        // Refresh the list after each enhancement
        await loadContractors();
      } catch (error) {
        console.error(`Failed to enhance contractor ${contractorId}:`, error);
        failCount++;
      }
    }

    setEnhancing(false);
    setEnhancementProgress(0);

    toast({
      title: "Enhancement Complete",
      description: `${successCount} contractors enhanced, ${failCount} failed`,
    });
  };

  const handleEnhanceAllNeedingUpdate = async () => {
    // Find all contractors that need updating (no last_enhanced_at or low confidence)
    const needsUpdate = contractors.filter(
      (c) => !c.last_enhanced_at || (c.enhancement_confidence !== null && c.enhancement_confidence < 80)
    );

    if (needsUpdate.length === 0) {
      toast({
        title: "No Updates Needed",
        description: "All contractors are up to date",
      });
      return;
    }

    selectAll(needsUpdate.map((c) => c.id));
    await handleEnhanceSelected();
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contractor Enhancer</h1>
            <p className="text-muted-foreground">
              Enhance contractor data with AI-powered enrichment
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/contractor-radar")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Radar
          </Button>
        </div>

        {selectedIds.length > 0 && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {selectedIds.length} Selected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Ready to enhance
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {enhancing && (
          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Enhancing contractors...</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(enhancementProgress)}%
                  </span>
                </div>
                <Progress value={enhancementProgress} className="w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleEnhanceSelected}
                disabled={selectedIds.length === 0 || enhancing}
              >
                {enhancing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Enhance Selected Contractors
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleEnhanceAllNeedingUpdate}
                disabled={enhancing}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Enhance All (Needs Update)
              </Button>

              <Button
                variant="outline"
                onClick={handleCorrectNames}
                disabled={selectedIds.length === 0 || correctingNames}
              >
                {correctingNames ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Correcting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Correct Names (CH)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Contractors ({totalCount})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={contractors.length > 0 && selectedIds.length === contractors.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Select All</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : contractors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No contractors found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contractors.map((contractor) => (
                  <Card
                    key={contractor.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected(contractor.id)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : ""
                    }`}
                    onClick={() => toggle(contractor.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <Checkbox
                            checked={isSelected(contractor.id)}
                            onCheckedChange={() => toggle(contractor.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 space-y-3">
                            <div>
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                {contractor.name}
                              </h3>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                {contractor.region && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {contractor.region}
                                  </span>
                                )}
                                {contractor.postcode && (
                                  <span>{contractor.postcode}</span>
                                )}
                                {contractor.sic_code && (
                                  <Badge variant="outline">
                                    SIC: {contractor.sic_code}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {contractor.email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span className="truncate">{contractor.email}</span>
                                </div>
                              )}
                              {contractor.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span>{contractor.phone}</span>
                                </div>
                              )}
                              {contractor.website_clean && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                  <span className="truncate">{contractor.website_clean}</span>
                                </div>
                              )}
                              {contractor.employees_band && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span>{contractor.employees_band}</span>
                                </div>
                              )}
                            </div>

                            {contractor.capabilities && contractor.capabilities.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {contractor.capabilities.slice(0, 5).map((cap, idx) => (
                                  <Badge key={idx} variant="secondary">
                                    {cap}
                                  </Badge>
                                ))}
                                {contractor.capabilities.length > 5 && (
                                  <Badge variant="outline">
                                    +{contractor.capabilities.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right space-y-2">
                          <div>
                            <div className="text-sm text-muted-foreground">Radar Score</div>
                            <div className="text-2xl font-bold flex items-center gap-1">
                              <TrendingUp className="h-5 w-5" />
                              {contractor.radar_score.toFixed(1)}
                            </div>
                          </div>
                          {contractor.enhancement_confidence !== null && (
                            <Badge variant="outline">
                              Confidence: {contractor.enhancement_confidence.toFixed(0)}%
                            </Badge>
                          )}
                          {contractor.last_enhanced_at ? (
                            <div className="text-xs text-muted-foreground">
                              Enhanced: {new Date(contractor.last_enhanced_at).toLocaleDateString()}
                            </div>
                          ) : (
                            <Badge variant="secondary">Not Enhanced</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {totalCount > (filters.limit || 50) && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              disabled={filters.offset === 0}
              onClick={() => setFilters({ ...filters, offset: Math.max(0, (filters.offset || 0) - (filters.limit || 50)) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={(filters.offset || 0) + (filters.limit || 50) >= totalCount}
              onClick={() => setFilters({ ...filters, offset: (filters.offset || 0) + (filters.limit || 50) })}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}