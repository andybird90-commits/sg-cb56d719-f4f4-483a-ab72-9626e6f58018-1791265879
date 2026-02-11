import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

    // Fetch all live projects
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        status,
        client_companies (
          name
        )
      `)
      .in("status", ["Live", "In Progress", "Active"]);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      console.log("No live projects found");
      return;
    }

    // Create invoice items for each project
    const invoiceItems: InvoiceItemInsert[] = projects.map((project) => ({
      invoice_month_id: invoiceMonthId,
      project_id: project.id,
      project_name: project.name,
      client_name: Array.isArray(project.client_companies) 
        ? project.client_companies[0]?.name || "Unknown Client"
        : (project.client_companies as any)?.name || "Unknown Client",
      invoice_value: null,
      description: "",
      excluded_this_month: false,
      created_by: session.session.user.id,
    }));

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
};