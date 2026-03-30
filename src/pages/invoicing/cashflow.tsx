import { RequireAuth } from "@/components/RequireAuth";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, isBefore, isAfter, isWithinInterval, endOfMonth } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

interface InvoiceWithCollection {
  id: string;
  source?: "system" | "manual";
  invoice_number: string;
  issue_date: string;
  total_amount: number;
  company_id: string;
  project_id: string;
  effective_payment_terms: number;
  companies: {
    name: string;
    payment_terms: number | null;
  };
  projects: {
    project_name: string;
  };
  invoice_collections: {
    id: string;
    due_date: string;
    collected_date: string | null;
    collected_by_user_id: string | null;
  }[];
}

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  invoices: InvoiceWithCollection[];
  total: number;
  collected: number;
  outstanding: number;
}

type CashflowInvoiceSource = "system" | "manual";

interface CashflowInvoiceBase {
  id: string;
  source: CashflowInvoiceSource;
  companyName: string;
  projectName?: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  net: number;
  vat: number;
  gross: number;
  paid: number;
  outstanding: number;
}

type InvoiceItemRow = Tables<"invoice_items"> & {
  projects: Pick<Tables<"projects">, "name"> | null;
  companies: Pick<Tables<"companies">, "name"> | null;
};

function CashFlowContent() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceWithCollection[]>([]);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [markingInvoiceId, setMarkingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoicesAndCollections();
  }, []);

  useEffect(() => {
    if (invoices.length > 0) {
      organizeByWeeks();
    }
  }, [invoices, weekOffset]);

  const fetchInvoicesAndCollections = async (options: { silent?: boolean } = {}) => {
    const silent = options.silent === true;

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const { data: lockedMonths, error: lockedError } = await supabase
        .from("invoice_months")
        .select(
          `
          *,
          invoice_items (
            id,
            invoice_value,
            excluded_this_month,
            project_id,
            project_name,
            invoice_reference,
            invoice_collections (
              id,
              due_date,
              collected_date,
              collected_by_user_id
            ),
            projects (
              id,
              name,
              payment_terms,
              companies (
                id,
                name,
                payment_terms
              )
            )
          )
        `
        )
        .eq("status", "locked")
        .order("created_at", { ascending: false });

      if (lockedError) throw lockedError;

      const allInvoices: InvoiceWithCollection[] = [];

      if (lockedMonths && Array.isArray(lockedMonths)) {
        for (const month of lockedMonths as any[]) {
          const issueDate = month.locked_at
            ? new Date(month.locked_at as string)
            : new Date(month.created_at as string);

          const items = (month.invoice_items || []) as any[];

          for (const item of items) {
            if (!item.invoice_value || item.excluded_this_month) {
              continue;
            }

            const company = item.projects?.companies;
            const projectPaymentTerms = item.projects?.payment_terms;
            const companyPaymentTerms = company?.payment_terms;
            const paymentTerms = projectPaymentTerms ?? companyPaymentTerms ?? 30;
            
            const monthEnd = endOfMonth(issueDate);
            const dueDate = addDays(monthEnd, paymentTerms);

            const rawRef = (item.invoice_reference as string | null) || null;
            const trimmedRef =
              rawRef && rawRef.trim().length > 0 ? rawRef.trim() : null;
            const invoiceNumber =
              trimmedRef ??
              `INV-${month.year}-${String(month.month).padStart(2, "0")}`;

            let collection = item.invoice_collections?.[0];

            if (!collection) {
              const dueDateString = format(dueDate, "yyyy-MM-dd");

              const { data: newCollection, error: collectionError } =
                await supabase
                  .from("invoice_collections")
                  .insert({
                    invoice_month_id: month.id,
                    invoice_item_id: item.id,
                    due_date: dueDateString,
                  })
                  .select()
                  .single();

              if (!collectionError && newCollection) {
                collection = newCollection;
              }
            }

            allInvoices.push({
              id: item.id,
              source: "system",
              invoice_number: invoiceNumber,
              issue_date: format(issueDate, "yyyy-MM-dd"),
              total_amount: Number(item.invoice_value),
              company_id: item.projects?.client_company_id || "",
              project_id: item.project_id,
              effective_payment_terms: paymentTerms,
              companies: {
                name: company?.name || item.client_name,
                payment_terms: companyPaymentTerms || null,
              },
              projects: {
                project_name: item.project_name,
              },
              invoice_collections: collection
                ? [
                    {
                      id: collection.id,
                      due_date: collection.due_date,
                      collected_date: collection.collected_date,
                      collected_by_user_id: collection.collected_by_user_id,
                    },
                  ]
                : [],
            });
          }
        }
      }

      // Fetch Manual Intake Invoices
      const { data: manualInvoices, error: manualError } = await supabase
        .from("invoice_history")
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          net_amount,
          vat_amount,
          status,
          client_name,
          project_name,
          company_id,
          project_id,
          companies!invoice_history_company_id_fkey (
            name,
            payment_terms
          )
        `)
        .in("status", ["unpaid", "part_paid"]);

      if (!manualError && manualInvoices) {
        manualInvoices.forEach((inv: any) => {
          const gross = Number(inv.net_amount) + Number(inv.vat_amount || 0);
          allInvoices.push({
            id: inv.id,
            source: "manual",
            invoice_number: inv.invoice_number || "Unknown",
            issue_date: inv.invoice_date,
            total_amount: gross,
            company_id: inv.company_id || "",
            project_id: inv.project_id || "",
            effective_payment_terms: inv.companies?.payment_terms || 30, // For manuals, terms are generally pre-calculated on due_date
            companies: {
              name: inv.companies?.name || inv.client_name || "Unknown",
              payment_terms: inv.companies?.payment_terms || 30,
            },
            projects: {
              project_name: inv.project_name || "Unknown",
            },
            invoice_collections: [
              {
                id: inv.id, // Use invoice id as collection id for manual invoices
                due_date: inv.due_date,
                collected_date: null, // Because they are fetched as unpaid/part_paid
                collected_by_user_id: null,
              },
            ],
          });
        });
      } else if (manualError) {
        console.error("Failed to load manual invoices:", manualError);
      }

      setInvoices(allInvoices);
    } catch (err) {
      console.error("Failed to load cash flow data", err);
      setError("Failed to load cash flow data");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const organizeByWeeks = () => {
    const today = new Date();
    const weeksData: WeekData[] = [];

    // Generate 12 weeks of data based on the current weekOffset
    for (let i = 0; i < 12; i++) {
      const weekStart = startOfWeek(addWeeks(today, weekOffset + i), { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(addWeeks(today, weekOffset + i), { weekStartsOn: 1 }); // Sunday

      const weekInvoices = invoices.filter((invoice) => {
        const collection = invoice.invoice_collections?.[0];
        if (!collection?.due_date) return false;

        const dueDate = new Date(collection.due_date);
        return isWithinInterval(dueDate, { start: weekStart, end: weekEnd });
      });

      const total = weekInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const collected = weekInvoices
        .filter((inv) => inv.invoice_collections?.[0]?.collected_date)
        .reduce((sum, inv) => sum + inv.total_amount, 0);

      weeksData.push({
        weekStart,
        weekEnd,
        invoices: weekInvoices,
        total,
        collected,
        outstanding: total - collected,
      });
    }

    setWeeks(weeksData);
  };

  const handleMarkCollected = async (invoiceId: string, collectionId: string, source: "system" | "manual" = "system") => {
    try {
      setMarkingInvoiceId(invoiceId);

      if (source === "manual") {
        const { data: updatedRows, error: updateError } = await supabase
          .from("invoice_history")
          .update({
            status: "paid",
          })
          .eq("id", invoiceId)
          .select("id");

        if (updateError) throw updateError;

        if (!updatedRows || updatedRows.length === 0) {
          toast({
            title: "Not permitted",
            description: "Your account doesn't have permission to update this invoice.",
            variant: "destructive",
          });
          return;
        }
      } else {
        const { data: updatedRows, error: updateError } = await supabase
          .from("invoice_collections")
          .update({
            collected_date: format(new Date(), "yyyy-MM-dd"),
            collected_by_user_id: user?.id ?? profile?.id ?? null,
          })
          .eq("id", collectionId)
          .select("id");

        if (updateError) throw updateError;

        if (!updatedRows || updatedRows.length === 0) {
          toast({
            title: "Not permitted",
            description:
              "Your account doesn't have permission to mark invoices as collected. Ask an admin/director to update your role or adjust invoice collection permissions.",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: "Invoice marked as collected",
      });

      await fetchInvoicesAndCollections({ silent: true });
    } catch (err) {
      console.error("Failed to mark as collected", err);
      toast({
        title: "Error",
        description: "Failed to mark invoice as collected",
        variant: "destructive",
      });
    } finally {
      setMarkingInvoiceId(null);
    }
  };

  const getTotals = () => {
    const total = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const collected = invoices
      .filter((inv) => inv.invoice_collections?.[0]?.collected_date)
      .reduce((sum, inv) => sum + inv.total_amount, 0);
    
    const today = new Date();
    const overdue = invoices
      .filter((inv) => {
        const collection = inv.invoice_collections?.[0];
        if (!collection || collection.collected_date) return false;
        return isBefore(new Date(collection.due_date), today);
      })
      .reduce((sum, inv) => sum + inv.total_amount, 0);

    const inTerms = invoices
      .filter((inv) => {
        const collection = inv.invoice_collections?.[0];
        if (!collection || collection.collected_date) return false;
        return !isBefore(new Date(collection.due_date), today);
      })
      .reduce((sum, inv) => sum + inv.total_amount, 0);

    return { total, collected, overdue, inTerms, outstanding: total - collected };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const isOverdue = (dueDate: string, collectedDate: string | null) => {
    if (collectedDate) return false;
    return isBefore(new Date(dueDate), new Date());
  };

  const totals = getTotals();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cash Flow Forecast</h1>
            <p className="text-slate-600 mt-1">Track expected collections and payment status</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setWeekOffset(prev => prev - 4)}>
              &larr; Prev 4 Weeks
            </Button>
            <Button variant="outline" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
              Current
            </Button>
            <Button variant="outline" onClick={() => setWeekOffset(prev => prev + 4)}>
              Next 4 Weeks &rarr;
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.outstanding)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">In Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.inTerms)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.overdue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.collected)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-slate-600">Loading cash flow data...</div>
            </CardContent>
          </Card>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : weeks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-slate-600">No invoices to display</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {weeks.map((week, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-slate-600" />
                      <div>
                        <CardTitle className="text-lg">
                          W/C {format(week.weekStart, "dd MMM yyyy")}
                        </CardTitle>
                        <p className="text-sm text-slate-600">
                          {format(week.weekStart, "dd MMM")} - {format(week.weekEnd, "dd MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{formatCurrency(week.total)}</div>
                      <div className="text-sm text-slate-600">
                        Collected: {formatCurrency(week.collected)} | Outstanding: {formatCurrency(week.outstanding)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {week.invoices.length === 0 ? (
                    <div className="text-center py-4 text-slate-600">No invoices due this week</div>
                  ) : (
                    <div className="space-y-3">
                      {week.invoices.map((invoice) => {
                        const collection = invoice.invoice_collections?.[0];
                        const isCollected = !!collection?.collected_date;
                        const isLate = !isCollected && collection && isOverdue(collection.due_date, collection.collected_date);

                        return (
                          <div
                            key={invoice.id}
                            className={`p-4 border rounded-lg ${
                              isCollected ? "bg-green-50 border-green-200" : isLate ? "bg-red-50 border-red-200" : "bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-slate-900">{invoice.invoice_number}</span>
                                  {isCollected && (
                                    <Badge className="bg-green-100 text-green-800">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Collected
                                    </Badge>
                                  )}
                                  {isLate && (
                                    <Badge className="bg-red-100 text-red-800">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      Overdue
                                    </Badge>
                                  )}
                                  {!isCollected && !isLate && (
                                    <Badge variant="outline">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Pending
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-slate-600">
                                  {invoice.companies?.name} • {invoice.projects?.project_name}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Issue: {format(new Date(invoice.issue_date), "dd MMM yyyy")} • 
                                  Due: {collection ? format(new Date(collection.due_date), "dd MMM yyyy") : "—"} • 
                                  Terms: {invoice.effective_payment_terms} days
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <div className="font-semibold text-lg">{formatCurrency(invoice.total_amount)}</div>
                                {!isCollected && collection && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={markingInvoiceId === invoice.id}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void handleMarkCollected(
                                        invoice.id,
                                        collection.id,
                                        invoice.source || "system",
                                      );
                                    }}
                                    className="gap-1"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {markingInvoiceId === invoice.id ? "Marking..." : "Mark Collected"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function CashFlowPage() {
  return (
    <RequireAuth>
      <CashFlowContent />
    </RequireAuth>
  );
}