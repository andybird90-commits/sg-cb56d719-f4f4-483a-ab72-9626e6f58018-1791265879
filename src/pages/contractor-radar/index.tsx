import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { contractorRadarService } from "@/services/contractorRadarService";
import type { Database } from "@/integrations/supabase/types";
import { Radar, Search, Filter, X, Building2, Phone, Mail, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ContractorRadarView = Database["public"]["Views"]["me_contractor_radar_view"]["Row"];

const REGIONS = [
  "London",
  "South East",
  "East of England",
  "South West",
  "West Midlands",
  "East Midlands",
  "Yorkshire and The Humber",
  "North West",
  "North East",
  "Wales",
  "Scotland",
  "Northern Ireland"
];

const CAPABILITIES = [
  "Electrical",
  "Mechanical",
  "HVAC",
  "Plumbing",
  "Fire & Security",
  "Data & Comms",
  "BMS",
  "Sprinklers",
  "Lifts & Escalators",
  "Renewable Energy"
];

const STATUSES = ["active", "prospect", "do_not_use", "inactive"];

function ContractorRadarContent() {
  const { toast } = useToast();
  const [contractors, setContractors] = useState<ContractorRadarView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["active", "prospect"]);
  const [minScore, setMinScore] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(50);
  
  // Side panel
  const [selectedContractor, setSelectedContractor] = useState<string | null>(null);
  const [contractorDetails, setContractorDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchContractors();
  }, [selectedRegions, selectedCapabilities, selectedStatuses, minScore, currentPage]);

  const fetchContractors = async () => {
    setLoading(true);
    setError(null);

    const offset = (currentPage - 1) * limit;
    const result = await contractorRadarService.fetchContractors({
      regions: selectedRegions.length > 0 ? selectedRegions : undefined,
      capabilities: selectedCapabilities.length > 0 ? selectedCapabilities : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      minScore: minScore > 0 ? minScore : undefined,
      limit,
      offset
    });

    if (result.error) {
      setError(result.error);
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive"
      });
    } else {
      setContractors(result.data);
      setTotalCount(result.count);
    }

    setLoading(false);
  };

  const fetchContractorDetails = async (contractorId: string) => {
    setLoadingDetails(true);
    const result = await contractorRadarService.fetchContractorDetails(contractorId);
    
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive"
      });
    } else {
      setContractorDetails(result);
    }
    
    setLoadingDetails(false);
  };

  const handleRowClick = (contractorId: string) => {
    setSelectedContractor(contractorId);
    fetchContractorDetails(contractorId);
  };

  const handleRecalculateScore = async (contractorId: string) => {
    const result = await contractorRadarService.recalculateRadarScore(contractorId);
    
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Radar score recalculated successfully"
      });
      fetchContractors();
      if (selectedContractor) {
        fetchContractorDetails(contractorId);
      }
    }
  };

  const handleUpdateStatus = async (contractorId: string, status: string) => {
    const result = await contractorRadarService.updateContractorStatus(contractorId, status);
    
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: `Contractor marked as ${status}`
      });
      fetchContractors();
      if (selectedContractor) {
        fetchContractorDetails(contractorId);
      }
    }
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const toggleCapability = (capability: string) => {
    setSelectedCapabilities(prev =>
      prev.includes(capability) ? prev.filter(c => c !== capability) : [...prev, capability]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSelectedRegions([]);
    setSelectedCapabilities([]);
    setSelectedStatuses(["active", "prospect"]);
    setMinScore(0);
    setSearchTerm("");
  };

  const getRadarScoreBadge = (score: number | null) => {
    if (!score) return <Badge variant="secondary">N/A</Badge>;
    
    if (score >= 80) return <Badge className="bg-green-600 hover:bg-green-700">{score}</Badge>;
    if (score >= 60) return <Badge className="bg-blue-600 hover:bg-blue-700">{score}</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-600 hover:bg-yellow-700">{score}</Badge>;
    return <Badge variant="destructive">{score}</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    switch (status) {
      case "active":
        return <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>;
      case "prospect":
        return <Badge className="bg-blue-600 hover:bg-blue-700">Prospect</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "do_not_use":
        return <Badge variant="destructive">Do Not Use</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredContractors = contractors.filter(contractor =>
    searchTerm === "" || contractor.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Contractor Radar</h1>
              <p className="text-muted-foreground">
                Discover and prioritise SME M&E contractors for partnership
              </p>
            </div>
          </div>
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filters</CardTitle>
                <Button onClick={clearFilters} variant="ghost" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div>
                <Label>Search by name</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contractors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Regions */}
              <div>
                <Label>Regions ({selectedRegions.length} selected)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {REGIONS.map(region => (
                    <Badge
                      key={region}
                      variant={selectedRegions.includes(region) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleRegion(region)}
                    >
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <Label>Capabilities ({selectedCapabilities.length} selected)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CAPABILITIES.map(capability => (
                    <Badge
                      key={capability}
                      variant={selectedCapabilities.includes(capability) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCapability(capability)}
                    >
                      {capability}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <Label>Status</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {STATUSES.map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={status}
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() => toggleStatus(status)}
                      />
                      <Label htmlFor={status} className="cursor-pointer capitalize">
                        {status.replace("_", " ")}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Minimum Radar Score */}
              <div>
                <Label>Minimum Radar Score: {minScore}</Label>
                <Slider
                  value={[minScore]}
                  onValueChange={(value) => setMinScore(value[0])}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredContractors.length} of {totalCount} contractors
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                {error}
              </div>
            ) : filteredContractors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mb-4" />
                <p>No contractors found matching your filters</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Radar Score</TableHead>
                    <TableHead>Contractor Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Last Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContractors.map((contractor) => (
                    <TableRow
                      key={contractor.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(contractor.id)}
                    >
                      <TableCell>{getRadarScoreBadge(contractor.radar_score)}</TableCell>
                      <TableCell className="font-medium">{contractor.name}</TableCell>
                      <TableCell>{contractor.region || "N/A"}</TableCell>
                      <TableCell>{getStatusBadge(contractor.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {contractor.capabilities && Array.isArray(contractor.capabilities) ? (
                            contractor.capabilities.slice(0, 3).map((cap, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {cap}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                          {contractor.capabilities && contractor.capabilities.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{contractor.capabilities.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contractor.last_contact_at
                          ? new Date(contractor.last_contact_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Side Panel */}
        <Sheet open={!!selectedContractor} onOpenChange={(open) => !open && setSelectedContractor(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : contractorDetails ? (
              <>
                <SheetHeader>
                  <SheetTitle className="text-2xl">{contractorDetails.contractor?.name}</SheetTitle>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Radar Score */}
                  {contractorDetails.radarScore && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Radar Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold">{contractorDetails.radarScore.radar_score}</span>
                          <Button onClick={() => handleRecalculateScore(contractorDetails.contractor.id)} size="sm">
                            Recalculate
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Geographic Fit</p>
                            <p className="font-semibold">{contractorDetails.radarScore.fit_geo}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Size Fit</p>
                            <p className="font-semibold">{contractorDetails.radarScore.fit_size}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Specialism Fit</p>
                            <p className="font-semibold">{contractorDetails.radarScore.fit_specialism}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Relationship Heat</p>
                            <p className="font-semibold">{contractorDetails.radarScore.relationship_heat}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Performance</p>
                            <p className="font-semibold">{contractorDetails.radarScore.performance}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Data Completeness</p>
                            <p className="font-semibold">{contractorDetails.radarScore.data_completeness}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Company Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Company Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground">Region</p>
                          <p className="font-medium">{contractorDetails.contractor?.region || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Postcode</p>
                          <p className="font-medium">{contractorDetails.contractor?.postcode || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">SIC Code</p>
                          <p className="font-medium">{contractorDetails.contractor?.sic_code || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Employees</p>
                          <p className="font-medium">{contractorDetails.contractor?.employees || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Turnover (GBP)</p>
                          <p className="font-medium">
                            {contractorDetails.contractor?.turnover_gbp
                              ? `£${contractorDetails.contractor.turnover_gbp.toLocaleString()}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium">{getStatusBadge(contractorDetails.contractor?.status)}</p>
                        </div>
                      </div>
                      {contractorDetails.contractor?.notes && (
                        <div className="mt-4">
                          <p className="text-muted-foreground">Notes</p>
                          <p className="font-medium">{contractorDetails.contractor.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Capabilities */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Capabilities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {contractorDetails.capabilities.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {contractorDetails.capabilities.map((cap: any) => (
                            <Badge key={cap.id} variant="secondary">
                              {cap.capability_name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No capabilities recorded</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Contacts */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Contacts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {contractorDetails.contacts.length > 0 ? (
                        <div className="space-y-3">
                          {contractorDetails.contacts.map((contact: any) => (
                            <div key={contact.id} className="border-b pb-3 last:border-b-0">
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-muted-foreground">{contact.role}</p>
                              {contact.email && (
                                <p className="text-sm flex items-center gap-1 mt-1">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </p>
                              )}
                              {contact.phone && (
                                <p className="text-sm flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {contact.phone}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No contacts recorded</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Relationship History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Relationship History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {contractorDetails.relationships.length > 0 ? (
                        <div className="space-y-3">
                          {contractorDetails.relationships.map((rel: any) => (
                            <div key={rel.id} className="border-b pb-3 last:border-b-0">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="capitalize">
                                  {rel.interaction_type?.replace("_", " ")}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(rel.interaction_date).toLocaleDateString()}
                                </span>
                              </div>
                              {rel.notes && <p className="text-sm mt-2">{rel.notes}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No relationship history recorded</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleUpdateStatus(contractorDetails.contractor.id, "active")}
                      className="flex-1"
                    >
                      Add to Outreach List
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(contractorDetails.contractor.id, "do_not_use")}
                      variant="destructive"
                      className="flex-1"
                    >
                      Mark as Do Not Use
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}

export default function ContractorRadar() {
  return (
    <RequireAuth>
      <ContractorRadarContent />
    </RequireAuth>
  );
}