import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import jsPDF from "jspdf";
import "jspdf-autotable";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
type InvoiceMonth = Tables<"invoice_months">;
type InvoiceItem = Tables<"invoice_items">;

export const invoicingService = {
  async getOrCreateInvoiceMonth(
    year: number,
    month: number
  ): Promise<InvoiceMonth | null> {
    const { data: existing } = await supabase
      .from("invoice_months")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (existing) return existing;
    return null;
  },

  async createInvoiceMonth(
    year: number,
    month: number
  ): Promise<InvoiceMonth> {
    const { data: newMonth, error: createError } = await supabase
      .from("invoice_months")
      .insert({ year, month, status: "open" })
      .select()
      .single();

    if (createError) throw createError;

    await this.populateInvoiceItems(newMonth.id, year, month);

    return newMonth;
  },

  async populateInvoiceItems(
    invoiceMonthId: string,
    year: number,
    month: number
  ): Promise<void> {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        code,
        name,
        agreed_fee_value,
        start_date,
        end_date,
        po_number,
        companies!projects_client_company_id_fkey (
          name
        )
      `)
      .eq("archived", false);

    if (projectsError) throw projectsError;

    const activeProjects = (projects || []).filter((p) => {
      if (!p.start_date || !p.end_date) return false;
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      return start <= endOfMonth && end >= startOfMonth;
    });

    // Get phasing data for this specific month
    const { data: phasingData, error: phasingError } = await supabase
      .from("project_monthly_phasing")
      .select("project_id, revenue_amount")
      .eq("year", year)
      .eq("month", month);

    if (phasingError) throw phasingError;

    // Get all projects that have ANY manual phasing entries
    const { data: projectsWithPhasing, error: projectsWithPhasingError } = await supabase
      .from("project_monthly_phasing")
      .select("project_id")
      .not("revenue_amount", "is", null);

    if (projectsWithPhasingError) throw projectsWithPhasingError;

    const phasingMap = new Map<string, number>();
    phasingData?.forEach((p) => {
      phasingMap.set(p.project_id, p.revenue_amount || 0);
    });

    const projectsWithAnyPhasing = new Set(
      projectsWithPhasing?.map((p) => p.project_id) || []
    );

    const itemsToInsert = activeProjects.map((project) => {
      let invoiceValue = 0;

      // Check if this project has ANY manual phasing entries
      if (projectsWithAnyPhasing.has(project.id)) {
        // Project has manual phasing - use the value for this month OR 0 if not set
        invoiceValue = phasingMap.get(project.id) || 0;
      } else {
        // Project has NO manual phasing - calculate fallback
        if (project.agreed_fee_value && project.start_date && project.end_date) {
          const start = new Date(project.start_date);
          const end = new Date(project.end_date);
          const durationMonths = Math.max(
            1,
            (end.getFullYear() - start.getFullYear()) * 12 +
              (end.getMonth() - start.getMonth()) +
              1
          );
          invoiceValue = Number(project.agreed_fee_value) / durationMonths;
        }
      }

      const clientName =
        project.companies?.name || "Unknown Client";

      return {
        invoice_month_id: invoiceMonthId,
        project_id: project.id,
        project_name: project.name,
        project_code: project.code || "",
        client_name: clientName,
        invoice_value: invoiceValue,
        description: "",
        excluded_this_month: false,
        po_number: project.po_number || null,
      };
    });

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert);

      if (insertError) throw insertError;
    }
  },

  async getInvoiceItems(invoiceMonthId: string): Promise<InvoiceItem[]> {
    const { data, error } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_month_id", invoiceMonthId)
      .order("project_code", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async updateInvoiceItem(
    itemId: string,
    updates: Partial<InvoiceItem>
  ): Promise<void> {
    const { error } = await supabase
      .from("invoice_items")
      .update(updates)
      .eq("id", itemId);

    if (error) throw error;
  },

  async lockInvoiceMonth(invoiceMonthId: string): Promise<void> {
    const { error } = await supabase
      .from("invoice_months")
      .update({ 
        status: "locked",
        locked_at: new Date().toISOString(),
        locked_by: (await supabase.auth.getUser()).data.user?.id || null
      })
      .eq("id", invoiceMonthId);

    if (error) throw error;
  },

  async reopenInvoiceMonth(invoiceMonthId: string): Promise<void> {
    const { error } = await supabase
      .from("invoice_months")
      .update({ 
        status: "open",
        locked_at: null,
        locked_by: null,
        pdf_url: null
      })
      .eq("id", invoiceMonthId);

    if (error) throw error;
  },

  async generateAndUploadPdf(
    invoiceMonth: InvoiceMonth,
    items: InvoiceItem[]
  ): Promise<string> {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    const doc = new jsPDF("l", "mm", "a4");
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = months[invoiceMonth.month - 1];

    doc.setFontSize(18);
    doc.text(`Invoice Summary - ${monthName} ${invoiceMonth.year}`, 14, 20);

    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 30);

    const includedItems = items.filter(
      (item) => !item.excluded_this_month && item.invoice_value !== null
    );

    // Table headers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const headers = ["Project", "Client", "Value", "Description"];
    const colWidths = [50, 50, 30, 60];
    let yPos = 40;
    let xPos = 20;
    
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    
    yPos += 5;
    doc.setFont("helvetica", "normal");
    
    // Table rows
    includedItems.forEach((item) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      xPos = 20;
      const rowData = [
        item.project_name,
        item.client_name,
        `£${item.invoice_value?.toFixed(2) || "0.00"}`,
        item.description || ""
      ];
      
      rowData.forEach((data, i) => {
        const lines = doc.splitTextToSize(data, colWidths[i] - 2);
        doc.text(lines, xPos, yPos);
        xPos += colWidths[i];
      });
      
      yPos += 8;
    });

    const totalValue = includedItems.reduce(
      (sum, item) => sum + (item.invoice_value || 0),
      0
    );

    (doc as any).autoTable({
      startY: 40,
      head: [["Code", "Project", "Client", "PO", "Email Contact", "Address", "Project Number", "Project Owner", "Payment Terms", "Value", "Description"]],
      body: [],
      foot: [["", "", "", "", "", "", "", "", "TOTAL", `£${totalValue.toFixed(2)}`, ""]],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [71, 85, 105] },
      footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    const pdfBlob = doc.output("blob");
    const fileName = `invoice-${invoiceMonth.year}-${String(invoiceMonth.month).padStart(2, "0")}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(fileName, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('invoices')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  async savePdfUrl(invoiceMonthId: string, pdfUrl: string): Promise<void> {
    const { error } = await supabase
      .from("invoice_months")
      .update({ pdf_url: pdfUrl })
      .eq("id", invoiceMonthId);

    if (error) throw error;
  }
};