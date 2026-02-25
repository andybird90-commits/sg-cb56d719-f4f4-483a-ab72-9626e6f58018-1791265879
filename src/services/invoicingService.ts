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
      .from("projects" as any)
      .select(`
        id,
        code,
        name,
        agreed_fee_value,
        start_date,
        end_date,
        po_number,
        project_reference,
        client_company_id,
        opportunity_id,
        added_by_user_id,
        companies!projects_client_company_id_fkey (
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
      .eq("archived", false);

    if (projectsError) throw projectsError;

    const allProjects = (projects || []) as any[];

    // Phasing for the specific invoice month
    const { data: phasingData, error: phasingError } = await supabase
      .from("project_monthly_phasing")
      .select("project_id, revenue_amount")
      .eq("year", year)
      .eq("month", month);

    if (phasingError) throw phasingError;

    // All projects that have ANY manual phasing (in any month)
    const {
      data: projectsWithPhasing,
      error: projectsWithPhasingError,
    } = await supabase
      .from("project_monthly_phasing")
      .select("project_id")
      .not("revenue_amount", "is", null);

    if (projectsWithPhasingError) throw projectsWithPhasingError;

    const phasingMap = new Map<string, number>();
    phasingData?.forEach((p: any) => {
      phasingMap.set(p.project_id as string, (p.revenue_amount as number) || 0);
    });

    const projectsWithAnyPhasing = new Set(
      (projectsWithPhasing || []).map((p: any) => p.project_id as string)
    );

    const itemsToInsert: any[] = [];

    allProjects.forEach((project: any) => {
      const projectId = project.id as string;
      const hasManualPhasing = projectsWithAnyPhasing.has(projectId);
      const manualPhasingAmountRaw = phasingMap.get(projectId);
      const manualPhasingAmount =
        typeof manualPhasingAmountRaw === "number" ? manualPhasingAmountRaw : 0;

      // MANUAL PHASING PROJECTS:
      // If a project has ANY manual phasing, that schedule is the only source of truth.
      // We only invoice in months where the phasing value is > 0.
      if (hasManualPhasing) {
        if (manualPhasingAmount <= 0) {
          // Either no row for this month or explicitly set to 0:
          // do NOT include this project in this invoice month.
          return;
        }
      } else {
        // NON-MANUAL PROJECTS:
        // Fall back to automatic, date-based allocation.
        if (!project.start_date || !project.end_date) {
          return;
        }
        const start = new Date(project.start_date as string);
        const end = new Date(project.end_date as string);
        if (start > endOfMonth || end < startOfMonth) {
          return;
        }
      }

      let invoiceValue = 0;

      if (hasManualPhasing) {
        invoiceValue = manualPhasingAmount;
      } else if (
        project.agreed_fee_value &&
        project.start_date &&
        project.end_date
      ) {
        const start = new Date(project.start_date as string);
        const end = new Date(project.end_date as string);
        const durationMonths = Math.max(
          1,
          (end.getFullYear() - start.getFullYear()) * 12 +
            (end.getMonth() - start.getMonth()) +
            1
        );
        invoiceValue = Number(project.agreed_fee_value) / durationMonths;
      }

      const clientName = project.companies?.name || "Unknown Client";

      itemsToInsert.push({
        invoice_month_id: invoiceMonthId,
        project_id: projectId,
        project_name: project.name as string,
        project_code: (project.code as string) || "",
        client_name: clientName,
        invoice_value: invoiceValue,
        description: "",
        excluded_this_month: false,
        po_number: (project.po_number as string) || null,
        accounts_email: project.companies?.accounts_email || null,
        client_address: project.companies?.address || null,
        enquiry_number: project.opportunities?.enquiry_number || null,
        project_reference: project.project_reference || null,
        project_owner_name: project.profiles?.full_name || null,
        payment_terms: project.companies?.payment_terms || null,
      });
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
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("invoice_months")
      .update({
        status: "locked",
        locked_at: new Date().toISOString(),
        locked_by: authData.user?.id || null,
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
        pdf_url: null,
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

    const {
      data: projectsWithAnyPhasing,
      error: projectsWithAnyPhasingError,
    } = await supabase
      .from("project_monthly_phasing")
      .select("project_id")
      .not("revenue_amount", "is", null);

    if (projectsWithAnyPhasingError) throw projectsWithAnyPhasingError;

    const phasingMap = new Map<string, number>();
    phasingRows?.forEach((row: any) => {
      phasingMap.set(row.project_id as string, (row.revenue_amount as number) || 0);
    });

    const projectsWithAnyPhasingSet = new Set<string>(
      (projectsWithAnyPhasing || []).map((p: any) => p.project_id as string)
    );

    let total = 0;

    projects.forEach((project: any) => {
      const projectId = project.id as string;
      const isManuallyPhased = projectsWithAnyPhasingSet.has(projectId);

      if (isManuallyPhased) {
        if (!phasingMap.has(projectId)) {
          return;
        }
        total += phasingMap.get(projectId) || 0;
        return;
      }

      if (!project.start_date || !project.end_date) return;

      const start = new Date(project.start_date as string);
      const end = new Date(project.end_date as string);

      if (start > monthEnd || end < monthStart) return;

      const durationMonths = Math.max(
        1,
        (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()) +
          1
      );
      const monthlyRevenue =
        (Number(project.agreed_fee_value) || 0) / durationMonths;

      total += monthlyRevenue;
    });

    return total;
  },

  async generateAndUploadPdf(
    invoiceMonth: InvoiceMonth,
    items: InvoiceItem[],
    options?: {
      bucket?: string;
      revision?: number;
    }
  ): Promise<string> {
    const bucket = options?.bucket ?? "invoices";

    const monthPadded = String(invoiceMonth.month).padStart(2, "0");
    const baseFileName = `invoices-${invoiceMonth.year}-${monthPadded}`;
    const fileName =
      options?.revision !== undefined
        ? `${baseFileName}-rev${options.revision}.pdf`
        : `${baseFileName}.pdf`;

    // Use the exact same inclusion rules as the UI:
    // only items that are not excluded and have a non-null/undefined invoice_value.
    const includedItems = (items || []).filter(
      (item) =>
        !item.excluded_this_month &&
        item.invoice_value !== null &&
        item.invoice_value !== undefined
    );

    const totalValue = includedItems.reduce(
      (sum, item) => sum + (Number(item.invoice_value) || 0),
      0
    );

    // Build table rows for the PDF
    const tableRows = includedItems.map((item) => [
      item.project_code || "",
      item.project_name || "",
      item.client_name || "",
      item.po_number || "",
      `£${(Number(item.invoice_value) || 0).toFixed(2)}`,
      item.description || "",
      (item as any).accounts_email || "",
      (item as any).project_reference || "",
      (item as any).project_owner_name || "",
      (item as any).payment_terms
        ? `${(item as any).payment_terms} days`
        : "",
    ]);

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(
      `Invoice Summary - ${invoiceMonth.year}-${monthPadded}`,
      14,
      20
    );

    doc.setFontSize(11);
    doc.text(`Status: ${invoiceMonth.status}`, 14, 28);
    doc.text(
      `Total (matches UI): £${totalValue.toFixed(2)}`,
      14,
      34
    );

    (doc as any).autoTable({
      head: [
        [
          "Project Code",
          "Project Name",
          "Client",
          "PO Number",
          "Value",
          "Description",
          "Email",
          "Project Ref",
          "Owner",
          "Terms",
        ],
      ],
      body: tableRows,
      startY: 42,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
    });

    const pdfBlob = doc.output("blob");
    const pdfBuffer = await pdfBlob.arrayBuffer();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading invoice PDF", uploadError);
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);

    return publicUrl;
  },

  async createInvoiceArchiveSnapshot(
    invoiceMonth: InvoiceMonth,
    items: InvoiceItem[]
  ): Promise<void> {
    const { data: authData } = await supabase.auth.getUser();

    const { data: existing, error: existingError } = await (supabase as any)
      .from("invoice_month_archives")
      .select("revision")
      .eq("invoice_month_id", invoiceMonth.id)
      .order("revision", { ascending: false })
      .limit(1);

    if (existingError) throw existingError;

    const existingArray =
      (existing as { revision: number | null }[] | null) || [];

    const nextRevision =
      existingArray.length > 0 &&
      typeof existingArray[0].revision === "number"
        ? existingArray[0].revision + 1
        : 0;

    const pdfUrl = await this.generateAndUploadPdf(invoiceMonth, items, {
      bucket: "invoice-archive",
      revision: nextRevision,
    });

    const { error: insertError } = await (supabase as any)
      .from("invoice_month_archives")
      .insert({
        invoice_month_id: invoiceMonth.id,
        year: invoiceMonth.year,
        month: invoiceMonth.month,
        revision: nextRevision,
        pdf_url: pdfUrl,
        created_by_user_id: authData.user?.id ?? null,
      });

    if (insertError) throw insertError;
  },

  async savePdfUrl(invoiceMonthId: string, pdfUrl: string): Promise<void> {
    const { error } = await supabase
      .from("invoice_months")
      .update({ pdf_url: pdfUrl })
      .eq("id", invoiceMonthId);

    if (error) throw error;
  },
};