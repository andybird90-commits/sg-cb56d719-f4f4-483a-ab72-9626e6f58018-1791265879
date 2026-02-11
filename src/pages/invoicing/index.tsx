import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { invoicingService } from "@/services/invoicingService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, Lock, LockOpen, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

type InvoiceMonth = {
  id: string;
  year: number;
  month: number;
  status: "open" | "locked";
  locked_by: string | null;
  locked_at: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceItem = {
  id: string;
  invoice_month_id: string;
  project_id: string;
  project_name: string;
  project_code: string;
  client_name: string;
  invoice_value: number | null;
  po_number: string | null;
  description: string;
  excluded_this_month: boolean;
  invoice_reference: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function InvoicingPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  
  const [invoiceMonth, setInvoiceMonth] = useState<InvoiceMonth | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());

  const canEdit = profile?.role === "admin" || profile?.role === "director";
  const isLocked = invoiceMonth?.status === "locked";

  useEffect(() => {
    console.log("Auth state:", { user: !!user, profile, canEdit });
    if (user !== null) {
      // User state is determined (either logged in or not)
      if (profile !== undefined) {
        // Profile has loaded (could be null or an object)
        setProfileLoading(false);
      }
    }
  }, [user, profile, canEdit]);

  useEffect(() => {
    if (!profileLoading) {
      loadInvoiceData();
    }
  }, [selectedYear, selectedMonth, profileLoading]);

  async function loadInvoiceData() {
    try {
      setLoading(true);
      console.log("Loading invoice data for:", selectedYear, selectedMonth);
      const month = await invoicingService.getOrCreateInvoiceMonth(selectedYear, selectedMonth);
      console.log("Invoice month result:", month);
      // Ensure status is typed correctly when setting state
      if (month) {
        setInvoiceMonth(month as InvoiceMonth);
        const items = await invoicingService.getInvoiceItems(month.id);
        setInvoiceItems(items);
      } else {
        setInvoiceMonth(null);
        setInvoiceItems([]);
      }
    } catch (error) {
      console.error("Error loading invoice data:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMonth() {
    try {
      setLoading(true);
      const month = await invoicingService.createInvoiceMonth(selectedYear, selectedMonth);
      setInvoiceMonth(month as InvoiceMonth);
      
      const items = await invoicingService.getInvoiceItems(month.id);
      setInvoiceItems(items);

      toast({
        title: "Success",
        description: `Invoice period created for ${MONTHS[selectedMonth - 1]} ${selectedYear}`,
      });
    } catch (error) {
      console.error("Error creating invoice month:", error);
      toast({
        title: "Error",
        description: "Failed to create invoice period",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateItem(
    itemId: string,
    field: "invoice_value" | "description" | "excluded_this_month",
    value: number | string | boolean | null
  ) {
    try {
      setEditingItems((prev) => new Set(prev).add(itemId));

      const updates: any = {};
      if (field === "description") {
        updates.description = value as string;
      } else if (field === "excluded_this_month") {
        updates.excluded_this_month = value as boolean;
      }
      // Note: invoice_value is now read-only from phasing data and cannot be edited here

      await invoicingService.updateInvoiceItem(itemId, updates);

      setInvoiceItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, ...updates, updated_at: new Date().toISOString() }
            : item
        )
      );

      toast({
        title: "Saved",
        description: "Invoice item updated",
      });
    } catch (error) {
      console.error("Error updating invoice item:", error);
      toast({
        title: "Error",
        description: "Failed to update invoice item",
        variant: "destructive",
      });
    } finally {
      setEditingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  async function handleLockMonth() {
    if (!invoiceMonth) return;

    try {
      setLoading(true); // Show loading state while generating PDF

      // 1. Generate and Upload PDF first
      // We need fresh items state to ensure we capture latest edits
      const currentItems = await invoicingService.getInvoiceItems(invoiceMonth.id);
      const pdfUrl = await invoicingService.generateAndUploadPdf(invoiceMonth, currentItems);
      
      // 2. Save PDF URL
      await invoicingService.savePdfUrl(invoiceMonth.id, pdfUrl);

      // 3. Lock the month
      await invoicingService.lockInvoiceMonth(invoiceMonth.id);
      
      setInvoiceMonth({ 
        ...invoiceMonth, 
        status: "locked",
        pdf_url: pdfUrl 
      });
      setShowLockDialog(false);

      toast({
        title: "Success",
        description: "Invoice period locked and PDF generated successfully",
      });

    } catch (error) {
      console.error("Error locking invoice month:", error);
      toast({
        title: "Error",
        description: "Failed to lock invoice period. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleReopenMonth() {
    if (!invoiceMonth) return;

    try {
      await invoicingService.reopenInvoiceMonth(invoiceMonth.id);
      setInvoiceMonth({ ...invoiceMonth, status: "open", pdf_url: null });

      toast({
        title: "Success",
        description: "Invoice period reopened",
      });
    } catch (error) {
      console.error("Error reopening invoice month:", error);
      toast({
        title: "Error",
        description: "Failed to reopen invoice period",
        variant: "destructive",
      });
    }
  }

  async function handleDownloadPdf() {
    if (!invoiceMonth) return;

    try {
      setLoading(true);

      let pdfUrl = invoiceMonth.pdf_url;

      // If no PDF exists yet, generate it
      if (!pdfUrl) {
        const currentItems = await invoicingService.getInvoiceItems(invoiceMonth.id);
        pdfUrl = await invoicingService.generateAndUploadPdf(invoiceMonth, currentItems);
        await invoicingService.savePdfUrl(invoiceMonth.id, pdfUrl);
        setInvoiceMonth({ ...invoiceMonth, pdf_url: pdfUrl });
      }

      // Open PDF in new tab
      window.open(pdfUrl, "_blank");

      toast({
        title: "Success",
        description: "PDF opened in new tab",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleFinishInvoicing = async () => {
    if (!invoiceMonth) return;

    try {
      await invoicingService.lockInvoiceMonth(invoiceMonth.id);
      
      toast({
        title: "Success",
        description: "Invoice month locked successfully.",
      });

      loadInvoiceData();
    } catch (error) {
      console.error("Error locking invoice month:", error);
      toast({
        title: "Error",
        description: "Failed to lock invoice month.",
        variant: "destructive",
      });
    }
  };

  const handleSyncProjects = async () => {
    if (!invoiceMonth) return;

    try {
      await invoicingService.populateInvoiceItems(invoiceMonth.id);
      
      toast({
        title: "Success",
        description: "Invoice items synced from live projects.",
      });

      loadInvoiceData();
    } catch (error) {
      console.error("Error syncing projects:", error);
      toast({
        title: "Error",
        description: "Failed to sync projects.",
        variant: "destructive",
      });
    }
  };

  const includedItems = invoiceItems.filter(
    (item) => !item.excluded_this_month && item.invoice_value !== null
  );
  const totalValue = includedItems.reduce(
    (sum, item) => sum + (item.invoice_value || 0),
    0
  );

  // Debug logging
  console.log("📊 Invoice Items Debug:", {
    totalItems: invoiceItems.length,
    includedItems: includedItems.length,
    excludedItems: invoiceItems.filter(i => i.excluded_this_month).length,
    nullValueItems: invoiceItems.filter(i => i.invoice_value === null).length,
    calculatedTotal: totalValue,
    itemBreakdown: includedItems.map(i => ({
      project: i.project_name,
      value: i.invoice_value,
      excluded: i.excluded_this_month
    }))
  });

  const allIncludedItemsValid = includedItems.every(
    (item) => item.invoice_value && item.invoice_value > 0 && item.description?.trim()
  );

  const years = Array.from({ length: 10 }, (_, i) => currentDate.getFullYear() - 2 + i);

  if (loading || profileLoading) {
    return (
      <RequireAuth>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <p className="text-lg">Loading invoice data...</p>
          </div>
        </Layout>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Invoicing</h1>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
            <div className="flex items-center gap-2">
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {invoiceMonth && (
              <Badge variant={isLocked ? "default" : "secondary"} className="ml-auto">
                {isLocked ? (
                  <>
                    <Lock className="w-3 h-3 mr-1" />
                    LOCKED
                  </>
                ) : (
                  <>
                    <LockOpen className="w-3 h-3 mr-1" />
                    OPEN
                  </>
                )}
              </Badge>
            )}

            {!invoiceMonth && canEdit && (
              <Button onClick={handleCreateMonth} className="ml-auto">
                <Plus className="w-4 h-4 mr-2" />
                Create Month
              </Button>
            )}
          </div>

          {/* Status Message */}
          {!invoiceMonth ? (
            <div className="p-8 text-center bg-white rounded-lg shadow">
              <p className="text-lg text-muted-foreground mb-4">
                No invoicing period created for {MONTHS[selectedMonth - 1]} {selectedYear} yet.
              </p>
              {canEdit ? (
                <Button onClick={handleCreateMonth} size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Create invoicing period for {MONTHS[selectedMonth - 1]} {selectedYear}
                </Button>
              ) : (
                <p className="text-sm text-red-600">
                  You need admin or director permissions to create invoice periods.
                  Your current role: {profile?.role || "unknown"}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Locked Message */}
              {isLocked && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    This billing period is locked. Values and descriptions cannot be edited.
                  </p>
                </div>
              )}

              {/* Invoice Items Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {invoiceItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-lg text-muted-foreground mb-2">
                      No active projects found for this billing period.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Invoice items are automatically created from active projects. 
                      Make sure you have projects with status "active" and they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Include
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Project
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Client
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            PO Number
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Invoice Value (from Monthly Phasing)
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Description
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Last Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {invoiceItems.map((item) => (
                          <tr key={item.id} className={item.excluded_this_month ? "opacity-50" : ""}>
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={!item.excluded_this_month}
                                disabled={!canEdit || isLocked}
                                onCheckedChange={(checked) =>
                                  handleUpdateItem(item.id, "excluded_this_month", !checked)
                                }
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/projects/${item.project_id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {item.project_code} - {item.project_name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm">{item.client_name}</td>
                            <td className="px-4 py-3 text-sm">
                              {item.po_number || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {item.invoice_value
                                    ? `£${item.invoice_value.toFixed(2)}`
                                    : "—"}
                                </span>
                                <span className="text-xs text-muted-foreground italic">
                                  (from phasing)
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {canEdit && !isLocked && !item.excluded_this_month ? (
                                <Textarea
                                  value={item.description || ""}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, "description", e.target.value)
                                  }
                                  className="min-h-[60px]"
                                  placeholder="What we're invoicing this month..."
                                />
                              ) : (
                                <span className="text-sm whitespace-pre-wrap">
                                  {item.description || "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(item.updated_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-6 border-t">
                <div className="text-lg font-semibold">
                  Total invoice value this month:{" "}
                  <span className="text-primary">
                    £{totalValue.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {invoiceMonth && (
                    <Button
                      onClick={handleDownloadPdf}
                      variant="outline"
                      disabled={loading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {loading ? "Generating..." : "Download PDF"}
                    </Button>
                  )}
                  
                  {canEdit && invoiceMonth.status === "locked" && (
                    <Button
                      onClick={handleReopenMonth}
                      variant="outline"
                    >
                      <LockOpen className="mr-2 h-4 w-4" />
                      Unlock Invoice
                    </Button>
                  )}
                  
                  {canEdit && invoiceMonth.status === "open" && (
                    <>
                      <Button
                        onClick={handleSyncProjects}
                        variant="outline"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Projects
                      </Button>
                      <Button
                        onClick={handleFinishInvoicing}
                        disabled={totalValue === 0}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Finish Invoicing for this Month
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Lock Confirmation Dialog */}
        <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Lock and finalise this billing period?</AlertDialogTitle>
              <AlertDialogDescription>
                This will lock all invoice values and descriptions for {MONTHS[selectedMonth - 1]}{" "}
                {selectedYear}. You will not be able to edit them unless an administrator reopens
                the period. You can still download the PDF summary at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLockMonth}>
                Yes, Finish Invoicing
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout>
    </RequireAuth>
  );
}