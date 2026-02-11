import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type InvoiceMonth = Database["public"]["Tables"]["invoice_months"]["Row"];
type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
type InvoiceMonthInsert = Database["public"]["Tables"]["invoice_months"]["Insert"];
type InvoiceItemInsert = Database["public"]["Tables"]["invoice_items"]["Insert"];

export const invoicingService = {
  // Get or create invoice month for a given year/month
  async getOrCreateInvoiceMonth(year: number, month: number): Promise<InvoiceMonth | null> {
    const { data, error } = await supabase
      .from("invoice_months")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (error) {
      console.error("Error fetching invoice month:", error);
      throw error;
    }

    return data;
  },

  // Create a new invoice month
  async createInvoiceMonth(year: number, month: number): Promise<InvoiceMonth> {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("invoice_months")
      .insert({
        year,
        month,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating invoice month:", error);
      throw error;
    }

    // Auto-populate invoice items for all live projects
    await this.populateInvoiceItems(data.id);

    return data;
  },

  // Populate invoice items for all live projects
  async populateInvoiceItems(invoiceMonthId: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not authenticated");

    // First, delete any existing invoice items for this month to prevent duplicates
    const { error: deleteError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_month_id", invoiceMonthId);

    if (deleteError) {
      console.error("Error deleting existing invoice items:", deleteError);
      throw deleteError;
    }

    // First, get the invoice month to know which year/month we're populating for
    const { data: invoiceMonth, error: monthError } = await supabase
      .from("invoice_months")
      .select("year, month")
      .eq("id", invoiceMonthId)
      .single();

    if (monthError) {
      console.error("Error fetching invoice month:", monthError);
      throw monthError;
    }

    // Fetch all live projects with their monthly phasing for this specific month
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        status,
        companies!projects_client_company_id_fkey (
          name
        ),
        project_monthly_phasing!inner (
          revenue_amount
        )
      `)
      .in("status", ["live", "Live"])
      .eq("project_monthly_phasing.year", invoiceMonth.year)
      .eq("project_monthly_phasing.month", invoiceMonth.month);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      console.log("No live projects found with phasing for this month");
      return;
    }

    // Create invoice items for each project with the phased revenue amount
    const invoiceItems: InvoiceItemInsert[] = projects.map((project) => {
      const phasingData = Array.isArray(project.project_monthly_phasing)
        ? project.project_monthly_phasing[0]
        : project.project_monthly_phasing;
      
      return {
        invoice_month_id: invoiceMonthId,
        project_id: project.id,
        project_name: project.name,
        client_name: Array.isArray(project.companies) 
          ? project.companies[0]?.name || "Unknown Client"
          : (project.companies as any)?.name || "Unknown Client",
        invoice_value: phasingData?.revenue_amount || 0,
        description: "",
        excluded_this_month: false,
        created_by: session.session.user.id,
      };
    });

    const { error: insertError } = await supabase
      .from("invoice_items")
      .insert(invoiceItems);

    if (insertError) {
      console.error("Error creating invoice items:", insertError);
      throw insertError;
    }
  },

  // Get invoice items for a given month
  async getInvoiceItems(invoiceMonthId: string): Promise<InvoiceItem[]> {
    const { data, error } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_month_id", invoiceMonthId)
      .order("project_name");

    if (error) {
      console.error("Error fetching invoice items:", error);
      throw error;
    }

    return data || [];
  },

  // Update an invoice item
  async updateInvoiceItem(
    id: string,
    updates: {
      invoice_value?: number | null;
      description?: string;
      excluded_this_month?: boolean;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from("invoice_items")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating invoice item:", error);
      throw error;
    }
  },

  // Lock invoice month (finish invoicing)
  async lockInvoiceMonth(invoiceMonthId: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("invoice_months")
      .update({
        status: "locked",
        locked_by: session.session.user.id,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceMonthId);

    if (error) {
      console.error("Error locking invoice month:", error);
      throw error;
    }
  },

  // Reopen invoice month (admin only)
  async reopenInvoiceMonth(invoiceMonthId: string): Promise<void> {
    const { error } = await supabase
      .from("invoice_months")
      .update({
        status: "open",
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceMonthId);

    if (error) {
      console.error("Error reopening invoice month:", error);
      throw error;
    }
  },

  // Save PDF URL to invoice month
  async savePdfUrl(invoiceMonthId: string, pdfUrl: string): Promise<void> {
    const { error } = await supabase
      .from("invoice_months")
      .update({
        pdf_url: pdfUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceMonthId);

    if (error) {
      console.error("Error saving PDF URL:", error);
      throw error;
    }
  },

  // Generate and Upload PDF
  async generateAndUploadPdf(invoiceMonth: InvoiceMonth, items: InvoiceItem[]): Promise<string> {
    const doc = new jsPDF();
    const MONTHS = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // --- PDF Content Generation ---
    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("Invoicing Summary", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`${MONTHS[invoiceMonth.month - 1]} ${invoiceMonth.year}`, 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    
    // Filter included items
    const includedItems = items.filter(
      item => !item.excluded_this_month && item.invoice_value !== null
    );

    const tableData = includedItems.map(item => [
      item.project_name,
      item.client_name,
      item.description || "",
      `£${(item.invoice_value || 0).toFixed(2)}`
    ]);

    // Table
    autoTable(doc, {
      startY: 45,
      head: [['Project', 'Client', 'Description', 'Value']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 40 }, // Project
        1: { cellWidth: 40 }, // Client
        2: { cellWidth: 'auto' }, // Description
        3: { cellWidth: 30, halign: 'right' }, // Value
      },
    });

    // Total
    const total = includedItems.reduce((sum, item) => sum + (item.invoice_value || 0), 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Invoice Value: £${total.toFixed(2)}`, 140, finalY, { align: 'left' });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by ConexaDT - Internal invoicing record", 14, pageHeight - 10);
    doc.text(`Ref: ${invoiceMonth.id}`, 14, pageHeight - 5);

    // --- Upload to Storage ---
    const pdfBlob = doc.output('blob');
    const fileName = `invoices_${invoiceMonth.year}_${invoiceMonth.month}_${invoiceMonth.id}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('invoices')
      .getPublicUrl(fileName);

    return publicUrl;
  }
};