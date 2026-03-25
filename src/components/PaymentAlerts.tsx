import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { differenceInDays, format, parseISO, endOfMonth, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);

interface PaymentAlert {
  id: string;
  invoiceNumber: string;
  clientName: string;
  projectName: string;
  projectId: string;
  amount: number;
  dueDate: Date;
  projectOwnerName: string;
  projectOwnerId: string;
  daysUntilDue: number;
  isOverdue: boolean;
  source: "manual" | "system";
  severity: "high" | "medium" | "low";
  daysOverdue: number;
}

interface PaymentAlertsProps {
  userRole: string;
  onViewProject?: (projectId: string) => void;
}

const severityStyles: Record<PaymentAlert["severity"], string> = {
  high: "border-destructive/60 bg-destructive/5",
  medium: "border-amber-400/60 bg-amber-50",
  low: "border-muted/60 bg-muted/40",
};

const statusBadgeStyles: Record<PaymentAlert["severity"], string> = {
  high: "bg-destructive/10 text-destructive-foreground border border-destructive/40",
  medium: "bg-amber-100 text-amber-800 border border-amber-300",
  low: "bg-muted text-foreground border border-muted/60",
};

export function PaymentAlerts({ userRole, onViewProject }: PaymentAlertsProps) {
  const [alerts, setAlerts] = useState<PaymentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isAuthorized = userRole === "admin" || userRole === "director";

  useEffect(() => {
    if (isAuthorized) {
      fetchPaymentAlerts();
    }
  }, [isAuthorized]);

  async function fetchPaymentAlerts() {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const allAlerts: PaymentAlert[] = [];

      // Fetch manual invoices from invoice_history
      const { data: manualInvoices, error: manualError } = await supabase
        .from("invoice_history")
        .select(`
          id,
          invoice_number,
          client_name,
          project_name,
          net_amount,
          vat_amount,
          due_date,
          status,
          project_id,
          projects (
            id,
            name,
            added_by_user_id,
            profiles:added_by_user_id (
              full_name
            )
          )
        `)
        .in("status", ["unpaid", "part_paid"])
        .order("due_date", { ascending: true });

      if (manualError) throw manualError;

      // Process manual invoices
      (manualInvoices || []).forEach((invoice: any) => {
        const dueDate = parseISO(invoice.due_date);
        const daysUntilDue = differenceInDays(dueDate, today);

        // Only include if due within 7 days or overdue
        if (daysUntilDue <= 7) {
          const isOverdue = daysUntilDue < 0;
          const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : 0;

          let severity: PaymentAlert["severity"];
          if (isOverdue) {
            severity = daysOverdue > 30 ? "high" : "medium";
          } else if (daysUntilDue <= 3) {
            severity = "medium";
          } else {
            severity = "low";
          }

          allAlerts.push({
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            clientName: invoice.client_name || "Unknown",
            projectName: invoice.project_name || "Unknown",
            projectId: invoice.project_id,
            amount: Number(invoice.net_amount),
            dueDate,
            projectOwnerName: invoice.projects?.profiles?.full_name || "Unknown",
            projectOwnerId: invoice.projects?.added_by_user_id || "",
            daysUntilDue,
            isOverdue,
            source: "manual",
            severity,
            daysOverdue,
          });
        }
      });

      // Fetch system-generated invoices
      const { data: systemInvoices, error: systemError } = await supabase
        .from("invoice_months")
        .select(`
          id,
          year,
          month,
          created_at,
          locked_at,
          invoice_items (
            id,
            invoice_value,
            invoice_reference,
            excluded_this_month,
            project_id,
            project_name,
            client_name,
            invoice_collections (
              due_date,
              collected_date
            ),
            projects (
              id,
              name,
              added_by_user_id,
              companies (
                payment_terms
              ),
              profiles:added_by_user_id (
                full_name
              )
            )
          )
        `)
        .eq("status", "locked")
        .order("created_at", { ascending: false });

      if (systemError) throw systemError;

      // Process system invoices
      (systemInvoices || []).forEach((month: any) => {
        const issueDate = month.locked_at ? parseISO(month.locked_at) : parseISO(month.created_at);

        (month.invoice_items || []).forEach((item: any) => {
          if (!item.invoice_value || item.excluded_this_month) return;

          // Skip if already collected
          const collection = item.invoice_collections?.[0];
          if (collection?.collected_date) return;

          const company = item.projects?.companies;
          const paymentTerms = company?.payment_terms || 30;
          
          let dueDate: Date;
          if (collection?.due_date) {
            dueDate = parseISO(collection.due_date);
          } else {
            const monthEnd = endOfMonth(issueDate);
            dueDate = addDays(monthEnd, paymentTerms);
          }

          const daysUntilDue = differenceInDays(dueDate, today);

          // Only include if due within 7 days or overdue
          if (daysUntilDue <= 7) {
            const isOverdue = daysUntilDue < 0;
            const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : 0;

            let severity: PaymentAlert["severity"];
            if (isOverdue) {
              severity = daysOverdue > 30 ? "high" : "medium";
            } else if (daysUntilDue <= 3) {
              severity = "medium";
            } else {
              severity = "low";
            }
            
            const rawRef = item.invoice_reference;
            const invoiceNumber = (rawRef && rawRef.trim().length > 0) 
              ? rawRef.trim() 
              : `INV-${month.year}-${String(month.month).padStart(2, "0")}`;

            allAlerts.push({
              id: item.id,
              invoiceNumber: invoiceNumber,
              clientName: item.client_name || "Unknown",
              projectName: item.project_name || "Unknown",
              projectId: item.project_id,
              amount: Number(item.invoice_value),
              dueDate,
              projectOwnerName: item.projects?.profiles?.full_name || "Unknown",
              projectOwnerId: item.projects?.added_by_user_id || "",
              daysUntilDue,
              isOverdue,
              source: "system",
              severity,
              daysOverdue,
            });
          }
        });
      });

      // Sort: overdue first (most overdue), then by days until due
      allAlerts.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.daysUntilDue - b.daysUntilDue;
      });

      setAlerts(allAlerts);
    } catch (error) {
      console.error("Error fetching payment alerts:", error);
      toast({
        title: "Error",
        description: "Failed to load payment alerts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthorized) {
    return null;
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payment Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading payment alerts...</p>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Payment Alerts
            </CardTitle>
            <Link href="/invoicing/cashflow">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Cash Flow
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-sm text-green-800 font-medium">
              ✓ All payments are on track
            </p>
            <p className="text-xs text-green-700 mt-1">
              No overdue or upcoming payments within 7 days
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdueAlerts = alerts.filter((a) => a.isOverdue);
  const upcomingAlerts = alerts.filter((a) => !a.isOverdue);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Payment Alerts
        </CardTitle>
        {overdueAlerts.length > 0 && (
          <p className="text-sm text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Overdue Payments ({overdueAlerts.length})
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="text-sm text-muted-foreground">Loading payment alerts...</div>
        )}

        {!loading && overdueAlerts.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No overdue payments at the moment.
          </div>
        )}

        {!loading && overdueAlerts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueAlerts.map((alert) => (
              <div key={alert.id} className="h-full">
                <div
                  className={cn(
                    "relative flex flex-col justify-between rounded-lg border px-4 py-3 shadow-sm bg-card",
                    severityStyles[alert.severity]
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">
                        {alert.invoiceNumber}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          statusBadgeStyles[alert.severity]
                        )}
                      >
                        {alert.daysOverdue} days overdue
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border/60">
                        {alert.source === "manual" ? "Manual" : "System"}
                      </span>
                    </div>
                    <div className="text-right font-semibold text-foreground">
                      {formatCurrency(alert.amount)}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-sm font-semibold text-foreground">
                      {alert.clientName}
                      {alert.projectName && ` - ${alert.projectName}`}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Project Owner: {alert.projectOwnerName || "Unknown"}
                      {alert.dueDate && ` | Due: ${format(alert.dueDate, "d MMM yyyy")}`}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>{alert.daysOverdue} days overdue</span>
                    </div>
                    {alert.projectId && (
                      <Link
                        href={`/projects/${alert.projectId}`}
                        className="text-xs font-semibold text-primary hover:text-primary/80 underline-offset-2 hover:underline"
                      >
                        View Project
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}