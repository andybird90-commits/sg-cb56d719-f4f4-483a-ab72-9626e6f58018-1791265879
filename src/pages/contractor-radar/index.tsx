import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
import {
  getLeagueTable,
  addToLeagueTable,
  removeFromLeagueTable,
  moveContractorUp,
  moveContractorDown,
  type LeagueTableEntry,
} from "@/services/leagueTableService";
import { useContractorSelection } from "@/stores/contractorSelectionStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog";
import { DialogHeader } from "@/components/ui/dialog";
import { DialogTitle } from "@/components/ui/dialog";
import type React from "react";

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
  const [leagueTable, setLeagueTable] = useState<LeagueTableEntry[]>([]);
  const [isLoadingLeague, setIsLoadingLeague] = useState(false);
  const [addToCompanyDialogOpen, setAddToCompanyDialogOpen] = useState(false);
  const [selectedLeagueContractor, setSelectedLeagueContractor] = useState<LeagueTableEntry | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyFormData, setCompanyFormData] = useState({
    name: "",
    short_name: "",
    sector: "",
    status: "prospect" as "active" | "prospect" | "inactive",
    payment_terms: 30,
    company_number: "",
    address: "",
    vat_number: "",
    website: "",
    linkedin_url: "",
    accounts_email: "",
    notes: "",
  });

  useEffect(() => {
    loadContractors();
  }, [filters]);

  useEffect(() => {
    loadLeagueTable();
  }, []);

  const loadContractors = async () => {
    setIsLoading(true);
    try {
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
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load contractors",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeagueTable = async () => {
    setIsLoadingLeague(true);
    try {
      const data = await getLeagueTable();
      setLeagueTable(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load league table",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLeague(false);
    }
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

  const handleClearFilters = () => {
    setFilters({
      searchTerm: "",
      minScore: undefined,
      maxScore: undefined,
      limit: 50,
      offset: 0,
    });
  };

  const handleAddToLeagueTable = async () => {
    if (selectedIds.length === 0) return;

    try {
      // For now, add first selected contractor with a placeholder fit reason
      // Later we can add a dialog to get the fit reason from the user
      for (const contractorId of selectedIds) {
        await addToLeagueTable(contractorId, "Selected as a potential fit for current projects");
      }

      toast({
        title: "Success",
        description: `Added ${selectedIds.length} contractor(s) to league table`,
      });

      clearSelection();
      await loadLeagueTable();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add contractors to league table",
        variant: "destructive",
      });
    }
  };

  const handleMoveUp = async (entryId: string) => {
    try {
      await moveContractorUp(entryId);
      await loadLeagueTable();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move contractor up",
        variant: "destructive",
      });
    }
  };

  const handleMoveDown = async (entryId: string) => {
    try {
      await moveContractorDown(entryId);
      await loadLeagueTable();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move contractor down",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFromLeague = async (entryId: string) => {
    try {
      await removeFromLeagueTable(entryId);
      toast({
        title: "Success",
        description: "Contractor removed from league table",
      });
      await loadLeagueTable();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove contractor from league table",
        variant: "destructive",
      });
    }
  };

  const handleAddToCompanies = (contractor: LeagueTableEntry) => {
    setAddToCompanyDialogOpen(true);
    setSelectedLeagueContractor(contractor);
    // Pre-populate form with contractor data
    setCompanyFormData({
      name: contractor.contractor?.name || "",
      short_name: "",
      sector: "",
      status: "prospect",
      payment_terms: 30,
      company_number: "",
      address: "",
      vat_number: "",
      website: "",
      linkedin_url: "",
      accounts_email: "",
      notes: contractor.contractor?.notes || "",
    });
  };

  const handleCompanyFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("companies")
        .insert({
          ...companyFormData,
          added_by_user_id: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `${companyFormData.name} added to companies`,
      });

      setAddToCompanyDialogOpen(false);
      setSelectedLeagueContractor(null);
      setCompanyFormData({
        name: "",
        short_name: "",
        sector: "",
        status: "prospect",
        payment_terms: 30,
        company_number: "",
        address: "",
        vat_number: "",
        website: "",
        linkedin_url: "",
        accounts_email: "",
        notes: "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create company",
        variant: "destructive",
      });
    } finally {
      setSavingCompany(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Contractor Radar</h1>
            <p className="text-muted-foreground">Browse and manage M&E contractors</p>
          </div>

          {/* League Table Section */}
          <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border-2 border-yellow-400 dark:border-yellow-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-500 text-white rounded-full p-2">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">League Table</CardTitle>
                    <p className="text-sm text-muted-foreground">Your curated top contractors</p>
                  </div>
                </div>
                {selectedIds.length > 0 && (
                  <Button onClick={handleAddToLeagueTable} variant="default">
                    Add {selectedIds.length} to League Table
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLeague ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : leagueTable.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No contractors in your league table yet</p>
                  <p className="text-sm mt-2">Select contractors below and click "Add to League Table"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leagueTable.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 p-4 rounded-lg border-2 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
                    >
                      {/* Rank Badge */}
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {entry.rank_position}
                        </div>
                      </div>

                      {/* Contractor Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{entry.contractor?.name}</h3>
                          <Badge variant="outline">Score: {entry.contractor?.radar_score?.toFixed(1) ?? 'N/A'}</Badge>
                          {entry.contractor?.enhancement_confidence !== null && (
                            <Badge variant="secondary">
                              Confidence: {entry.contractor?.enhancement_confidence?.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-start gap-2 text-sm">
                          <span className="font-medium text-muted-foreground min-w-[80px]">Why a fit:</span>
                          <p className="flex-1 text-gray-700 dark:text-gray-300">
                            {entry.fit_reason || "No reason provided yet"}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {entry.contractor?.region && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {entry.contractor.region}
                            </span>
                          )}
                          {entry.contractor?.sic_code && (
                            <Badge variant="outline" className="text-xs">
                              SIC: {entry.contractor.sic_code}
                            </Badge>
                          )}
                          {entry.contractor?.employees && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {entry.contractor.employees} employees
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAddToCompanies(entry)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          + Company
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMoveUp(entry.id)}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMoveDown(entry.id)}
                          disabled={index === leagueTable.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveFromLeague(entry.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedContractor(contractor)}
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

        {/* Contractor Detail Dialog */}
        <Dialog open={!!selectedContractor} onOpenChange={(open) => !open && setSelectedContractor(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedContractor && (
              <div className="space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <Building2 className="h-6 w-6" />
                    {selectedContractor.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Radar Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {selectedContractor.radar_score?.toFixed(1) ?? '0.0'}
                      </div>
                    </CardContent>
                  </Card>

                  {selectedContractor.enhancement_confidence !== null && typeof selectedContractor.enhancement_confidence === "number" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Enhancement Confidence</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {selectedContractor.enhancement_confidence.toFixed(0)}%
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedContractor.region && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Region:</span>
                        <span>{selectedContractor.region}</span>
                      </div>
                    )}
                    {selectedContractor.postcode && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Postcode:</span>
                        <span>{selectedContractor.postcode}</span>
                      </div>
                    )}
                    {selectedContractor.sic_code && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">SIC Code:</span>
                        <Badge variant="outline">{selectedContractor.sic_code}</Badge>
                      </div>
                    )}
                    {selectedContractor.employees && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Employees:</span>
                        <span>{selectedContractor.employees}</span>
                      </div>
                    )}
                    {selectedContractor.turnover_gbp && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Turnover:</span>
                        <span>£{selectedContractor.turnover_gbp.toLocaleString()}</span>
                      </div>
                    )}
                    {selectedContractor.last_enhanced_at && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Last Enhanced:</span>
                        <span>{new Date(selectedContractor.last_enhanced_at).toLocaleString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedContractor.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-wrap">{selectedContractor.notes}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedContractor(null)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    router.push(`/admin/contractor-enhancer`);
                    // Pre-select this contractor
                    toggle(selectedContractor.id);
                  }}>
                    Enhance This Contractor
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add to Companies Dialog */}
        <Dialog open={addToCompanyDialogOpen} onOpenChange={setAddToCompanyDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add to Companies</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCompanyFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium">Company Name *</label>
                  <Input
                    value={companyFormData.name}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Short Name</label>
                  <Input
                    value={companyFormData.short_name}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, short_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Sector</label>
                  <Input
                    value={companyFormData.sector}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, sector: e.target.value })}
                    placeholder="e.g., Construction, M&E"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Status *</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={companyFormData.status}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, status: e.target.value as "active" | "prospect" | "inactive" })}
                    required
                  >
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Payment Terms (days) *</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={companyFormData.payment_terms}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, payment_terms: parseInt(e.target.value) })}
                    required
                  >
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={45}>45 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Company Number</label>
                  <Input
                    value={companyFormData.company_number}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, company_number: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">VAT Number</label>
                  <Input
                    value={companyFormData.vat_number}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, vat_number: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-sm font-medium">Address</label>
                  <Input
                    value={companyFormData.address}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Website</label>
                  <Input
                    value={companyFormData.website}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">LinkedIn URL</label>
                  <Input
                    value={companyFormData.linkedin_url}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/company/..."
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-sm font-medium">Accounts Email</label>
                  <Input
                    type="email"
                    value={companyFormData.accounts_email}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, accounts_email: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={companyFormData.notes}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddToCompanyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingCompany}>
                  {savingCompany ? "Adding..." : "Add to Companies"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}