import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { bidBuilderService } from "@/services/bidBuilderService";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Upload,
  Percent,
  Edit3,
  Copy,
  Info,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type StartMode = "upload" | "quick" | "manual" | "template" | null;

interface AiInsights {
  projectType?: string | null;
  sector?: string | null;
  serviceScope?: string | null;
  stage?: string | null;
  feeRisks?: string[];
  missingInformation?: string[];
  notes?: string;
}

function humanCurrency(value: number | null | undefined): string {
  if (!value || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function BidBuilderContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const opportunityIdFromQuery =
    typeof router.query.opportunity_id === "string"
      ? router.query.opportunity_id
      : undefined;

  const [startMode, setStartMode] = useState<StartMode>(null);
  const [opportunities, setOpportunities] = useState<
    Awaited<ReturnType<typeof bidBuilderService.listOpportunities>>
  >([]);
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<
    string | null
  >(opportunityIdFromQuery ?? null);
  const [loadingOpps, setLoadingOpps] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bidFiles, setBidFiles] = useState<
    Awaited<ReturnType<typeof bidBuilderService.fetchBidFiles>>
  >([]);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [insightsStatus, setInsightsStatus] = useState<
    "idle" | "generating" | "ready"
  >("idle");

  const [quickScenarioName, setQuickScenarioName] = useState("Standard");
  const [quickTotalBuildValue, setQuickTotalBuildValue] = useState("");
  const [quickMeValue, setQuickMeValue] = useState("");
  const [quickSector, setQuickSector] = useState("");
  const [quickBuildingType, setQuickBuildingType] = useState("");
  const [quickProjectStatus, setQuickProjectStatus] = useState("");
  const [quickListed, setQuickListed] = useState<"yes" | "no" | "unknown">(
    "unknown"
  );
  const [quickOccupied, setQuickOccupied] = useState<"yes" | "no" | "unknown">(
    "unknown"
  );
  const [quickComplexity, setQuickComplexity] = useState("");
  const [quickProgramme, setQuickProgramme] = useState("");
  const [quickStages, setQuickStages] = useState("");
  const [quickDisciplines, setQuickDisciplines] = useState("");
  const [quickResult, setQuickResult] =
    useState<Awaited<
      ReturnType<typeof bidBuilderService.calculateQuickFee>
    > | null>(null);
  const [quickSavingScenario, setQuickSavingScenario] = useState(false);
  const [quickConverting, setQuickConverting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadOpportunities = useCallback(
    async (search?: string) => {
      setLoadingOpps(true);
      const list = await bidBuilderService.listOpportunities(search);
      setOpportunities(list);
      setLoadingOpps(false);

      if (!selectedOpportunityId && list.length > 0) {
        setSelectedOpportunityId(list[0].id);
      }
    },
    [selectedOpportunityId]
  );

  const loadBidFiles = useCallback(
    async (opportunityId: string) => {
      setLoadingFiles(true);
      const files = await bidBuilderService.fetchBidFiles(opportunityId);
      setBidFiles(files);
      setLoadingFiles(false);
    },
    []
  );

  useEffect(() => {
    void loadOpportunities();
  }, [loadOpportunities]);

  useEffect(() => {
    if (selectedOpportunityId) {
      void loadBidFiles(selectedOpportunityId);
    } else {
      setBidFiles([]);
    }
  }, [selectedOpportunityId, loadBidFiles]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || !selectedOpportunityId || !profile?.id) return;
    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    setPageError(null);
    try {
      await bidBuilderService.uploadBidFiles(
        selectedOpportunityId,
        profile.id,
        files,
        { markAsInput: true }
      );
      await loadBidFiles(selectedOpportunityId);
    } catch (err) {
      console.error("Upload failed", err);
      setPageError("Failed to upload one or more files. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.files || !event.dataTransfer.files.length) return;
    await handleFilesSelected(event.dataTransfer.files);
  };

  const deriveInsightsLocally = () => {
    if (!bidFiles.length) {
      setAiInsights(null);
      setInsightsStatus("idle");
      return;
    }

    const filenames = bidFiles.map((f) => f.filename.toLowerCase());
    const textBlob = (bidFiles[0].parsed_text || "").toLowerCase();

    const guess = (candidates: string[], fallback: string | null = null) => {
      const haystack = `${filenames.join(" ")} ${textBlob}`;
      for (const c of candidates) {
        if (haystack.includes(c.toLowerCase())) return c;
      }
      return fallback;
    };

    const projectType =
      guess(["office", "residential", "industrial", "healthcare", "school"]) ||
      null;

    const sector =
      guess(["commercial", "residential", "public", "education", "health"]) ||
      null;

    const stage =
      guess(["riba 2", "riba 3", "riba 4", "tender", "pcsa", "precon"]) ||
      null;

    const feeRisks: string[] = [];
    if (filenames.some((f) => f.includes("rev") || f.includes("addendum"))) {
      feeRisks.push(
        "Multiple revisions detected in uploaded documents; scope or quantities may still be moving."
      );
    }
    if (!bidFiles.some((f) => f.filename.toLowerCase().includes("boq"))) {
      feeRisks.push(
        "No BOQ or schedule of work detected; quantities may need to be inferred."
      );
    }

    const missing: string[] = [];
    if (!filenames.some((f) => f.includes("scope"))) {
      missing.push("Clear written scope for M&E services.");
    }
    if (!filenames.some((f) => f.includes("programme"))) {
      missing.push("Programme / key milestone dates.");
    }
    if (!filenames.some((f) => f.includes("services"))) {
      missing.push("Confirmed list of disciplines and services in scope.");
    }

    setAiInsights({
      projectType,
      sector,
      serviceScope: null,
      stage,
      feeRisks,
      missingInformation: missing,
      notes:
        "These are automated assumptions inferred from filenames and any available text, not confirmed facts.",
    });
    setInsightsStatus("ready");
  };

  const handleGenerateInsights = async () => {
    setInsightsStatus("generating");
    deriveInsightsLocally();
  };

  const handleQuickCalculate = async () => {
    if (!selectedOpportunityId) {
      setPageError("Select an opportunity before running a quick fee estimate.");
      return;
    }
    if (!profile?.id) {
      setPageError("You must be signed in to run an estimate.");
      return;
    }

    setPageError(null);
    const input = {
      opportunityId: selectedOpportunityId,
      scenarioName: quickScenarioName || "Standard",
      totalBuildValue: quickTotalBuildValue ? Number(quickTotalBuildValue) : null,
      meValue: quickMeValue ? Number(quickMeValue) : null,
      sector: quickSector || null,
      buildingType: quickBuildingType || null,
      projectStatus: quickProjectStatus || null,
      listedBuilding:
        quickListed === "yes" ? true : quickListed === "no" ? false : null,
      occupiedSite:
        quickOccupied === "yes" ? true : quickOccupied === "no" ? false : null,
      complexityLevel: quickComplexity || null,
      programmePressure: quickProgramme || null,
      stagesRequired: quickStages
        ? quickStages.split(",").map((s) => s.trim())
        : [],
      disciplinesRequired: quickDisciplines
        ? quickDisciplines.split(",").map((s) => s.trim())
        : [],
    } satisfies import("@/services/bidBuilderService").QuickFeeInput;

    const result = await bidBuilderService.calculateQuickFee(input);
    setQuickResult(result);
  };

  const handleQuickSaveScenario = async () => {
    if (!selectedOpportunityId || !profile?.id || !quickResult) return;
    setQuickSavingScenario(true);
    setPageError(null);
    try {
      const input = {
        opportunityId: selectedOpportunityId,
        scenarioName: quickScenarioName || "Standard",
        totalBuildValue: quickTotalBuildValue
          ? Number(quickTotalBuildValue)
          : null,
        meValue: quickMeValue ? Number(quickMeValue) : null,
        sector: quickSector || null,
        buildingType: quickBuildingType || null,
        projectStatus: quickProjectStatus || null,
        listedBuilding:
          quickListed === "yes"
            ? true
            : quickListed === "no"
            ? false
            : null,
        occupiedSite:
          quickOccupied === "yes"
            ? true
            : quickOccupied === "no"
            ? false
            : null,
        complexityLevel: quickComplexity || null,
        programmePressure: quickProgramme || null,
        stagesRequired: quickStages
          ? quickStages.split(",").map((s) => s.trim())
          : [],
        disciplinesRequired: quickDisciplines
          ? quickDisciplines.split(",").map((s) => s.trim())
          : [],
      } satisfies import("@/services/bidBuilderService").QuickFeeInput;

      const scenario = await bidBuilderService.saveQuickFeeScenario(
        profile.id,
        input,
        quickResult
      );
      if (!scenario) {
        setPageError("Unable to save scenario. Check rules and try again.");
      }
    } finally {
      setQuickSavingScenario(false);
    }
  };

  const handleQuickConvertToEstimate = async () => {
    if (!profile?.id) return;
    if (!quickResult) return;

    const { data: existingScenarioData, error } = await supabase
      .from("opportunity_fee_scenarios")
      .select("*")
      .eq("opportunity_id", selectedOpportunityId)
      .eq("scenario_type", "quick_percentage")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !existingScenarioData) {
      setPageError(
        "You need to save this quick fee as a scenario before converting to an estimate."
      );
      return;
    }

    setQuickConverting(true);
    setPageError(null);
    try {
      const estimate = await bidBuilderService.convertScenarioToEstimate(
        profile.id,
        existingScenarioData as any
      );
      if (!estimate) {
        setPageError("Failed to create estimate from scenario.");
        return;
      }
    } finally {
      setQuickConverting(false);
    }
  };

  const selectedOpportunity = opportunities.find(
    (o) => o.id === selectedOpportunityId
  );

  const fileInputId = "bid-builder-file-input";

  const renderStartCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card
        className={`cursor-pointer border-dashed ${
          startMode === "upload" ? "border-blue-500 bg-blue-50/40" : ""
        }`}
        onClick={() => setStartMode("upload")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600" />
            Upload enquiry files
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Document-led
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Drag PDFs, drawings, specs and tender docs in to set the context for
          your estimate. Files can be marked as Bid Builder input or reference.
        </CardContent>
      </Card>

      <Card
        className={`cursor-pointer border-dashed ${
          startMode === "quick" ? "border-emerald-500 bg-emerald-50/40" : ""
        }`}
        onClick={() => setStartMode("quick")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-600" />
            Quick percentage fee
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Fast start
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Estimate fees from M&amp;E value or total build value using
          admin-managed percentage and complexity rules. Save scenarios and
          convert into full estimates.
        </CardContent>
      </Card>

      <Card
        className={`cursor-pointer border-dashed ${
          startMode === "manual" ? "border-slate-500 bg-slate-50/40" : ""
        }`}
        onClick={() => setStartMode("manual")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-slate-700" />
            Manual estimate
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Coming soon
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Build a detailed estimate line by line with stages, disciplines, and
          assumptions. This mode will use the same estimate model as quick
          scenarios.
        </CardContent>
      </Card>

      <Card
        className={`cursor-pointer border-dashed ${
          startMode === "template" ? "border-indigo-500 bg-indigo-50/40" : ""
        }`}
        onClick={() => setStartMode("template")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Copy className="w-4 h-4 text-indigo-600" />
            Use template
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Coming soon
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Start from reusable fee templates for common project types, then adapt
          the scope, stages, and pricing for this opportunity.
        </CardContent>
      </Card>
    </div>
  );

  const renderUploadMode = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] gap-4 lg:gap-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              1. Attach enquiry documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="border-2 border-dashed rounded-lg px-4 py-8 flex flex-col items-center justify-center text-center cursor-pointer bg-muted/40 hover:bg-muted/70 transition-colors"
                onClick={() => {
                  const input = document.getElementById(
                    fileInputId
                  ) as HTMLInputElement | null;
                  input?.click();
                }}
              >
                <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                <div className="text-sm font-medium mb-1">
                  Drag and drop files here, or click to browse
                </div>
                <div className="text-xs text-muted-foreground max-w-md">
                  PDFs, drawings, specs, scope docs, tender documents, BOQ
                  extracts, and relevant email attachments.
                </div>
                <input
                  id={fileInputId}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </div>

              {uploading && (
                <div className="text-xs text-muted-foreground">
                  Uploading files&hellip;
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  How files are used
                </Label>
                <p className="text-xs text-muted-foreground">
                  By default, uploaded files are treated as{" "}
                  <span className="font-semibold">Bid Builder input</span> for
                  AI-assisted context. You can turn this off per file if some
                  documents are just background reference.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              2. Files for this opportunity
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {bidFiles.length} file{bidFiles.length === 1 ? "" : "s"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingFiles && (
              <div className="text-xs text-muted-foreground">
                Loading files&hellip;
              </div>
            )}
            {!loadingFiles && bidFiles.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No enquiry documents uploaded yet. Add PDFs, drawings or tender
                packs to start a document-led bid build.
              </div>
            )}
            {!loadingFiles &&
              bidFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 bg-background"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {file.filename}
                      </span>
                      {file.is_bid_builder_input && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-5"
                        >
                          Bid Builder input
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {file.content_type || "Unknown type"} ·{" "}
                      {file.size_bytes
                        ? `${Math.round(file.size_bytes / 1024)} KB`
                        : "Size unknown"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      size="xs"
                      variant="outline"
                      className="h-6 text-[11px] px-2"
                      onClick={async () => {
                        await bidBuilderService.setBidFileInputFlag(
                          file.id,
                          !file.is_bid_builder_input
                        );
                        if (selectedOpportunityId) {
                          await loadBidFiles(selectedOpportunityId);
                        }
                      }}
                    >
                      {file.is_bid_builder_input
                        ? "Mark as reference"
                        : "Use as input"}
                    </Button>
                    {file.parsed_text && (
                      <span className="text-[10px] text-muted-foreground">
                        Parsed text available
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              3. Automated insight draft
              <Info className="w-3 h-3 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Alert variant="default" className="border-dashed">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This panel summarises{" "}
                <span className="font-semibold">draft assumptions</span> based
                on file names and any available text. They are{" "}
                <span className="font-semibold">
                  suggestions, not confirmed facts
                </span>
                . Always check against the original enquiry.
              </AlertDescription>
            </Alert>

            <Button
              size="sm"
              variant="outline"
              className="w-full justify-center"
              disabled={!bidFiles.length || insightsStatus === "generating"}
              onClick={handleGenerateInsights}
            >
              {insightsStatus === "generating"
                ? "Analysing files…"
                : "Generate draft insights from files"}
            </Button>

            {aiInsights && (
              <div className="space-y-3 mt-2">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Likely project type (assumption)
                  </div>
                  <div className="text-sm">
                    {aiInsights.projectType || "Not inferred"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Likely sector (assumption)
                  </div>
                  <div className="text-sm">
                    {aiInsights.sector || "Not inferred"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Likely stage (assumption)
                  </div>
                  <div className="text-sm">
                    {aiInsights.stage || "Not inferred"}
                  </div>
                </div>
                {aiInsights.feeRisks && aiInsights.feeRisks.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Possible fee risks
                    </div>
                    <ul className="mt-1 list-disc pl-4 text-xs space-y-1">
                      {aiInsights.feeRisks.map((risk, index) => (
                        <li key={`${risk}-${index}`}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiInsights.missingInformation &&
                  aiInsights.missingInformation.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Missing or unclear information
                      </div>
                      <ul className="mt-1 list-disc pl-4 text-xs space-y-1">
                        {aiInsights.missingInformation.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                {aiInsights.notes && (
                  <p className="text-[11px] text-muted-foreground">
                    {aiInsights.notes}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              4. Next action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Use these documents either to drive a quick percentage fee or to
              support a more detailed manual estimate.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={() => setStartMode("quick")}
              >
                Create estimate from insights
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStartMode("manual")}
              >
                Use files as reference only
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="hidden xl:block space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Opportunity context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {selectedOpportunity ? (
              <>
                <div className="font-medium">
                  {selectedOpportunity.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedOpportunity.company_name}
                </div>
                {selectedOpportunity.enquiry_number && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Enquiry number
                    </div>
                    <div className="font-mono text-xs">
                      {selectedOpportunity.enquiry_number}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">
                Select an opportunity to see context and link uploaded files.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderQuickMode = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,2fr)_minmax(0,1.4fr)] gap-4 lg:gap-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Inputs and assumptions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="scenario-name" className="text-xs">
                Scenario name
              </Label>
              <Input
                id="scenario-name"
                value={quickScenarioName}
                onChange={(e) => setQuickScenarioName(e.target.value)}
                placeholder="e.g. Standard, Listed refurbishment, Fast-track live"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="total-build" className="text-xs">
                  Total build value (£)
                </Label>
                <Input
                  id="total-build"
                  type="number"
                  min="0"
                  value={quickTotalBuildValue}
                  onChange={(e) => setQuickTotalBuildValue(e.target.value)}
                  placeholder="Leave blank if unknown"
                />
                <p className="text-[11px] text-muted-foreground">
                  If only this is known, M&amp;E value will be inferred using
                  admin rules (and clearly labelled as an assumption).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="me-value" className="text-xs">
                  M&amp;E value (£)
                </Label>
                <Input
                  id="me-value"
                  type="number"
                  min="0"
                  value={quickMeValue}
                  onChange={(e) => setQuickMeValue(e.target.value)}
                  placeholder="If known, use this directly"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sector</Label>
                <Input
                  value={quickSector}
                  onChange={(e) => setQuickSector(e.target.value)}
                  placeholder="e.g. Commercial, Residential"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Building type</Label>
                <Input
                  value={quickBuildingType}
                  onChange={(e) => setQuickBuildingType(e.target.value)}
                  placeholder="e.g. Office, Healthcare"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Project status</Label>
                <Select
                  value={quickProjectStatus}
                  onValueChange={setQuickProjectStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_build">New build</SelectItem>
                    <SelectItem value="refurbishment">Refurbishment</SelectItem>
                    <SelectItem value="fit_out">Fit-out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Listed building</Label>
                <Select value={quickListed} onValueChange={setQuickListed}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Not specified</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Occupied / live site</Label>
                <Select value={quickOccupied} onValueChange={setQuickOccupied}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Not specified</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Complexity</Label>
                <Select
                  value={quickComplexity}
                  onValueChange={setQuickComplexity}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Standard</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="very_high">Very high</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Programme pressure</Label>
                <Select
                  value={quickProgramme}
                  onValueChange={setQuickProgramme}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Normal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Normal</SelectItem>
                    <SelectItem value="accelerated">Accelerated</SelectItem>
                    <SelectItem value="fast_track">Fast track</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Stages required (comma-separated)
              </Label>
              <Input
                value={quickStages}
                onChange={(e) => setQuickStages(e.target.value)}
                placeholder="e.g. RIBA 2, RIBA 3, RIBA 4, RIBA 5"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Disciplines required (comma-separated)
              </Label>
              <Input
                value={quickDisciplines}
                onChange={(e) => setQuickDisciplines(e.target.value)}
                placeholder="e.g. Mechanical, Electrical, Public Health"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button className="flex-1" onClick={handleQuickCalculate}>
                Calculate quick fee
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                disabled={!quickResult || quickSavingScenario}
                onClick={handleQuickSaveScenario}
              >
                {quickSavingScenario ? "Saving scenario…" : "Save scenario"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Fee ranges (percentage model)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!quickResult && (
              <div className="text-xs text-muted-foreground">
                Run a calculation to see low, target and high fee bands with the
                underlying assumptions and percentages.
              </div>
            )}

            {quickResult && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-md border px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      Low fee (lean)
                    </div>
                    <div className="text-base font-semibold">
                      {humanCurrency(quickResult.feeLow)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {quickResult.baseLowPct.toFixed(1)}% base
                    </div>
                  </div>
                  <div className="rounded-md border px-3 py-2 bg-emerald-50/30">
                    <div className="text-[11px] text-muted-foreground">
                      Target fee
                    </div>
                    <div className="text-base font-semibold">
                      {humanCurrency(quickResult.feeTarget)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {quickResult.baseTargetPct.toFixed(1)}% base
                    </div>
                  </div>
                  <div className="rounded-md border px-3 py-2 bg-amber-50/40">
                    <div className="text-[11px] text-muted-foreground">
                      High / risk-adjusted
                    </div>
                    <div className="text-base font-semibold">
                      {humanCurrency(quickResult.feeHigh)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {quickResult.baseHighPct.toFixed(1)}% base
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">
                    Basis of calculation
                  </div>
                  <div className="text-xs">
                    M&amp;E value used:{" "}
                    <span className="font-mono">
                      {humanCurrency(quickResult.usedMeValue)}
                    </span>{" "}
                    (
                    {quickResult.calculationMode === "me_value"
                      ? "provided directly"
                      : "derived from total build"}
                    )
                  </div>
                  {quickResult.derivedMeValue &&
                    quickResult.calculationMode === "total_build" && (
                      <div className="text-[11px] text-muted-foreground">
                        M&amp;E value was inferred from total build value using
                        rules, and should be treated as an assumption.
                      </div>
                    )}
                </div>

                <div className="space-y-1 pt-2">
                  <div className="text-[11px] text-muted-foreground">
                    Applied multipliers
                  </div>
                  {quickResult.appliedMultipliers.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      No complexity or condition multipliers applied. Overall
                      multiplier is 1.0 (base percentages only).
                    </div>
                  )}
                  {quickResult.appliedMultipliers.length > 0 && (
                    <ul className="text-xs space-y-1">
                      {quickResult.appliedMultipliers.map((m) => (
                        <li key={m.code} className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            ×{m.multiplier.toFixed(2)}
                          </Badge>
                          <span>{m.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    Overall multiplier:{" "}
                    <span className="font-mono">
                      {quickResult.overallMultiplier.toFixed(2)}
                    </span>
                  </div>
                </div>

                {quickResult.assumptions.length > 0 && (
                  <div className="space-y-1 pt-2">
                    <div className="text-[11px] text-muted-foreground">
                      Assumptions and inferred values
                    </div>
                    <ul className="list-disc pl-4 text-[11px] space-y-1">
                      {quickResult.assumptions.map((a, index) => (
                        <li key={`${a}-${index}`}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Scenario &amp; estimate actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Save different fee scenarios for the same opportunity (standard,
              high complexity, listed refurbishment, fast-track live, etc.).
              Each scenario keeps its own assumptions and totals and can be
              converted into an editable estimate.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="outline"
                disabled={!quickResult || quickSavingScenario}
                onClick={handleQuickSaveScenario}
              >
                {quickSavingScenario
                  ? "Saving scenario…"
                  : "Save this as a scenario"}
              </Button>
              <Button
                disabled={!quickResult || quickConverting}
                onClick={handleQuickConvertToEstimate}
              >
                {quickConverting
                  ? "Creating estimate…"
                  : "Convert to editable estimate"}
              </Button>
            </div>
            <Alert variant="default" className="mt-2 border-dashed">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-[11px]">
                Converted estimates use the same model as manual estimates and
                can be refined later with detailed line items, stages and
                disciplines. The full calculation basis and assumptions are
                stored with the estimate record.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span>Bid Builder</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Multi-start estimating for consulting engineering bids. Start from
              enquiry documents, a quick percentage fee, a manual build, or a
              reusable template&mdash;then convert everything into a single
              editable estimate model.
            </p>
          </div>

          <div className="w-full sm:w-auto space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Opportunity
            </Label>
            <div className="flex gap-2">
              <Select
                value={selectedOpportunityId ?? ""}
                onValueChange={(value) =>
                  setSelectedOpportunityId(value || null)
                }
              >
                <SelectTrigger className="min-w-[200px]">
                  <SelectValue
                    placeholder={
                      loadingOpps ? "Loading…" : "Select opportunity"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {opportunities.map((opp) => (
                    <SelectItem key={opp.id} value={opp.id}>
                      {opp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search"
                className="w-32 sm:w-40"
                value={opportunitySearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setOpportunitySearch(value);
                  void loadOpportunities(value);
                }}
              />
            </div>
            {selectedOpportunity && (
              <div className="text-[11px] text-muted-foreground">
                {selectedOpportunity.company_name}
                {selectedOpportunity.enquiry_number && (
                  <>
                    {" "}
                    · Enquiry{" "}
                    <span className="font-mono">
                      {selectedOpportunity.enquiry_number}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {pageError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{pageError}</AlertDescription>
          </Alert>
        )}

        {renderStartCards()}

        {startMode === "upload" && renderUploadMode()}
        {startMode === "quick" && renderQuickMode()}

        {startMode === "manual" && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Manual estimate (coming soon)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Manual estimate mode will let you build a detailed fee model using
              stages, disciplines, hourly rates, and line items. It will use
              the same underlying estimate tables as quick scenarios so you can
              move seamlessly between high-level and detailed views.
            </CardContent>
          </Card>
        )}

        {startMode === "template" && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Template-based estimate (coming soon)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Template mode will surface admin-managed standard fee structures
              for common project types (e.g. Cat A office, healthcare ward
              refurb). You will be able to select a template, tweak the
              assumptions and values, then save it as a scenario and convert it
              into an editable estimate.
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export default function BidBuilderPage() {
  return (
    <RequireAuth>
      <BidBuilderContent />
    </RequireAuth>
  );
}