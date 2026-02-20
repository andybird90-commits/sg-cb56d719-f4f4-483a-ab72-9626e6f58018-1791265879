import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  TrendingUp,
  Users,
  ArrowRight,
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
import { Dialog } from "@/components/ui/dialog";

export default function ContractorRadarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { selectedIds, toggle, selectAll, clearSelection, isSelected } = useContractorSelection();

  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [correctingNames, setCorrectingNames] = useState(false);
  const [filters, setFilters] = useState<ContractorFilters>({
    status: ["active", "prospect"],
    limit: 50,
    offset: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [selectedContractor, setSelectedContractor] = useState<ContractorListItem | null>(null);

  useEffect(() => {
    loadContractors();
  }, [filters]);

  const loadContractors = async () => {
    setIsLoading(true);
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
    setIsLoading(false);
  };

  const handleSearch = () => {
    setFilters({
      ...filters,
      searchTerm: searchTerm || undefined,
      offset: 0,
    });
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

  const handleEnhanceSelected = () => {
    if (selectedIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select contractors first",
        variant: "destructive",
      });
      return;
    }
    router.push("/admin/contractor-enhancer");
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contractor Radar</h1>
            <p className="text-muted-foreground">
              Browse and manage M&E contractors
            </p>
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleCorrectNames}
                  disabled={correctingNames}
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
                <Button onClick={handleEnhanceSelected}>
                  Enhance Selected → Admin
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
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
                    Click contractors to select/deselect
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch}>Search</Button>
              <Button variant="outline" onClick={() => {
                setSearchTerm("");
                setFilters({ ...filters, searchTerm: undefined });
              }}>
                Clear
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
            {isLoading ? (
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
                  <div
                    key={contractor.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    onClick={() => router.push(`/admin/contractor/${contractor.id}`)}
                  >
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
                        <Badge variant="outline" className="text-lg font-bold">
                          Score: {contractor.radar_score?.toFixed(1) ?? '0.0'}
                        </Badge>
                      </div>
                      <div>
                        {contractor.enhancement_confidence !== null && typeof contractor.enhancement_confidence === "number" && (
                          <Badge variant="secondary">
                            Confidence: {contractor.enhancement_confidence.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      {contractor.last_enhanced_at ? (
                        <div className="text-xs text-muted-foreground">
                          Enhanced: {new Date(contractor.last_enhanced_at).toLocaleDateString()}
                        </div>
                      ) : (
                        <Badge variant="secondary">Not Enhanced</Badge>
                      )}
                    </div>
                  </div>
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