import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { differenceInDays, format, parseISO } from "date-fns";
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
  high: "border-destructive/70 bg-destructive/5",
  medium: "border-amber-500/60 bg-amber-500/5",
  low: "border-muted bg-muted/30",
};

const statusBadgeStyles: Record<PaymentAlert["severity"], string> = {
  high: "bg-destructive/80 text-destructive-foreground",
  medium: "bg-amber-500 text-slate-950",
  low: "bg-muted text-foreground",
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
          invoice_items (
            id,
            invoice_value,
            excluded_this_month,
            project_id,
            project_name,
            client_name,
            payment_terms,
            projects (
              id,
              name,
              added_by_user_id,
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
        const issueDate = parseISO(month.created_at);

        (month.invoice_items || []).forEach((item: any) => {
          if (!item.invoice_value || item.excluded_this_month) return;

          const paymentTerms = item.payment_terms || 30;
          const dueDate = new Date(issueDate);
          dueDate.setDate(dueDate.getDate() + paymentTerms);

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
              id: item.id,
              invoiceNumber: `INV-${month.year}-${String(month.month).padStart(
                2,
                "0"
              )}`,
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
      </Card>);

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
      </Card>);

  }

  const overdueAlerts = alerts.filter((a) => a.isOverdue);
  const upcomingAlerts = alerts.filter((a) => !a.isOverdue);

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payment Alerts
          </CardTitle>
          <Link href="/invoicing/cashflow">
            


            
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overdue Payments */}
        {overdueAlerts.length > 0 &&
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue Payments ({overdueAlerts.length})
            </h3>
            {overdueAlerts.map((alert) =>
          <Card
            key={alert.id}
            className={cn(
              "flex items-stretch justify-between gap-4 rounded-xl border px-5 py-4 md:px-6 md:py-4 bg-card/90 hover:bg-card transition-professional",
              severityStyles[alert.severity]
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-red-900">
                  {alert.invoiceNumber}
                </span>
                <Badge variant="destructive" className="text-xs">
                  {Math.abs(alert.daysUntilDue)} days overdue
                </Badge>
                {alert.source === "manual" &&
                <Badge variant="outline" className="text-xs">
                        Manual
                      </Badge>
                }
              </div>
              <p className="text-sm text-red-800">
                <span className="font-medium">{alert.clientName}</span> - {alert.projectName}
              </p>
              <p className="text-xs text-red-700 mt-1">
                Project Owner: {alert.projectOwnerName} | Due: {format(alert.dueDate, "dd MMM yyyy")}
              </p>
            </div>
            <div className="flex flex-col items-end justify-between gap-3 text-right">
              <div className="space-y-1">
                <div className="text-lg font-semibold text-foreground">
                  {formatCurrency(alert.amount)}
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-foreground underline-offset-4 hover:underline"
                  onClick={() => onViewProject?.(alert.projectId)}
                >
                  View Project
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span>{alert.daysOverdue} days overdue</span>
              </div>
            </div>
          </Card>
          )}
          </div>
        }

        {/* Upcoming Payments */}
        {upcomingAlerts.length > 0 &&
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-orange-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Due Within 7 Days ({upcomingAlerts.length})
            </h3>
            {upcomingAlerts.map((alert) =>
          <Card
            key={alert.id}
            className={cn(
              "flex items-stretch justify-between gap-4 rounded-xl border px-5 py-4 md:px-6 md:py-4 bg-card/90 hover:bg-card transition-professional",
              severityStyles[alert.severity]
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-orange-900">
                  {alert.invoiceNumber}
                </span>
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                  {alert.daysUntilDue} {alert.daysUntilDue === 1 ? "day" : "days"} until due
                </Badge>
                {alert.source === "manual" &&
                <Badge variant="outline" className="text-xs">
                        Manual
                      </Badge>
                }
              </div>
              <p className="text-sm text-orange-800">
                <span className="font-medium">{alert.clientName}</span> - {alert.projectName}
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Project Owner: {alert.projectOwnerName} | Due: {format(alert.dueDate, "dd MMM yyyy")}
              </p>
            </div>
            <div className="flex flex-col items-end justify-between gap-3 text-right">
              <div className="space-y-1">
                <div className="text-lg font-semibold text-foreground">
                  {formatCurrency(alert.amount)}
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-foreground underline-offset-4 hover:underline"
                  onClick={() => onViewProject?.(alert.projectId)}
                >
                  View Project
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span>{alert.daysOverdue} days overdue</span>
              </div>
            </div>
          </Card>
          )}
          </div>
        }
      </CardContent>
    </Card>);

}