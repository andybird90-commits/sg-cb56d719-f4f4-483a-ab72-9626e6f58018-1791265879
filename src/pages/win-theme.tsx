import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { StrategySettings, WinThemeRow } from "@/services/winThemeService";
import {
  createWinTheme,
  listWinThemesForOpportunity,
  updateWinTheme,
  deleteWinTheme,
} from "@/services/winThemeService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Clipboard,
  ClipboardCheck,
  Loader2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OpportunitySummary {
  id: string;
  name: string;
  project_reference: string | null;
  company_name: string | null;
  company_number: string | null;
}

interface WinThemePayloadKeyMove {
  title: string;
  description: string;
  timeframe?: string;
  owner_hint?: string;
}

interface WinThemePayloadRisk {
  risk: string;
  likelihood?: string;
  impact?: string;
  mitigation_strategy: string;
}

interface WinThemePayloadProposalArchitecture {
  recommended_structure: string;
  must_hit_messages?: string[];
  evidence_to_show?: string[];
}

interface WinThemePayloadStakeholderStrategy {
  key_stakeholder_groups?: string[];
  engagement_tactics?: string[];
}

interface WinThemePayloadTalkTracks {
  meeting_openers?: string[];
  email_subject_ideas?: string[];
  email_hook_paragraph?: string;
}

interface WinThemePayload {
  executive_win_theme: string;
  client_context_insight: string;
  value_narrative: string;
  key_moves: WinThemePayloadKeyMove[];
  risks_and_objections: WinThemePayloadRisk[];
  proposal_architecture: WinThemePayloadProposalArchitecture;
  stakeholder_strategy?: WinThemePayloadStakeholderStrategy;
  talk_tracks_and_openers?: WinThemePayloadTalkTracks;
  gaps_and_unknowns: string[];
}

// Local types for payload and Companies House data used in the page only
interface CompaniesHouseSource {
  error?: boolean;
  status?: number;
  message?: string;
  company_number?: string | null;
  company_name?: string | null;
  company_status?: string | null;
  date_of_creation?: string | null;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  sic_codes?: string[] | null;
}

interface BraveSearchSnippet {
  title: string;
  url: string;
  description: string;
}

interface BraveContext {
  query: string;
  results: BraveSearchSnippet[];
}

// Use a local context bundle type only within this page
interface WinThemeContextBundle {
  companies_house?: CompaniesHouseSource | null;
  brave?: BraveContext | null;
  [key: string]: unknown;
}

// Type that includes joined opportunity for display
type WinThemeWithJoinedOpportunity = WinThemeRow & {
  opportunity?: OpportunitySummary | null;
};

type GenerateMode = "generate" | "regenerate" | "clone";

interface GenerateWinThemeResponse {
  payload: WinThemePayload;
  summary: string;
  strategy_settings: StrategySettings;
  context_bundle?: WinThemeContextBundle | null;
}

type CopyStateKey =
  | "email_hook"
  | "talk_tracks"
  | "executive"
  | "value_narrative";

interface BlockerChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BlockerContextForWinTheme {
  latest_description: string;
  history: BlockerChatMessage[];
}

interface BlockerApiResponse {
  analysis: string;
  suggestions: string[];
  questions: string[];
}

interface GenerateDeps {
  profile: { id?: string | null } | null;
  selectedOpportunity: OpportunitySummary | null;
  selectedWinTheme: WinThemeRow | null;
  setError: (val: string | null) => void;
  setGeneratingMode: (mode: GenerateMode | null) => void;
  setSelectedWinThemes: (themes: WinThemeRow[]) => void;
  setSelectedWinTheme: (theme: WinThemeRow | null) => void;
  setEditablePayload: (payload: WinThemePayload | null) => void;
  setIsEditing: (val: boolean) => void;
  loadLatestPerOpportunity: () => Promise<void>;
}

async function handleGenerateWinTheme(
  mode: GenerateMode,
  deps: GenerateDeps,
  options?: { blockerContext?: BlockerContextForWinTheme },
) {
  const {
    profile,
    selectedOpportunity,
    selectedWinTheme,
    setError,
    setGeneratingMode,
    setSelectedWinThemes,
    setSelectedWinTheme,
    setEditablePayload,
    setIsEditing,
    loadLatestPerOpportunity,
  } = deps;

  if (!profile?.id) {
    setError("You must be signed in to generate a Win Theme.");
    return;
  }
  if (!selectedOpportunity) {
    setError("Select an opportunity first to generate a Win Theme.");
    return;
  }
  if ((mode === "regenerate" || mode === "clone") && !selectedWinTheme) {
    setError("There is no existing Win Theme to regenerate or clone.");
    return;
  }

  try {
    setGeneratingMode(mode);
    setError(null);

    const body: Record<string, unknown> = {
      mode,
      opportunity: {
        id: selectedOpportunity.id,
        name: selectedOpportunity.name,
        project_reference: selectedOpportunity.project_reference,
        company_name: selectedOpportunity.company_name,
        company_number: selectedOpportunity.company_number,
      },
    };

    if (selectedWinTheme && (mode === "regenerate" || mode === "clone")) {
      (body as Record<string, unknown>).base = {
        summary: selectedWinTheme.summary,
        payload: selectedWinTheme.payload,
      };
    }

    if (options?.blockerContext) {
      (body as Record<string, unknown>).blocker_context = options.blockerContext;
    }

    const response = await fetch("/api/win-theme/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let message: string | null = null;

      try {
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const json = (await response.json()) as {
            error?: string;
            message?: string;
          };
          message = json.error ?? json.message ?? null;
        } else {
          const text = await response.text();
          if (text && !text.trim().startsWith("<")) {
            message = text;
          }
        }
      } catch {
        // ignore parsing errors and fall back to a generic message
      }

      setError(
        message ||
          "The Win Theme engine is currently unavailable or returned an unexpected response. Please try again in a few minutes.",
      );
      return;
    }

    const json = (await response.json()) as GenerateWinThemeResponse;

    const created = await createWinTheme({
      opportunity_id: selectedOpportunity.id,
      generated_by_user_id: profile.id as string,
      strategy_settings: (json.strategy_settings || {}) as unknown as any,
      payload: json.payload as unknown as any,
      summary: json.summary,
      contextBundle: (json.context_bundle || null) as WinThemeContextBundle | null,
    });

    const themes = await listWinThemesForOpportunity(selectedOpportunity.id);
    setSelectedWinThemes(themes);

    const latest = themes[0] ?? created;
    setSelectedWinTheme(latest);
    const parsed = parsePayload(latest.payload);
    setEditablePayload(parsed);
    setIsEditing(false);

    void loadLatestPerOpportunity();
  } catch {
    setError("Failed to generate Win Theme.");
  } finally {
    setGeneratingMode(null);
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parsePayload(payload: unknown): WinThemePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (
    typeof obj.executive_win_theme !== "string" ||
    typeof obj.client_context_insight !== "string" ||
    typeof obj.value_narrative !== "string"
  ) {
    return null;
  }
  return obj as unknown as WinThemePayload;
}

async function fetchOpportunitySummary(
  opportunityId: string,
): Promise<OpportunitySummary | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      `
        id,
        name,
        project_reference,
        companies:companies!opportunities_company_id_fkey(
          name,
          company_number
        )
      `,
    )
    .eq("id", opportunityId)
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to load opportunity for Win Theme workspace", {
      opportunityId,
      error,
    });
    return null;
  }

  const companyName =
    ((data as any).companies?.name as string | undefined) || null;
  const companyNumber =
    ((data as any).companies?.company_number as string | undefined) || null;

  return {
    id: data.id,
    name: data.name || "Unknown opportunity",
    project_reference: (data as any).project_reference ?? null,
    company_name: companyName,
    company_number: companyNumber,
  };
}

function WinThemePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [latestByOpportunity, setLatestByOpportunity] = useState<
    WinThemeWithJoinedOpportunity[]
  >([]);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<OpportunitySummary | null>(null);
  const [selectedWinThemes, setSelectedWinThemes] = useState<WinThemeRow[]>([]);
  const [selectedWinTheme, setSelectedWinTheme] =
    useState<WinThemeRow | null>(null);

  const [editablePayload, setEditablePayload] =
    useState<WinThemePayload | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [copyState, setCopyState] = useState<Partial<Record<CopyStateKey, boolean>>>(
    {},
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [generatingMode, setGeneratingMode] = useState<GenerateMode | null>(null);

  const [blockerMessages, setBlockerMessages] = useState<BlockerChatMessage[]>([]);
  const [blockerInput, setBlockerInput] = useState("");
  const [blockerLoading, setBlockerLoading] = useState(false);
  const [blockerError, setBlockerError] = useState<string | null>(null);

  const buildGenerateDeps = (): GenerateDeps => ({
    profile,
    selectedOpportunity,
    selectedWinTheme,
    setError,
    setGeneratingMode,
    setSelectedWinThemes,
    setSelectedWinTheme,
    setEditablePayload,
    setIsEditing,
    loadLatestPerOpportunity,
  });

  useEffect(() => {
    if (!profile) return;
    void loadLatestPerOpportunity();
  }, [profile]);

  const loadLatestPerOpportunity = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("win_themes")
        .select(
          `
          *,
          opportunity:opportunities!win_themes_opportunity_id_fkey(
            id,
            name,
            project_reference,
            companies:companies!opportunities_company_id_fkey(
              name
            )
          )
        `,
        )
        .order("generated_at", { ascending: false });

      if (queryError) {
        throw queryError;
      }

      const rows = (data || []) as unknown as WinThemeWithJoinedOpportunity[];

      const map = new Map<string, WinThemeWithJoinedOpportunity>();
      for (const row of rows) {
        if (!row.opportunity_id) continue;
        if (!map.has(row.opportunity_id)) {
          map.set(row.opportunity_id, row);
        }
      }

      const list = Array.from(map.values());
      setLatestByOpportunity(list);

      const opportunityIdFromQuery =
        typeof router.query.opportunity_id === "string"
          ? router.query.opportunity_id
          : undefined;

      if (opportunityIdFromQuery) {
        const match = list.find(
          (item) => item.opportunity_id === opportunityIdFromQuery,
        );
        if (match) {
          await handleSelectOpportunity(match);
        } else {
          const summary = await fetchOpportunitySummary(opportunityIdFromQuery);
          if (summary) {
            setSelectedOpportunity(summary);
            setSelectedWinThemes([]);
            setSelectedWinTheme(null);
            setEditablePayload(null);
            setIsEditing(false);
          }
        }
      } else if (list.length > 0) {
        await handleSelectOpportunity(list[0]);
      }

      setLoading(false);
    } catch (err) {
      setError("Failed to load Win Themes");
      setLoading(false);
    }
  };

  const handleSelectOpportunity = async (row: WinThemeWithJoinedOpportunity) => {
    if (!row.opportunity_id) return;

    setLoadingDetail(true);
    setError(null);
    setIsEditing(false);
    setEditablePayload(null);

    const summary: OpportunitySummary = {
      id: row.opportunity_id,
      name: row.opportunity?.name || "Unknown opportunity",
      project_reference: row.opportunity?.project_reference || null,
      company_name:
        ((row as any).opportunity?.companies?.name as string | undefined) || null,
      company_number:
        ((row as any).opportunity?.companies?.company_number as string | undefined) || null,
    };
    setSelectedOpportunity(summary);

    try {
      const themes = await listWinThemesForOpportunity(row.opportunity_id);
      setSelectedWinThemes(themes);

      if (themes.length > 0) {
        const latest = themes[0];
        setSelectedWinTheme(latest);
        const parsed = parsePayload(latest.payload);
        setEditablePayload(parsed);
      } else {
        setSelectedWinTheme(null);
        setEditablePayload(null);
      }
    } catch (err) {
      setError("Failed to load strategies for this opportunity");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelectWinTheme = (theme: WinThemeRow) => {
    setSelectedWinTheme(theme);
    const parsed = parsePayload(theme.payload);
    setEditablePayload(parsed);
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    if (!selectedWinTheme) return;
    const parsed = parsePayload(selectedWinTheme.payload);
    if (!parsed) {
      setError("Cannot edit this strategy because the payload is invalid");
      return;
    }
    setEditablePayload(parsed);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (!selectedWinTheme) {
      setIsEditing(false);
      setEditablePayload(null);
      return;
    }
    const parsed = parsePayload(selectedWinTheme.payload);
    setEditablePayload(parsed);
    setIsEditing(false);
  };

  const handleSaveEdits = async () => {
    if (!selectedWinTheme || !editablePayload) return;
    setSaving(true);
    setError(null);

    try {
      const summary = editablePayload.executive_win_theme;
      const updated = await updateWinTheme({
        id: selectedWinTheme.id,
        payload: editablePayload,
        summary,
      });

      const newList = selectedWinThemes.map((t) =>
        t.id === updated.id ? updated : t,
      );
      setSelectedWinThemes(newList);
      setSelectedWinTheme(updated);
      setIsEditing(false);
    } catch (err) {
      setError("Failed to save changes to this strategy");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (key: CopyStateKey, text: string | undefined) => {
    if (!text) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopyState((prev) => ({ ...prev, [key]: false }));
      }, 1500);
    } catch {
      setCopyState((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleBlockerSubmit = async () => {
    if (!selectedOpportunity || !blockerInput.trim()) {
      return;
    }

    const trimmed = blockerInput.trim();
    const newHistory: BlockerChatMessage[] = [
      ...blockerMessages,
      { role: "user", content: trimmed },
    ];

    setBlockerMessages(newHistory);
    setBlockerLoading(true);
    setBlockerError(null);

    try {
      const body = {
        opportunity: {
          id: selectedOpportunity.id,
          name: selectedOpportunity.name,
          project_reference: selectedOpportunity.project_reference,
          company_name: selectedOpportunity.company_name,
          company_number: selectedOpportunity.company_number,
        },
        blocker_description: trimmed,
        history: newHistory,
      };

      const response = await fetch("/api/win-theme/blocker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let message: string | null = null;

        try {
          const contentType = response.headers.get("content-type") ?? "";

          if (contentType.includes("application/json")) {
            const json = (await response.json()) as {
              error?: string;
              message?: string;
            };
            message = json.error ?? json.message ?? null;
          } else {
            const text = await response.text();
            if (text && !text.trim().startsWith("<")) {
              message = text;
            }
          }
        } catch {
          // ignore parsing errors and fall back to a generic message
        }

        setBlockerError(
          message ||
            "The blocker assistant is currently unavailable or returned an unexpected response. Please try again in a few minutes.",
        );
        return;
      }

      const json = (await response.json()) as BlockerApiResponse;

      const parts: string[] = [];
      if (json.analysis) {
        parts.push(json.analysis);
      }
      if (Array.isArray(json.suggestions) && json.suggestions.length > 0) {
        parts.push(
          "Suggestions:\n" + json.suggestions.map((s) => `- ${s}`).join("\n"),
        );
      }
      if (Array.isArray(json.questions) && json.questions.length > 0) {
        parts.push(
          "Questions to explore:\n" + json.questions.map((q) => `- ${q}`).join("\n"),
        );
      }

      const assistantText =
        parts.join("\n\n") ||
        "I was not able to generate specific suggestions this time. Try reframing the blocker or adding more detail.";

      setBlockerMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantText },
      ]);
      setBlockerInput("");
    } catch {
      setBlockerError(
        "Failed to get suggestions from the blocker assistant. Please try again.",
      );
    } finally {
      setBlockerLoading(false);
    }
  };

  const handleRegenerateFromBlocker = async () => {
    if (!selectedOpportunity) {
      setBlockerError(
        "Select an opportunity before regenerating the Win Theme.",
      );
      return;
    }
    if (!selectedWinTheme) {
      setBlockerError(
        "Generate an initial Win Theme first, then you can regenerate it from the blocker context.",
      );
      return;
    }

    const latestTyped = blockerInput.trim();
    const lastUserFromHistory =
      [...blockerMessages]
        .reverse()
        .find((m) => m.role === "user")?.content ?? "";

    const description = latestTyped || lastUserFromHistory;

    if (!description) {
      setBlockerError(
        "Add a short description of the blocker before regenerating the Win Theme.",
      );
      return;
    }

    setBlockerError(null);
    await handleGenerateWinTheme("regenerate", buildGenerateDeps(), {
      blockerContext: {
        latest_description: description,
        history: blockerMessages,
      },
    });
  };

  const filteredLatest = useMemo(() => {
    if (!searchTerm.trim()) return latestByOpportunity;
    const term = searchTerm.toLowerCase();
    return latestByOpportunity.filter((item) => {
      const opportunity = item.opportunity;
      const isActive =
        selectedOpportunity?.id === item.opportunity_id;
      const summaryText = item.summary || "";
      const dateLabel = formatDate(
        (item as any).generated_at || null,
      );
      const companyName =
        ((item as any).opportunity?.companies?.name as
          | string
          | undefined) || null;

      return (
        opportunity?.name?.toLowerCase().includes(term) ||
        companyName?.toLowerCase().includes(term) ||
        summaryText.toLowerCase().includes(term)
      );
    });
  }, [latestByOpportunity, searchTerm]);

  const currentPayload = useMemo(
    () => (selectedWinTheme ? parsePayload(selectedWinTheme.payload) : null),
    [selectedWinTheme],
  );

  const payloadToDisplay = isEditing ? editablePayload : currentPayload;

  const contextBundle: WinThemeContextBundle | null = selectedWinTheme
    ? (((selectedWinTheme as any).context_bundle ||
        null) as WinThemeContextBundle | null)
    : null;

  const companiesHouse = contextBundle?.companies_house ?? null;
  const braveContext = (contextBundle?.brave ?? null) as BraveContext | null;
  const hasBraveResults =
    !!braveContext &&
    Array.isArray(braveContext.results) &&
    braveContext.results.length > 0;

  const companiesHouseAddressLines: string[] | null =
    companiesHouse &&
    companiesHouse.registered_office_address &&
    typeof companiesHouse.registered_office_address === "object"
      ? (() => {
          const addr = companiesHouse
            .registered_office_address as Record<string, unknown>;
          const keys = [
            "address_line_1",
            "address_line_2",
            "locality",
            "region",
            "postal_code",
            "country",
          ];
          const parts: string[] = [];
          for (const key of keys) {
            const value = addr[key];
            if (typeof value === "string" && value.trim()) {
              parts.push(value.trim());
            }
          }
          return parts;
        })()
      : null;

  const handleDeleteCurrentWinTheme = async (): Promise<void> => {
    if (!selectedWinTheme) return;

    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this Win Theme? This cannot be undone.")
    ) {
      return;
    }

    try {
      setDeleting(true);
      await deleteWinTheme(selectedWinTheme.id);

      const remaining = selectedWinThemes.filter(
        (wt) => wt.id !== selectedWinTheme.id,
      );
      setSelectedWinThemes(remaining);

      const next = remaining[0] ?? null;
      setSelectedWinTheme(next);
      setEditablePayload(next ? parsePayload(next.payload) : null);
      setIsEditing(false);

      void loadLatestPerOpportunity();
    } catch (err) {
      console.error("Error deleting Win Theme", err);
      setError("Failed to delete this Win Theme.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <span className="relative inline-flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-500" />
                <ArrowRight className="w-3 h-3 text-amber-500 absolute" />
              </span>
              <span>Win Theme workspace</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Evidence-based bid and account strategies, per opportunity. This
              is the strategy behind the proposal, not the proposal itself.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-4 lg:gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Opportunities with Win Themes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-0">
              <Input
                placeholder="Filter by opportunity, company, or summary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-sm"
              />

              {loading && (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading Win Themes
                </div>
              )}

              {!loading && filteredLatest.length === 0 && (
                <p className="text-xs text-muted-foreground py-4">
                  No Win Themes found yet. Generate a strategy from an
                  opportunity to see it here.
                </p>
              )}

              {!loading && filteredLatest.length > 0 && (
                <ScrollArea className="max-h-[360px]">
                  <div className="space-y-3 px-1">
                    {filteredLatest.map((item) => {
                      const opportunity = item.opportunity;
                      const isActive =
                        selectedOpportunity?.id === item.opportunity_id;
                      const summaryText = item.summary || "";
                      const dateLabel = formatDate(
                        (item as any).generated_at || null,
                      );
                      const companyName =
                        ((item as any).opportunity?.companies?.name as
                          | string
                          | undefined) || null;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void handleSelectOpportunity(item)}
                          className={`relative w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition-colors ${
                            isActive
                              ? "border-amber-400 bg-accent/70"
                              : "border-transparent hover:bg-accent/60"
                          }`}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <h3 className="truncate text-sm font-semibold text-foreground">
                                  {opportunity?.name || "Unknown opportunity"}
                                </h3>
                              </div>
                              {opportunity?.project_reference && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {opportunity.project_reference}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                                {dateLabel}
                              </span>
                              {isActive && (
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                                  Latest
                                </span>
                              )}
                            </div>
                          </div>

                          {companyName && (
                            <span
                              className="mt-2 inline-flex w-full items-center justify-start rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground leading-snug break-words"
                            >
                              {companyName}
                            </span>
                          )}

                          {summaryText && (
                            <p className="mt-2 break-words text-xs text-muted-foreground">
                              {summaryText}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base flex flex-wrap items-center gap-2">
                      <span>Current Win Theme</span>
                      {selectedOpportunity && (
                        <Badge variant="outline" className="text-[11px]">
                          {selectedOpportunity.name}
                        </Badge>
                      )}
                    </CardTitle>
                    {selectedWinTheme && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Generated {formatDate(
                          (selectedWinTheme as any).generated_at || null,
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {selectedOpportunity && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            !!generatingMode || loadingDetail || loading
                          }
                          onClick={() =>
                            void handleGenerateWinTheme(
                              "generate",
                              buildGenerateDeps(),
                            )
                          }
                        >
                          {generatingMode === "generate" && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          {generatingMode === "generate"
                            ? "Generating"
                            : "Generate"}
                        </Button>
                        {selectedWinTheme && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!!generatingMode}
                              onClick={() =>
                                void handleGenerateWinTheme(
                                  "regenerate",
                                  buildGenerateDeps(),
                                )
                              }
                            >
                              {generatingMode === "regenerate" && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              {generatingMode === "regenerate"
                                ? "Regenerating"
                                : "Regenerate"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!!generatingMode}
                              onClick={() =>
                                void handleGenerateWinTheme(
                                  "clone",
                                  buildGenerateDeps(),
                                )
                              }
                            >
                              {generatingMode === "clone" && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              {generatingMode === "clone" ? "Cloning" : "Clone"}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {selectedWinTheme && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving || !!generatingMode}
                        onClick={
                          isEditing ? handleCancelEditing : handleStartEditing
                        }
                      >
                        {isEditing ? "Cancel edits" : "Edit strategy"}
                      </Button>
                    )}
                    {isEditing && selectedWinTheme && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving || !!generatingMode}
                        onClick={() => void handleSaveEdits()}
                      >
                        {saving && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Save changes
                      </Button>
                    )}
                    {selectedWinTheme && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deleting || !!generatingMode || saving}
                        onClick={() => void handleDeleteCurrentWinTheme()}
                      >
                        {deleting && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {deleting ? "Deleting" : "Delete"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDetail && (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading strategy
                  </div>
                )}

                {!loadingDetail &&
                  !selectedWinTheme &&
                  !selectedOpportunity && (
                    <p className="text-sm text-muted-foreground">
                      Select an opportunity with a Win Theme on the left to see
                      the full strategy.
                    </p>
                  )}

                {!loadingDetail &&
                  !selectedWinTheme &&
                  selectedOpportunity && (
                    <p className="text-sm text-muted-foreground">
                      No Win Theme generated yet for this opportunity. Use the{" "}
                      <span className="font-medium">Generate</span> button above
                      to create the first strategy.
                    </p>
                  )}

                {!loadingDetail &&
                  selectedWinTheme &&
                  payloadToDisplay && (
                    <Tabs defaultValue="overview" className="space-y-4">
                      <TabsList className="w-full justify-start overflow-x-auto">
                        <TabsTrigger value="overview" className="text-xs">
                          Overview
                        </TabsTrigger>
                        <TabsTrigger value="moves" className="text-xs">
                          Key moves
                        </TabsTrigger>
                        <TabsTrigger value="risks" className="text-xs">
                          Risks
                        </TabsTrigger>
                        <TabsTrigger value="proposal" className="text-xs">
                          Proposal
                        </TabsTrigger>
                        <TabsTrigger value="stakeholders" className="text-xs">
                          Stakeholders
                        </TabsTrigger>
                        <TabsTrigger value="talk_tracks" className="text-xs">
                          Talk tracks
                        </TabsTrigger>
                        <TabsTrigger value="gaps" className="text-xs">
                          Gaps
                        </TabsTrigger>
                        <TabsTrigger value="blocker" className="text-xs">
                          Blocker
                        </TabsTrigger>
                        <TabsTrigger value="sources" className="text-xs">
                          Sources
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview" className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              Executive Win Theme
                            </h3>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                void handleCopy(
                                  "executive",
                                  payloadToDisplay.executive_win_theme,
                                )
                              }
                            >
                              {copyState.executive ? (
                                <ClipboardCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Clipboard className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                          {isEditing ? (
                            <Textarea
                              rows={3}
                              value={editablePayload?.executive_win_theme || ""}
                              onChange={(e) =>
                                setEditablePayload((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        executive_win_theme: e.target.value,
                                      }
                                    : prev,
                                )
                              }
                            />
                          ) : (
                            <p className="text-sm leading-relaxed">
                              {payloadToDisplay.executive_win_theme}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold">
                            Client context insight
                          </h3>
                          {isEditing ? (
                            <Textarea
                              rows={3}
                              value={editablePayload?.client_context_insight || ""}
                              onChange={(e) =>
                                setEditablePayload((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        client_context_insight: e.target.value,
                                      }
                                    : prev,
                                )
                              }
                            />
                          ) : (
                            <p className="text-sm leading-relaxed">
                              {payloadToDisplay.client_context_insight}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              Value narrative
                            </h3>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                void handleCopy(
                                  "value_narrative",
                                  payloadToDisplay.value_narrative,
                                )
                              }
                            >
                              {copyState.value_narrative ? (
                                <ClipboardCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Clipboard className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                          {isEditing ? (
                            <Textarea
                              rows={3}
                              value={editablePayload?.value_narrative || ""}
                              onChange={(e) =>
                                setEditablePayload((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        value_narrative: e.target.value,
                                      }
                                    : prev,
                                )
                              }
                            />
                          ) : (
                            <p className="text-sm leading-relaxed">
                              {payloadToDisplay.value_narrative}
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="moves" className="space-y-3">
                        <h3 className="text-sm font-semibold">
                          Key moves and actions
                        </h3>
                        {payloadToDisplay.key_moves.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No key moves defined.
                          </p>
                        )}
                        {payloadToDisplay.key_moves.length > 0 && (
                          <div className="space-y-3">
                            {payloadToDisplay.key_moves.map((move, index) => (
                              <div
                                key={`${move.title}-${index}`}
                                className="rounded-md border px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                  <span className="text-sm font-medium">
                                    {move.title}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    {move.timeframe && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-5"
                                      >
                                        {move.timeframe}
                                      </Badge>
                                    )}
                                    {move.owner_hint && (
                                      <span>{move.owner_hint}</span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {move.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="risks" className="space-y-3">
                        <h3 className="text-sm font-semibold">
                          Risks and objections
                        </h3>
                        {payloadToDisplay.risks_and_objections.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No risks captured. Treat this as a gap and challenge
                            the strategy.
                          </p>
                        )}
                        {payloadToDisplay.risks_and_objections.length > 0 && (
                          <div className="space-y-3">
                            {payloadToDisplay.risks_and_objections.map(
                              (riskItem, index) => (
                                <div
                                  key={`${riskItem.risk}-${index}`}
                                  className="rounded-md border px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <span className="text-sm font-medium">
                                      {riskItem.risk}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                      {riskItem.likelihood && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-5"
                                        >
                                          Likelihood: {riskItem.likelihood}
                                        </Badge>
                                      )}
                                      {riskItem.impact && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-5"
                                        >
                                          Impact: {riskItem.impact}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Mitigation:
                                  </p>
                                  <p className="text-xs leading-relaxed">
                                    {riskItem.mitigation_strategy}
                                  </p>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="proposal" className="space-y-3">
                        <h3 className="text-sm font-semibold">
                          Proposal architecture
                        </h3>
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground">
                            Recommended structure
                          </h4>
                          {isEditing ? (
                            <Textarea
                              rows={3}
                              value={
                                editablePayload?.proposal_architecture
                                  .recommended_structure || ""
                              }
                              onChange={(e) =>
                                setEditablePayload((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        proposal_architecture: {
                                          ...prev.proposal_architecture,
                                          recommended_structure: e.target.value,
                                        },
                                      }
                                    : prev,
                                )
                              }
                            />
                          ) : (
                            <p className="text-sm leading-relaxed">
                              {
                                payloadToDisplay.proposal_architecture
                                  .recommended_structure
                              }
                            </p>
                          )}
                        </div>

                        {payloadToDisplay.proposal_architecture
                          .must_hit_messages &&
                          payloadToDisplay.proposal_architecture
                            .must_hit_messages.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-medium text-muted-foreground">
                                Must-hit messages
                              </h4>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {payloadToDisplay.proposal_architecture.must_hit_messages.map(
                                  (message, index) => (
                                    <li key={`${message}-${index}`}>
                                      {message}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}

                        {payloadToDisplay.proposal_architecture
                          .evidence_to_show &&
                          payloadToDisplay.proposal_architecture
                            .evidence_to_show.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-medium text-muted-foreground">
                                Evidence to show
                              </h4>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {payloadToDisplay.proposal_architecture.evidence_to_show.map(
                                  (evidence, index) => (
                                    <li key={`${evidence}-${index}`}>{evidence}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                      </TabsContent>

                      <TabsContent value="stakeholders" className="space-y-3">
                        <h3 className="text-sm font-semibold">
                          Stakeholder strategy
                        </h3>
                        {payloadToDisplay.stakeholder_strategy?.key_stakeholder_groups &&
                          payloadToDisplay.stakeholder_strategy
                            .key_stakeholder_groups.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-medium text-muted-foreground">
                                Key stakeholder groups
                              </h4>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {payloadToDisplay.stakeholder_strategy.key_stakeholder_groups.map(
                                  (group, index) => (
                                    <li key={`${group}-${index}`}>{group}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}

                        {payloadToDisplay.stakeholder_strategy?.engagement_tactics &&
                          payloadToDisplay.stakeholder_strategy
                            .engagement_tactics.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-medium text-muted-foreground">
                                Engagement tactics
                              </h4>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {payloadToDisplay.stakeholder_strategy.engagement_tactics.map(
                                  (tactic, index) => (
                                    <li key={`${tactic}-${index}`}>{tactic}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}

                        {!payloadToDisplay.stakeholder_strategy && (
                          <p className="text-sm text-muted-foreground">
                            No explicit stakeholder strategy captured. Treat
                            this as a gap for refinement.
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="talk_tracks" className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">
                            Talk tracks and openers
                          </h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              void handleCopy(
                                "talk_tracks",
                                payloadToDisplay.talk_tracks_and_openers
                                  ?.meeting_openers?.join("\n") ||
                                  payloadToDisplay.talk_tracks_and_openers?.email_hook_paragraph,
                              )
                            }
                          >
                            {copyState.talk_tracks ? (
                              <ClipboardCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Clipboard className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>

                        {payloadToDisplay.talk_tracks_and_openers
                          ?.meeting_openers &&
                          payloadToDisplay.talk_tracks_and_openers
                            .meeting_openers.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-medium text-muted-foreground">
                                Meeting openers
                              </h4>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {payloadToDisplay.talk_tracks_and_openers.meeting_openers.map(
                                  (opener, index) => (
                                    <li key={`${opener}-${index}`}>{opener}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}

                        {payloadToDisplay.talk_tracks_and_openers
                          ?.email_subject_ideas &&
                          payloadToDisplay.talk_tracks_and_openers
                            .email_subject_ideas.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-medium text-muted-foreground">
                                Email subject ideas
                              </h4>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                {payloadToDisplay.talk_tracks_and_openers.email_subject_ideas.map(
                                  (subject, index) => (
                                    <li key={`${subject}-${index}`}>{subject}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-medium text-muted-foreground">
                              Email hook paragraph
                            </h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                void handleCopy(
                                  "email_hook",
                                  payloadToDisplay.talk_tracks_and_openers
                                    ?.email_hook_paragraph,
                                )
                              }
                            >
                              {copyState.email_hook ? (
                                <ClipboardCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Clipboard className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                          {isEditing ? (
                            <Textarea
                              rows={3}
                              value={
                                editablePayload?.talk_tracks_and_openers
                                  ?.email_hook_paragraph || ""
                              }
                              onChange={(e) =>
                                setEditablePayload((prev) => {
                                  if (!prev) return prev;
                                  const currentTalkTracks =
                                    prev.talk_tracks_and_openers || {};
                                  return {
                                    ...prev,
                                    talk_tracks_and_openers: {
                                      ...currentTalkTracks,
                                      email_hook_paragraph: e.target.value,
                                    },
                                  };
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm leading-relaxed">
                              {payloadToDisplay.talk_tracks_and_openers
                                ?.email_hook_paragraph || (
                                <span className="text-muted-foreground">
                                  No email hook paragraph captured.
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="gaps" className="space-y-3">
                        <h3 className="text-sm font-semibold">
                          Gaps and unknowns
                        </h3>
                        {payloadToDisplay.gaps_and_unknowns.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No explicit gaps captured. Assume this is
                            incomplete, not perfect, and challenge it.
                          </p>
                        )}
                        {payloadToDisplay.gaps_and_unknowns.length > 0 && (
                          <ul className="list-disc pl-4 text-sm space-y-1">
                            {payloadToDisplay.gaps_and_unknowns.map(
                              (gap, index) => (
                                <li key={`${gap}-${index}`}>{gap}</li>
                              ),
                            )}
                          </ul>
                        )}
                      </TabsContent>

                      <TabsContent value="blocker" className="space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">Blocker assistant</h3>
                            <p className="text-xs text-muted-foreground">
                              Describe what seems to be blocking this win. The assistant
                              will suggest ways to respond, using web context where
                              available.
                            </p>
                          </div>
                        </div>

                        {!selectedOpportunity && (
                          <p className="text-sm text-muted-foreground">
                            Select an opportunity to discuss a blocker.
                          </p>
                        )}

                        {selectedOpportunity && (
                          <div className="space-y-3">
                            {blockerError && (
                              <Alert variant="destructive">
                                <AlertDescription>{blockerError}</AlertDescription>
                              </Alert>
                            )}

                            <div className="h-40 md:h-52 border rounded-md bg-muted/40 px-3 py-2 overflow-y-auto text-xs space-y-2">
                              {blockerMessages.length === 0 && (
                                <p className="text-muted-foreground">
                                  Start by describing the blocker in your own words. For
                                  example: &quot;Client is fixated on price despite
                                  framework quality weightings&quot; or &quot;We have a
                                  perceived capability gap against the incumbent&quot;.
                                </p>
                              )}

                              {blockerMessages.map((msg, index) => (
                                <div
                                  key={`${msg.role}-${index}`}
                                  className={
                                    msg.role === "assistant"
                                      ? "text-foreground"
                                      : "text-muted-foreground"
                                  }
                                >
                                  <p className="font-medium">
                                    {msg.role === "assistant" ? "Assistant" : "You"}
                                  </p>
                                  <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                              ))}

                              {blockerLoading && (
                                <p className="text-muted-foreground">
                                  Thinking about this blocker...
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Textarea
                                rows={3}
                                placeholder="Describe the blocker or concern that is making this opportunity hard to win."
                                value={blockerInput}
                                onChange={(e) => setBlockerInput(e.target.value)}
                              />
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] text-muted-foreground">
                                  Your description and the assistant’s replies are not
                                  stored as part of the Win Theme.
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                      blockerLoading ||
                                      !selectedOpportunity ||
                                      (!blockerInput.trim() && blockerMessages.length === 0) ||
                                      !!generatingMode
                                    }
                                    onClick={() => void handleRegenerateFromBlocker()}
                                  >
                                    Use to regenerate Win Theme
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={
                                      blockerLoading ||
                                      !selectedOpportunity ||
                                      !blockerInput.trim()
                                    }
                                    onClick={() => void handleBlockerSubmit()}
                                  >
                                    {blockerLoading && (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    )}
                                    Get suggestions
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="sources" className="space-y-3">
                        <h3 className="text-sm font-semibold">Sources and context</h3>

                        {companiesHouse && !companiesHouse.error && (
                          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">
                                  {companiesHouse.company_name ?? "Companies House profile"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {companiesHouse.company_number && (
                                    <span>Company no. {companiesHouse.company_number}</span>
                                  )}
                                </p>
                                {companiesHouse.company_status && (
                                  <p className="text-xs text-muted-foreground">
                                    Status: {companiesHouse.company_status}
                                  </p>
                                )}
                                {companiesHouse.date_of_creation && (
                                  <p className="text-xs text-muted-foreground">
                                    Incorporated on{" "}
                                    {new Date(companiesHouse.date_of_creation).toLocaleDateString(
                                      "en-GB",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )}
                                  </p>
                                )}
                              </div>
                              {companiesHouse.company_status && (
                                <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-200">
                                  {companiesHouse.company_status}
                                </span>
                              )}
                            </div>

                            {companiesHouseAddressLines && (
                              <div className="text-xs text-muted-foreground">
                                <p className="font-semibold">Registered office</p>
                                <p>{companiesHouseAddressLines.join(", ")}</p>
                              </div>
                            )}

                            {companiesHouse.sic_codes &&
                              companiesHouse.sic_codes.length > 0 && (
                                <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                  {companiesHouse.sic_codes.map((code) => (
                                    <span
                                      key={code}
                                      className="rounded-full bg-background/60 px-1.5 py-0.5"
                                    >
                                      SIC {code}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                        )}

                        {companiesHouse?.error && (
                          <p className="text-sm text-muted-foreground">
                            Companies House data could not be loaded for this Win Theme
                            {companiesHouse.status
                              ? ` (status ${companiesHouse.status}).`
                              : "."}{" "}
                            It was generated using the information available in Conexa for this opportunity.
                          </p>
                        )}

                        {hasBraveResults && (
                          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">Web context (Brave search)</p>
                                <p className="text-xs text-muted-foreground">
                                  Query used:{" "}
                                  <span className="font-mono">
                                    {braveContext?.query ?? "n/a"}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {braveContext?.results.slice(0, 5).map((item) => (
                                <div key={item.url} className="space-y-1">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-medium text-primary underline-offset-2 hover:underline break-all"
                                  >
                                    {item.title || item.url}
                                  </a>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!companiesHouse && !hasBraveResults && (
                          <p className="text-sm text-muted-foreground">
                            No external data (Companies House or web search) is stored for this Win Theme yet.
                            It was generated using the information available in Conexa for this opportunity.
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}

                {!loadingDetail &&
                  selectedWinTheme &&
                  !payloadToDisplay && (
                    <p className="text-sm text-destructive">
                      The stored strategy payload is not in the expected
                      structure. Regenerate this Win Theme when the engine is
                      available.
                    </p>
                  )}
              </CardContent>
            </Card>

            {selectedWinThemes.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    Strategy history for this opportunity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[160px] pr-2">
                    <div className="space-y-2">
                      {selectedWinThemes.map((theme) => {
                        const isActive = selectedWinTheme?.id === theme.id;
                        const dateLabel = formatDate(
                          (theme as any).generated_at || null,
                        );
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => handleSelectWinTheme(theme)}
                            className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                              isActive
                                ? "border-amber-500 bg-amber-500/10"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                {theme.summary ||
                                  "Strategy without explicit summary"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {dateLabel}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default WinThemePage;