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
import { format, addDays, startOfWeek, endOfWeek, addWeeks, isBefore, isAfter, isWithinInterval } from "date-fns";

interface InvoiceWithCollection {
  id: string;
  invoice_number: string;
  issue_date: string;
  total_amount: number;
  company_id: string;
  project_id: string;
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

function CashFlowContent() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceWithCollection[]>([]);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoicesAndCollections();
  }, []);

  useEffect(() => {
    if (invoices.length > 0) {
      organizeByWeeks();
    }
  }, [invoices]);

  const fetchInvoicesAndCollections = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all invoices with their collections
      const { data, error: fetchError } = await supabase
        .from("invoicing")
        .select(`
          *,
          companies!invoicing_company_id_fkey (name, payment_terms),
          projects!invoicing_project_id_fkey (project_name),
          invoice_collections (
            id,
            due_date,
            collected_date,
            collected_by_user_id
          )
        `)
        .order("issue_date", { ascending: true });

      if (fetchError) throw fetchError;

      // For invoices without collections, create them based on payment terms
      const invoicesWithCollections = await Promise.all(
        (data || []).map(async (invoice: any) => {
          if (!invoice.invoice_collections || invoice.invoice_collections.length === 0) {
            // Calculate due date based on payment terms
            const paymentTerms = invoice.companies?.payment_terms || 30;
            const dueDate = format(addDays(new Date(invoice.issue_date), paymentTerms), "yyyy-MM-dd");

            // Create collection record
            const { data: collectionData, error: collectionError } = await supabase
              .from("invoice_collections")
              .insert({
                invoicing_id: invoice.id,
                due_date: dueDate,
              })
              .select()
              .single();

            if (!collectionError && collectionData) {
              invoice.invoice_collections = [collectionData];
            }
          }
          return invoice as InvoiceWithCollection;
        })
      );

      setInvoices(invoicesWithCollections);
    } catch (err) {
      console.error("Failed to load cash flow data", err);
      setError("Failed to load cash flow data");
    } finally {
      setLoading(false);
    }
  };

  const organizeByWeeks = () => {
    const today = new Date();
    const weeksData: WeekData[] = [];

    // Generate 12 weeks of data (3 months)
    for (let i = 0; i < 12; i++) {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 }); // Sunday

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

  const handleMarkCollected = async (invoiceId: string, collectionId: string) => {
    if (!profile) return;

    try {
      const { error: updateError } = await supabase
        .from("invoice_collections")
        .update({
          collected_date: format(new Date(), "yyyy-MM-dd"),
          collected_by_user_id: profile.id,
        })
        .eq("id", collectionId);

      if (updateError) throw updateError;

      await fetchInvoicesAndCollections();
    } catch (err) {
      console.error("Failed to mark as collected", err);
      alert("Failed to mark as collected");
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cash Flow Forecast</h1>
          <p className="text-slate-600 mt-1">Track expected collections and payment status</p>
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
                                  Terms: {invoice.companies?.payment_terms || 30} days
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <div className="font-semibold text-lg">{formatCurrency(invoice.total_amount)}</div>
                                {!isCollected && collection && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkCollected(invoice.id, collection.id)}
                                    className="gap-1"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Mark Collected
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