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

    const { data: phasingData, error: phasingError } = await supabase
      .from("project_monthly_phasing")
      .select("project_id, revenue_amount")
      .eq("year", year)
      .eq("month", month);

    if (phasingError) throw phasingError;

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

      if (projectsWithAnyPhasing.has(project.id)) {
        invoiceValue = phasingMap.get(project.id) || 0;
      } else {
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

  async getProjectPhasingTotal(year: number, month: number): Promise<number> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const { data: rawProjects, error: projectsError } = await supabase
      .from("projects" as any)
      .select(`
        id,
        agreed_fee_value,
        start_date,
        end_date
      `)
      .eq("archived", false)
      .not("agreed_fee_value", "is", null)
      .gte("end_date", monthStart.toISOString());

    if (projectsError) throw projectsError;

    const projects = (rawProjects || []) as any[];

    const { data: phasingRows, error: phasingError } = await supabase
      .from("project_monthly_phasing")
      .select("project_id, year, month, revenue_amount")
      .eq("year", year)
      .eq("month", month);

    if (phasingError) throw phasingError;

    const { data: projectsWithAnyPhasing, error: projectsWithAnyPhasingError } = await supabase
      .from("project_monthly_phasing")
      .select("project_id")
      .not("revenue_amount", "is", null);

    if (projectsWithAnyPhasingError) throw projectsWithAnyPhasingError;

    const phasingMap = new Map<string, number>();
    phasingRows?.forEach((row: any) => {
      phasingMap.set(row.project_id, row.revenue_amount || 0);
    });

    const projectsWithAnyPhasingSet = new Set<string>(
      (projectsWithAnyPhasing || []).map((p: any) => p.project_id)
    );

    let total = 0;

    projects.forEach((project: any) => {
      if (!project.start_date || !project.end_date) return;

      const start = new Date(project.start_date);
      const end = new Date(project.end_date);

      if (start > monthEnd || end < monthStart) return;

      const hasManualPhasing = projectsWithAnyPhasingSet.has(project.id);
      let monthlyRevenue = 0;

      if (hasManualPhasing) {
        monthlyRevenue = phasingMap.get(project.id) || 0;
      } else {
        const durationMonths = Math.max(
          1,
          (end.getFullYear() - start.getFullYear()) * 12 +
            (end.getMonth() - start.getMonth()) +
            1
        );
        monthlyRevenue =
          (Number(project.agreed_fee_value) || 0) / durationMonths;
      }

      total += monthlyRevenue;
    });

    return total;
  },

  async generateAndUploadPdf(
    invoiceMonth: InvoiceMonth,
    items: InvoiceItem[]
  ): Promise<string> {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    const doc = new jsPDF("landscape", "mm", "a4");
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = months[invoiceMonth.month - 1];

    doc.setFontSize(18);
    doc.text(`Invoicing Summary`, 14, 20);

    doc.setFontSize(12);
    doc.text(`${monthName} ${invoiceMonth.year}`, 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, 14, 35);

    const includedItems = items.filter(
      (item) => !item.excluded_this_month && item.invoice_value !== null
    );

    const totalValue = includedItems.reduce(
      (sum, item) => sum + (item.invoice_value || 0),
      0
    );

    const tableData = includedItems.map(item => [
      item.project_code || "—",
      item.project_name || "—",
      item.client_name || "—",
      item.po_number || "—",
      item.accounts_email || "—",
      item.client_address || "—",
      item.project_reference || "—",
      item.project_owner_name || "—",
      item.payment_terms ? `${item.payment_terms} days` : "—",
      `£${item.invoice_value?.toFixed(2) || "0.00"}`,
      item.description || "—"
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [["Code", "Project", "Client", "PO Number", "Email Contact", "Address", "Project Number", "Project Owner", "Payment Terms", "Value", "Description"]],
      body: tableData,
      foot: [["", "", "", "", "", "", "", "", "TOTAL", `£${totalValue.toFixed(2)}`, ""]],
      theme: "grid",
      styles: { 
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
        cellWidth: "wrap"
      },
      headStyles: { 
        fillColor: [71, 85, 105],
        fontStyle: "bold",
        fontSize: 8
      },
      footStyles: { 
        fillColor: [241, 245, 249], 
        textColor: [0, 0, 0], 
        fontStyle: "bold",
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 },
        6: { cellWidth: 20 },
        7: { cellWidth: 25 },
        8: { cellWidth: 20 },
        9: { cellWidth: 20 },
        10: { cellWidth: 35 }
      }
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