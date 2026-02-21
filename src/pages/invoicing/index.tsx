import { useState, useEffect, useRef } from "react";
import type { UIEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { invoicingService } from "@/services/invoicingService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Download, Lock, LockOpen, Plus, RefreshCw, Edit } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, addWeeks, isBefore, isAfter, isWithinInterval } from "date-fns";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
  accounts_email?: string | null;
  client_address?: string | null;
  enquiry_number?: string | null;
  project_reference?: string | null;
  project_owner_name?: string | null;
  payment_terms?: number | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ProjectForInvoicing {
  id: string;
  name: string;
  project_reference?: string;
  po_number?: string;
  client_company_id: string;
  opportunity_id?: string;
  companies?: {
    name: string;
    address?: string;
    accounts_email?: string;
    payment_terms?: number;
  };
  opportunities?: {
    enquiry_number?: string;
  };
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

export default function InvoicingPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  
  const [invoiceMonth, setInvoiceMonth] = useState<InvoiceMonth | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocking, setIsLocking] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());
  
  // Dialog state for editing description
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Cash Flow state
  const [cashFlowLoading, setCashFlowLoading] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    totalOutstanding: 0,
    inTerms: 0,
    overdue: 0,
    collected: 0,
    totalValue: 0
  });

  const [invoiceMonths, setInvoiceMonths] = useState<InvoiceMonth[]>([]);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  const isSyncingFromTopRef = useRef(false);
  const isSyncingFromBottomRef = useRef(false);

  const handleTopScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!bottomScrollRef.current) return;

    // If this scroll was triggered programmatically from the bottom handler, skip it
    if (isSyncingFromBottomRef.current) {
      isSyncingFromBottomRef.current = false;
      return;
    }

    const newScrollLeft = event.currentTarget.scrollLeft;
    isSyncingFromTopRef.current = true;
    bottomScrollRef.current.scrollLeft = newScrollLeft;
  };

  const handleBottomScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!topScrollRef.current) return;

    // If this scroll was triggered programmatically from the top handler, skip it
    if (isSyncingFromTopRef.current) {
      isSyncingFromTopRef.current = false;
      return;
    }

    const newScrollLeft = event.currentTarget.scrollLeft;
    isSyncingFromBottomRef.current = true;
    topScrollRef.current.scrollLeft = newScrollLeft;
  };

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

  const fetchCashFlowData = async () => {
    try {
      setCashFlowLoading(true);

      // Fetch locked invoice months with items
      const { data: lockedMonths, error: lockedError } = await supabase
        .from("invoice_months")
        .select(`
          *,
          invoice_items (
            id,
            invoice_value,
            excluded_this_month,
            project_id,
            project_name,
            projects (
              id,
              name,
              companies (
                id,
                name,
                payment_terms
              )
            )
          )
        `)
        .eq("status", "locked")
        .order("created_at", { ascending: false });

      if (lockedError) throw lockedError;

      // Fetch manual invoices from invoice_history
      const { data: manualInvoices, error: manualError } = await supabase
        .from("invoice_history")
        .select("*")
        .order("invoice_date", { ascending: false });

      if (manualError) throw manualError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Initialize week structure (next 12 weeks)
      const weeks: any[] = [];
      for (let i = 0; i < 12; i++) {
        const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        weeks.push({
          weekCommencing: weekStart,
          weekEnding: weekEnd,
          invoices: [],
          total: 0
        });
      }

      // Initialize totals
      let totalVal = 0;
      let totalCollected = 0;
      let totalOut = 0;
      let totalOverdue = 0;
      let totalInTerms = 0;

      const allInvoices: any[] = [];

      // Process system-generated invoices
      (lockedMonths || []).forEach((month) => {
        const issueDate = new Date(month.created_at);
        
        (month.invoice_items || []).forEach((item: any) => {
          if (!item.invoice_value || item.excluded_this_month) return;
          
          const company = item.projects?.companies;
          const paymentTerms = company?.payment_terms || 30;
          const dueDate = addDays(issueDate, paymentTerms);
          
          const invoiceRecord = {
            id: item.id,
            invoiceMonthId: month.id,
            invoiceNumber: `INV-${month.year}-${String(month.month).padStart(2, '0')}`,
            client: company?.name || 'Unknown',
            project: item.projects?.name || item.project_name || 'Unknown',
            issueDate,
            dueDate,
            amount: item.invoice_value,
            paymentTerms,
            collected: false,
            collectedDate: null,
            is_manual: false
          };

          totalVal += item.invoice_value;

          if (invoiceRecord.collected) {
            totalCollected += item.invoice_value;
          } else {
            totalOut += item.invoice_value;
            
            if (isBefore(dueDate, today)) {
              totalOverdue += item.invoice_value;
            } else {
              totalInTerms += item.invoice_value;
            }

            // Add to appropriate week
            weeks.forEach(week => {
              if (isWithinInterval(dueDate, { start: week.weekCommencing, end: week.weekEnding })) {
                week.invoices.push(invoiceRecord);
                week.total += item.invoice_value;
              }
            });
          }

          allInvoices.push(invoiceRecord);
        });
      });

      // Process manual invoices
      (manualInvoices || []).map((invoice) => {
        const invoiceDate = new Date(invoice.invoice_date);
        const dueDate = new Date(invoice.due_date);
        const daysDiff = Math.floor((dueDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        const isCollected = invoice.status === 'paid';
        const amount = Number(invoice.gross_amount);
        
        const invoiceRecord = {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          client: invoice.client_name,
          project: invoice.project_name || 'N/A',
          issueDate: invoiceDate,
          dueDate: dueDate,
          amount: amount,
          paymentTerms: daysDiff,
          collected: isCollected,
          collectedDate: isCollected ? dueDate : null,
          is_manual: true
        };

        totalVal += amount;

        if (isCollected) {
          totalCollected += amount;
        } else {
          totalOut += amount;
          
          if (isBefore(dueDate, today)) {
            totalOverdue += amount;
          } else {
            totalInTerms += amount;
          }

          // Add to appropriate week
          weeks.forEach(week => {
            if (isWithinInterval(dueDate, { start: week.weekCommencing, end: week.weekEnding })) {
              week.invoices.push(invoiceRecord);
              week.total += amount;
            }
          });
        }

        allInvoices.push(invoiceRecord);
      });

      // Set state
      setWeeklyData(weeks);
      setCollections(allInvoices);
      setTotals({
        totalOutstanding: totalOut,
        inTerms: totalInTerms,
        overdue: totalOverdue,
        collected: totalCollected,
        totalValue: totalVal
      });
    } catch (error) {
      console.error("Error fetching cash flow data:", error);
      toast({
        title: "Error",
        description: "Failed to load cash flow data",
        variant: "destructive",
      });
    } finally {
      setCashFlowLoading(false);
    }
  };

  const markAsCollected = async (invoiceId: string, isManual?: boolean) => {
    try {
      if (isManual) {
        // First get the gross amount
        const { data: invoiceData } = await supabase
          .from("invoice_history")
          .select("gross_amount")
          .eq("id", invoiceId)
          .single();

        // Update invoice_history for manual invoices
        const { error } = await supabase
          .from("invoice_history")
          .update({ 
            status: 'paid',
            paid_amount: invoiceData?.gross_amount || 0
          })
          .eq("id", invoiceId);

        if (error) throw error;
      } else {
        // For system invoices, we don't have a collection_status field yet
        // This would need to be added to invoice_months table
        toast({
          title: "Info",
          description: "Collection tracking for system invoices coming soon",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Invoice marked as collected",
      });

      fetchCashFlowData();
    } catch (error) {
      console.error("Error marking as collected:", error);
      toast({
        title: "Error",
        description: "Failed to mark invoice as collected",
        variant: "destructive",
      });
    }
  };

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

  function handleOpenEditDialog(item: InvoiceItem) {
    setEditingItemId(item.id);
    setEditingDescription(item.description || "");
    setEditDialogOpen(true);
  }

  async function handleSaveDescription() {
    if (!editingItemId) return;

    await handleUpdateItem(editingItemId, "description", editingDescription);
    setEditDialogOpen(false);
    setEditingItemId(null);
    setEditingDescription("");
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

  async function handleSyncProjects() {
    if (!invoiceMonth) return;

    try {
      setLoading(true);

      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0);

      // 1. Get all active projects for this period with client details
      const { data: projects, error: projectsError } = await supabase
        .from("projects" as any)
        .select(`
          id,
          name,
          code,
          project_reference,
          po_number,
          client_company_id,
          opportunity_id,
          start_date,
          end_date,
          agreed_fee_value,
          added_by_user_id,
          companies!projects_client_company_id_fkey(
            name,
            address,
            accounts_email,
            payment_terms
          ),
          opportunities!projects_opportunity_id_fkey(
            enquiry_number
          ),
          profiles!projects_added_by_user_id_fkey(
            full_name,
            email
          )
        `)
        .eq("status", "live")
        .eq("archived", false)
        .order("name", { ascending: true });

      if (projectsError) throw projectsError;

      // Type cast to handle the complex query result
      const typedProjects = (projects || []) as any[];

      // Filter for projects active in this month (start <= month_end AND end >= month_start)
      const activeProjects = typedProjects.filter(p => {
        if (!p.start_date || !p.end_date) return false;
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return start <= endOfMonth && end >= startOfMonth;
      });

      // Get active project IDs
      const activeProjectIds = new Set(activeProjects.map(p => p.id));

      // 2. Get existing invoice items
      const existingItemsMap = new Map<string, InvoiceItem>();
      invoiceItems.forEach(item => {
        existingItemsMap.set(item.project_id, item);
      });

      // 3. Remove invoice items for projects no longer active in this month
      const itemsToRemove = invoiceItems.filter(item => !activeProjectIds.has(item.project_id));
      if (itemsToRemove.length > 0) {
        const removeIds = itemsToRemove.map(item => item.id);
        await supabase
          .from("invoice_items")
          .delete()
          .in("id", removeIds);
        
        console.log(`Removed ${itemsToRemove.length} invoice items for projects no longer active in this month`);
      }

      // 4. Process each active project
      for (const p of activeProjects) {
        // Calculate monthly revenue from phasing or spread
        const { data: phasingData } = await supabase
          .from("project_monthly_phasing")
          .select("revenue_amount")
          .eq("project_id", p.id)
          .eq("year", selectedYear)
          .eq("month", selectedMonth)
          .maybeSingle();

        let monthlyRevenue = 0;
        if (phasingData?.revenue_amount) {
          monthlyRevenue = Number(phasingData.revenue_amount);
        } else if (p.start_date && p.end_date) {
          const start = new Date(p.start_date);
          const end = new Date(p.end_date);
          const durationMonths = Math.max(1,
            (end.getFullYear() - start.getFullYear()) * 12 +
            (end.getMonth() - start.getMonth()) + 1
          );
          monthlyRevenue = (Number(p.agreed_fee_value) || 0) / durationMonths;
        }

        const existingItem = existingItemsMap.get(p.id);
        const clientName = p.companies?.name || "Unknown Client";

        if (existingItem) {
          // UPDATE: Only update value and metadata, PRESERVE description
          await invoicingService.updateInvoiceItem(existingItem.id, {
            invoice_value: monthlyRevenue,
            project_code: p.code || "",
            po_number: p.po_number || existingItem.po_number,
            accounts_email: p.companies?.accounts_email || null,
            client_address: p.companies?.address || null,
            enquiry_number: p.opportunities?.enquiry_number || null,
            project_reference: p.project_reference || null,
            project_owner_name: p.profiles?.full_name || null,
            payment_terms: p.companies?.payment_terms || null,
          });
        } else {
          // CREATE: New item for this project
          await supabase.from("invoice_items").insert({
            invoice_month_id: invoiceMonth.id,
            project_id: p.id,
            project_name: p.name,
            project_code: p.code || "",
            client_name: clientName,
            invoice_value: monthlyRevenue,
            description: "",
            excluded_this_month: false,
            po_number: p.po_number,
            accounts_email: p.companies?.accounts_email || null,
            client_address: p.companies?.address || null,
            enquiry_number: p.opportunities?.enquiry_number || null,
            project_reference: p.project_reference || null,
            project_owner_name: p.profiles?.full_name || null,
            payment_terms: p.companies?.payment_terms || null,
          });
        }
      }

      toast({
        title: "Synced",
        description: `Projects synced successfully. ${itemsToRemove.length} inactive projects removed.`,
      });

      // Refresh list
      await loadInvoiceData();

    } catch (err) {
      console.error("Failed to sync projects", err);
      toast({
        title: "Error",
        description: "Failed to sync projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

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
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Invoicing</h1>
            <p className="text-slate-600 mt-1">Manage invoices and payments</p>
          </div>

          <Tabs defaultValue="invoices" className="space-y-6" onValueChange={(value) => {
            if (value === 'cashflow') {
              fetchCashFlowData();
            }
          }}>
            <TabsList>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow Forecast</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="space-y-6">
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
                      <div className="p-8 text-center text-gray-500">
                        No invoices for this period
                      </div>
                    ) : (
                      <>
                      {/* Top Scrollbar */}
                      <div
                        ref={topScrollRef}
                        className="overflow-x-auto border-b"
                        onScroll={handleTopScroll}
                      >
                        <div className="h-4 min-w-[1600px]" />
                      </div>

                      {/* Bottom Scrollable Table */}
                      <div
                        ref={bottomScrollRef}
                        className="overflow-x-auto"
                        onScroll={handleBottomScroll}
                      >
                        <Table className="min-w-[1600px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">Include</TableHead>
                              <TableHead className="min-w-[150px]">Project</TableHead>
                              <TableHead className="min-w-[120px]">Client</TableHead>
                              <TableHead className="min-w-[120px]">PO Number</TableHead>
                              <TableHead className="min-w-[150px]">Email Contact</TableHead>
                              <TableHead className="min-w-[200px]">Address</TableHead>
                              <TableHead className="min-w-[100px]">Project Number</TableHead>
                              <TableHead className="min-w-[120px]">Project Owner</TableHead>
                              <TableHead className="min-w-[100px]">Payment Terms</TableHead>
                              <TableHead className="min-w-[150px]">Invoice Value (from Monthly Phasing)</TableHead>
                              <TableHead className="min-w-[200px]">Description</TableHead>
                              <TableHead className="min-w-[100px]">Last Updated</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceItems.map((item) => (
                              <TableRow key={item.id} className={item.excluded_this_month ? "opacity-50" : ""}>
                                <TableCell className="px-4 py-3">
                                  <Checkbox
                                    checked={!item.excluded_this_month}
                                    disabled={!canEdit || isLocked}
                                    onCheckedChange={(checked) =>
                                      handleUpdateItem(item.id, "excluded_this_month", !checked)
                                    }
                                  />
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <Link
                                    href={`/projects/${item.project_id}`}
                                    className="text-blue-600 hover:underline"
                                  >
                                    {item.project_code} - {item.project_name}
                                  </Link>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm">{item.client_name}</TableCell>
                                <TableCell className="px-4 py-3 text-sm">
                                  {item.po_number || "—"}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm">
                                  {item.accounts_email ? (
                                    <a
                                      href={`mailto:${item.accounts_email}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {item.accounts_email}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm max-w-xs truncate" title={item.client_address || ""}>
                                  {item.client_address || "—"}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm font-mono">
                                  {item.project_reference || "—"}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm">
                                  {item.project_owner_name || "—"}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm">
                                  {item.payment_terms ? `${item.payment_terms} days` : "—"}
                                </TableCell>
                                <TableCell className="px-4 py-3">
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
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  {canEdit && !isLocked && !item.excluded_this_month ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenEditDialog(item)}
                                      className="w-full justify-start text-left min-h-[60px] whitespace-normal"
                                    >
                                      {item.description ? (
                                        <span className="text-sm">{item.description}</span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground italic">
                                          Click to add description...
                                        </span>
                                      )}
                                    </Button>
                                  ) : (
                                    <span className="text-sm whitespace-pre-wrap">
                                      {item.description || "—"}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm text-gray-500">
                                  {new Date(item.updated_at).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      </>
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
            </TabsContent>

            <TabsContent value="cashflow" className="space-y-6">
              {cashFlowLoading ? (
                <div className="text-center py-12">Loading cash flow data...</div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                          Total Outstanding
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          £{totals.totalOutstanding.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600">
                          In Terms
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                          £{totals.inTerms.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600">
                          Overdue
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          £{totals.overdue.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-600">
                          Collected
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          £{totals.collected.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                          Total Value
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          £{totals.totalValue.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Weekly Breakdown */}
                  <div className="space-y-4">
                    {weeklyData.map((week, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">
                                W/C {format(week.weekCommencing, "dd MMM yyyy")}
                              </CardTitle>
                              <p className="text-sm text-slate-600 mt-1">
                                {format(week.weekCommencing, "dd MMM")} - {format(week.weekEnding, "dd MMM yyyy")}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                £{week.total.toLocaleString()}
                              </div>
                              <p className="text-sm text-slate-600">
                                {week.invoices.length} invoice{week.invoices.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        {week.invoices.length > 0 && (
                          <CardContent>
                            <div className="space-y-3">
                              {week.invoices.map((invoice: any) => {
                                const isOverdue = isBefore(invoice.dueDate, new Date()) && !invoice.collected;
                                
                                return (
                                  <div
                                    key={invoice.id}
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <span className="font-semibold">{invoice.invoiceNumber}</span>
                                        {invoice.is_manual && (
                                          <Badge variant="outline" className="text-xs">
                                            Manual
                                          </Badge>
                                        )}
                                        {invoice.collected ? (
                                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            Collected
                                          </Badge>
                                        ) : isOverdue ? (
                                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            Overdue
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                            <Clock className="w-3 h-3 mr-1" />
                                            Pending
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-slate-600 mt-1">
                                        {invoice.client} - {invoice.project}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                        Issued: {format(invoice.issueDate, "dd MMM yyyy")} | 
                                        Due: {format(invoice.dueDate, "dd MMM yyyy")} | 
                                        Terms: {invoice.paymentTerms} days
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="font-semibold">
                                          £{invoice.amount.toLocaleString()}
                                        </div>
                                      </div>
                                      {!invoice.collected && (
                                        <Button
                                          size="sm"
                                          onClick={() => markAsCollected(invoice.id, invoice.is_manual)}
                                        >
                                          <CheckCircle2 className="h-4 w-4 mr-1" />
                                          Mark Collected
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>

                  {weeklyData.every(week => week.invoices.length === 0) && (
                    <div className="text-center py-12 text-slate-600">
                      No invoices to display
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Edit Description Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Invoice Description</DialogTitle>
                <DialogDescription>
                  Describe what you&apos;re invoicing for this project this month. This text will appear on the invoice.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="What we're invoicing this month..."
                  className="min-h-[200px]"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingItemId(null);
                    setEditingDescription("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveDescription}>
                  Save Description
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
        </div>
      </Layout>
    </RequireAuth>
  );
}